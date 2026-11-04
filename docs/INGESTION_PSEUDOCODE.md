# Survey-file ingestion: pseudo-code

> **This is pseudo-code in the prototype.** The readers below show exactly how real survey uploads would be read and
> processed, but they do not parse or process any survey data. A reader may look at the first 4 KB of a file to
> recognise its format; everything after that is returned as a *plan* with status `PSEUDO_NOT_EXECUTED`. No
> geospatial library (laspy, PDAL, ifcopenshell, ezdxf, pyproj, georinex) is imported by the ingestion package, and
> **no reader ever mints an identifier**: 3D ULPINs are minted only by the existing norms pipeline, after the
> integrity axioms pass and a surveyor verifies the result.

Code: [`backend/app/ingest/`](../backend/app/ingest/). Each reader's class docstring carries the same algorithm as
Python-style pseudo-code, and `GET /api/ingest/formats` returns it.

## Formats

| Format | Reader | Recognised by (first bytes) | Outputs | Accuracy class |
|---|---|---|---|---|
| LAS / LAZ point cloud | `lidar` | `LASF` signature (LAZ: plus a `.laz` name) | Ground and roof elevation, measured height and floors per building, point density and confidence, height-discrepancy findings | `A_SURVEY` |
| IFC2x3 / IFC4 model | `ifc` | `ISO-10303-21` header with an IFC `FILE_SCHEMA` (or an `.ifc` name) | Storey elevations, unit polygons per storey, Common Space Registry entries, RERA carpet area | `B_PLAN` |
| DXF floor plans | `dxf` | Group code `0` + `SECTION` near the start, or the binary DXF sentinel | Unit polygons with unit numbers, wall lines, carpet area, georeference RMS report | `B_PLAN` |
| RINEX observations | `gnss` | `RINEX VERSION / TYPE` header label | PPK / CORS job plan, then control points | `A_SURVEY` |
| NMEA stream | `gnss` | Lines starting `$GPGGA` / `$GNGGA` | Fixes with quality, HDOP and satellites, then control points | `A_SURVEY` |
| Control-point CSV | `gnss` | Header with latitude, longitude and height columns | Control points with precision | `A_SURVEY` |
| Anything else (TIF, GeoJSON, XLSX, DWG, PDF, …) | none | — | `UNSUPPORTED` plan with a note | — |

Accuracy classes: **`A_SURVEY`** means field-measured (LiDAR returns, GNSS fixes), with density or precision
recorded. **`B_PLAN`** means plan-derived (approved drawings or BIM), awaiting surveyor verification on site.

## LiDAR (LAS / LAZ)

1. Read the public header block: version, point format, scale and offset, point count. Read the CRS from the WKT VLR
   (LAS 1.4) or the GeoTIFF keys (LAS 1.2). **Refuse the file if the CRS is unknown.**
2. Stream the points in chunks of 1,000,000 (LAZ decompressed on the fly); never load the whole cloud.
3. Keep ASPRS class 2 (ground) and class 6 (building); drop everything else.
4. Reproject to WGS 84, then to the scene's `LocalFrame` (azimuthal-equidistant metres).
5. For each building footprint:
   - `ground_z` = median of the class-2 points in a 3 m ring around the footprint;
   - `roof_z` = 95th percentile of the class-6 points inside the footprint.
6. `height = roof_z − ground_z`; `floors = round((height − plinth) / floor_height)`, with a 0.6 m plinth.
7. Point density (points per m²) and the spread of roof heights give a confidence score; accuracy class `A_SURVEY`.
8. If `|height − current height| > 1.5 m`, raise a **height discrepancy** finding.
9. Update the building's evidence only. **Never mint IDs**: the integrity axioms and surveyor verification still gate
   minting.

## IFC (BIM)

1. Open the IFC2x3 or IFC4 model. Read the georeference from `IfcMapConversion` (IFC4) or the `IfcSite` reference
   point (IFC2x3). **Refuse the model if it has no georeference.**
2. For each `IfcBuildingStorey`, take its elevation (in project length units).
3. For each `IfcSpace`, take its boundary polygon and its net floor area (`Qto_SpaceBaseQuantities.NetFloorArea`).
4. Match the model to a surveyed building by footprint IoU ≥ 0.7; refuse if nothing matches.
5. Dwelling, shop and office spaces become unit polygons that **replace** the synthetic `floorplan.plan_floor` split.
   Stairs, lifts and corridors go to the **Common Space Registry** (they never get a 3D ULPIN).
6. Carpet area per RERA from the net area (excluding external walls, services and balconies).
7. Mark the result "plan-derived, awaiting surveyor verification". No identifier is minted.

## DXF (CAD floor plans)

1. Read `$INSUNITS` for the drawing unit; read the layers `WALL`, `ROOM`, `UNIT` and `TEXT`.
2. Closed `LWPOLYLINE`s become polygons; a `TEXT` or `MTEXT` inside a polygon is its unit number.
3. One file, or one layout, per floor.
4. Georeference with at least two surveyor control points (from the GNSS reader): fit a similarity transform
   (scale, rotation, translation). **Refuse if the RMS residual is 0.2 m or more.**
5. Snap the outer edges to the surveyed building footprint.
6. Compute the carpet area of each unit.
7. Output the unit polygons for surveyor verification. No identifier is minted.

## GNSS (RINEX, NMEA, control-point CSV)

1. **RINEX:** plan a PPK post-processing job against the nearest CORS base station. The job is planned, not run.
2. **NMEA:** parse the GGA sentences: fix quality (4 = RTK fixed, 5 = RTK float), HDOP and satellites in use.
3. **CSV:** read `id, lat, lon, h, σ` (σ is the one-sigma precision in metres).
4. Validate the datum: accept WGS 84 or an ITRF realisation (with epoch). For cadastral use, reject points with
   HDOP > 2 or σ > 0.10 m (they are reported, not used).
5. Transform the accepted points to the scene's `LocalFrame`.
6. Use them as ground control for DXF and IFC georeferencing, and compute residuals against parcel corners: **report
   a finding where a residual exceeds 0.3 m.**

## How it plugs in

```
web app ── POST /api/realgen/generate { polygon, datasets: [ {slot, title, name, size_bytes, format, checks, sample} ] }
              │
              ├─ ingest.json        the manifest, as before (unchanged)
              └─ ingest_plan.json   plan_for_manifest(datasets): one plan per dataset (best effort; never fails generation)

GET  /api/realgen/scenes/{key}/ingest-plan   the stored plan; derived from ingest.json for older areas; [] if none
GET  /api/ingest/formats                     every reader: formats, outputs, accuracy class, pseudo-code
POST /api/ingest/plan   { datasets: [...] }  plans for any manifest (up to 50 items)
```

All three endpoints require sign-in, and any role may read plans. A manifest carries no file bytes, so
`plan_for_manifest` dispatches on the declared format, the file extension and the slot. A CSV counts as GNSS control
only when its slot or name says so (`gnss`, `gcp`, `control`, …); the sanction-register CSV is not survey data.

Each plan has this shape:

```json
{
  "format": "LAZ", "reader": "lidar", "status": "PSEUDO_NOT_EXECUTED", "will_mint_ids": false,
  "accuracy_class": "A_SURVEY",
  "steps": [{"name": "read_header", "input": "...", "output": "...", "detail": "..."}, "..."],
  "outputs": ["..."],
  "notes": ["Pseudo-code reader: real parsing is designed but not executed in this prototype.", "..."],
  "dataset": {"slot": "lidar", "title": "LiDAR point cloud", "name": "...", "size_bytes": 290914379}
}
```

## What a real implementation would add

| Format | Library (production only; not a dependency today) |
|---|---|
| LAS / LAZ | laspy with lazrs, or PDAL |
| IFC | ifcopenshell |
| DXF | ezdxf |
| RINEX | georinex, with RTKLIB or a CORS post-processing service |
| CRS transforms | pyproj (already used by the generator for the local frame, not by the readers) |

Each reader's `plan()` already lists the steps in the order they would run, so a real `process()` would execute
those steps and write the measured evidence back to the scene, still without minting identifiers.
