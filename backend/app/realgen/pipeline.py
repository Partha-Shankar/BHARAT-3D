"""End-to-end generation: survey polygon -> SceneSpec JSON (local metres, origin at polygon centroid)."""
import logging
import time
from typing import Any, Callable, Dict, List, Optional

from shapely.geometry import Polygon, box

from app.realgen import ai_buildings, cache, fetch_osm, imagery, llm, ml_heights, scene_ops, synth, terrain
from app.realgen.fuse import FLOOR_HEIGHT_M, ai_building, apply_context_defaults, measure_buildings
from app.realgen.geo import (MAX_AREA_M2, MIN_AREA_M2, LocalFrame, line_coords, polygon_from_geojson,
                             polygon_key, ring_coords, stable_int)

logger = logging.getLogger(__name__)
SCENE_VERSION = 5
MARGIN_DEG = 0.0004  # ~40 m of full-detail context around the survey boundary
CONTEXT_DEG = 0.008  # ~800 m lower-resolution imagery ring so the city continues to the horizon

STAGES = [
    "Resolving locality",
    "Fetching OpenStreetMap features",
    "Fetching terrain elevation",
    "Fetching satellite imagery",
    "Measuring building footprints & heights",
    "Detecting unmapped buildings in imagery (GeoAI + GroundingDINO/SAM)",
    "AI height estimation (Depth Anything V2)",
    "Building road, rail & flyover network",
    "Delineating parcels & 3D identities",
    "Running compliance checks",
    "Modelling subsurface assets",
    "Naming & summarising (Groq LLM)",
    "Assembling 3D scene",
]

ProgressFn = Callable[[int, str, str], None]


class AreaError(ValueError):
    pass


def validate_area(poly_ll: Polygon) -> float:
    frame = LocalFrame.for_polygon(poly_ll)
    area = frame.to_local(poly_ll).area
    if area > MAX_AREA_M2:
        raise AreaError(f"Survey area is {area / 1e6:.2f} km²; the limit is {MAX_AREA_M2 / 1e6:.1f} km².")
    if area < MIN_AREA_M2:
        raise AreaError(f"Survey area is {area:.0f} m²; draw at least {MIN_AREA_M2:.0f} m².")
    return area


def generate(polygon_geojson: Any, progress: Optional[ProgressFn] = None, force: bool = False) -> Dict[str, Any]:
    poly_ll = polygon_from_geojson(polygon_geojson)
    area_m2 = validate_area(poly_ll)
    key = polygon_key(poly_ll)
    report = progress or (lambda i, s, d: None)

    cached = cache.read_json(key, "scene.json")
    if cached and not force and cached.get("version") == SCENE_VERSION:
        report(len(STAGES), "Loaded cached scene", key)
        return cached
    base_cached = cache.read_json(key, "scene_base.json")
    if base_cached and not force and base_cached.get("version") == SCENE_VERSION:
        report(len(STAGES), "Rebuilt from cached base scene", key)
        return scene_ops.rebuild(key)

    t0 = time.time()
    timings: Dict[str, float] = {}

    def stage(i: int, detail: str = ""):
        report(i, STAGES[i], detail)
        timings[STAGES[i]] = round(time.time() - t0, 1)

    frame = LocalFrame.for_polygon(poly_ll)
    survey_local = frame.to_local(poly_ll)
    seed = stable_int(key)
    bbox = (poly_ll.bounds[0] - MARGIN_DEG, poly_ll.bounds[1] - MARGIN_DEG,
            poly_ll.bounds[2] + MARGIN_DEG, poly_ll.bounds[3] + MARGIN_DEG)
    sw = frame.point_to_local(bbox[0], bbox[1])
    ne = frame.point_to_local(bbox[2], bbox[3])
    extent_local = (sw[0], sw[1], ne[0], ne[1])
    extent_poly = box(*extent_local)

    stage(0)
    place = fetch_osm.reverse_geocode(poly_ll.centroid.x, poly_ll.centroid.y)
    if place.get("country_code") and place["country_code"] != "in":
        raise AreaError("BHARAT 3D works only inside India.")

    # Raw OSM is cached per polygon: re-runs are reproducible and do not depend on Overpass rate limits.
    raw_osm = cache.read_json(key, "osm_raw.json")
    if raw_osm is None:
        stage(1, "Overpass API")
        raw_osm = fetch_osm.fetch_overpass(Polygon(box(*bbox).exterior.coords))
        cache.write_json(key, "osm_raw.json", raw_osm)
    else:
        stage(1, f"cached snapshot of {raw_osm.get('osm3s', {}).get('timestamp_osm_base', 'earlier fetch')}")
    osm = fetch_osm.parse_elements(raw_osm)

    stage(2, "AWS Terrain Tiles")
    dem = terrain.fetch_dem(bbox)
    ground = terrain.build_grid(dem, extent_local)

    stage(3, "Esri World Imagery")
    img = imagery.fetch_imagery(bbox, cache.file_path(key, "texture.jpg"))
    ctx_bbox = (bbox[0] - CONTEXT_DEG, bbox[1] - CONTEXT_DEG, bbox[2] + CONTEXT_DEG, bbox[3] + CONTEXT_DEG)
    ctx = imagery.fetch_imagery(ctx_bbox, cache.file_path(key, "context.jpg"))
    ctx.pop("array", None)
    csw = frame.point_to_local(ctx_bbox[0], ctx_bbox[1])
    cne = frame.point_to_local(ctx_bbox[2], ctx_bbox[3])
    ctx_extent = [round(csw[0], 2), round(csw[1], 2), round(cne[0], 2), round(cne[1], 2)]

    stage(4, f"{len(osm['buildings'])} OSM building records")
    buildings = measure_buildings(osm["buildings"], poly_ll, frame)
    buildings.sort(key=lambda b: b["osm_id"])

    # Buildings visible in the imagery but missing from OSM (pretrained models); they stay proposals until verified.
    ai_ok, ai_why = ai_buildings.available()
    stage(5, "GeoAI Mask R-CNN at 0.6 / 0.4 / 0.3 m, then GroundingDINO + SAM" if ai_ok else ai_why)
    found, ai_report = ai_buildings.detect(img["array"], extent_local, survey_local, [b["geom"] for b in buildings],
                                           progress=lambda d: report(5, STAGES[5], d))
    buildings += [ai_building(f["geom"], f["score"], f["method"]) for f in found]
    for i, b in enumerate(buildings, 1):  # OSM first (stable order), AI-detected after
        b["id"] = f"BLD-{i:04d}"
    apply_context_defaults(buildings, survey_local.area)

    stage(6, ml_heights.MODEL_ID if ml_heights.available() else "model not installed — skipped")
    ml_report = ml_heights.estimate_heights(buildings, img.pop("array"), extent_local)

    stage(7)
    roads, road_tunnels = synth.build_roads(osm["roads"], frame, extent_poly)
    rail, rail_underground = synth.build_railways(osm["railways"], frame, extent_poly)

    stage(8)
    parcels = synth.build_parcels(buildings, roads, survey_local, place.get("state_code", "XX"), seed)
    parcel_of = {p["id"]: p for p in parcels}
    for b in buildings:
        b["units_per_floor"] = synth.units_per_floor(b["geom"].area, b["usage"])
        b["block_no"] = parcel_of[b["parcel_id"]]["building_ids"].index(b["id"]) + 1

    stage(9)
    synth.apply_sanctions(buildings)
    sites = synth.construction_sites(osm["construction"], buildings, frame, survey_local)

    stage(10)
    subsurface = synth.build_subsurface(buildings, roads, osm["power"], osm["pipelines"], frame, extent_poly,
                                        road_tunnels + rail_underground, seed, place.get("city") or "")

    stats = {
        "area_m2": round(area_m2),
        "buildings": len(buildings),
        "floors": sum(b["floors"] for b in buildings),
        "volumetric_units": sum(b["floors"] * b["units_per_floor"] for b in buildings),
        "parcels": len(parcels),
        "roads": len(roads),
        "subsurface_assets": len(subsurface),
        "violations": 0,
    }

    stage(11)
    text = llm.enrich(buildings, place, stats, seed)
    for b in buildings:
        if not b["name"]:
            b["name"] = text["names"].get(b["id"], b["id"])
            b["name_source"] = text["llm"]["provider"]
        else:
            b["name_source"] = "osm"
    names = {b["id"]: b["name"] for b in buildings}
    for a in subsurface:
        if a["kind"] == "basement" and a.get("building_id") in names:
            levels = next(b["basement_levels"] for b in buildings if b["id"] == a["building_id"])
            a["name"] = f"Basement parking ({levels} level{'s' if levels > 1 else ''}) — {names[a['building_id']]}"

    stage(12)
    by_height_source: Dict[str, int] = {}
    for b in buildings:
        by_height_source[b["height_source"]] = by_height_source.get(b["height_source"], 0) + 1
    stats.update({
        "height_sources": by_height_source,
        "subsurface_by_source": {s: sum(1 for a in subsurface if a["source"] == s) for s in ("osm", "synthetic")},
        "ml": ml_report,
        "ai_buildings": ai_report,
        "llm": text["llm"],
        "timings_s": timings,
    })

    scene = {
        "version": SCENE_VERSION,
        "key": key,
        "place": place,
        "summary": text["summary"],
        "origin": {"lon": frame.lon0, "lat": frame.lat0},
        "survey_polygon": {"lonlat": [list(p) for p in poly_ll.exterior.coords], "local": ring_coords(survey_local)},
        "extent": [round(v, 2) for v in extent_local],
        "terrain": ground,
        "texture": {"url": f"/api/realgen/scenes/{key}/texture.jpg", "zoom": img["zoom"],
                    "width": img["width"], "height": img["height"], "attribution": img["attribution"]},
        "context_texture": {"url": f"/api/realgen/scenes/{key}/context.jpg", "extent": ctx_extent, "zoom": ctx["zoom"]},
        "buildings": [_building_out(b, ground) for b in buildings],
        "parcels": [{"id": p["id"], "ulpin": p["ulpin"], "footprint": ring_coords(p["geom"]),
                     "area_m2": round(p["geom"].area, 1), "building_ids": p["building_ids"], "source": "synthetic",
                     "identity": "2D" if not p["building_ids"] else "parent", "kind": p.get("kind", "built")}
                    for p in parcels if p["geom"].geom_type == "Polygon"],
        "roads": roads,
        "railways": rail,
        "water": _simple_features(osm["water"], frame, extent_poly, "water"),
        "green": _simple_features(osm["green"], frame, extent_poly, "green"),
        "trees": [{"x": round(x, 1), "y": round(y, 1)} for x, y in
                  (frame.point_to_local(t["geom"].x, t["geom"].y) for t in osm["trees"])][:1500],
        "stations": [{"name": s["tags"].get("name", "Station"), "kind": s["tags"].get("railway") or s["tags"].get("public_transport"),
                      "x": round(frame.point_to_local(s["geom"].x, s["geom"].y)[0], 1),
                      "y": round(frame.point_to_local(s["geom"].x, s["geom"].y)[1], 1)} for s in osm["stations"]],
        "subsurface": subsurface,
        "construction_sites": sites,
        "violations": [],
        "stats": stats,
        "sources": [
            {"layer": "Building footprints, roads, rail, water, tunnels", "source": "© OpenStreetMap contributors (ODbL), via Overpass API", "kind": "real"},
            {"layer": "Terrain", "source": ground["source"], "kind": "real"},
            {"layer": "Ground texture", "source": img["attribution"], "kind": "real"},
            *([{"layer": "Unmapped building footprints", "source": f"AI-detected in the imagery ({ai_report.get('added', 0)}): GeoAI Mask R-CNN + GroundingDINO/SAM; proposals until a surveyor verifies them", "kind": "estimated"}] if ai_report.get("added") else []),
            {"layer": "Untagged building heights", "source": f"{ml_heights.MODEL_ID} (calibrated) or typology defaults", "kind": "estimated"},
            {"layer": "Parcels, ULPIN/VPRID, sanctions, owners, most utilities", "source": "Deterministic synthesis from polygon seed", "kind": "synthetic"},
            {"layer": "Building names & summary", "source": f"{text['llm']['provider']} {text['llm'].get('model') or ''}".strip(), "kind": "synthetic"},
        ],
        "generated_in_s": round(time.time() - t0, 1),
    }
    cache.write_json(key, "scene_base.json", scene)
    return scene_ops.rebuild(key)  # applies any surveyor edits, then findings + VPRID registry


def _building_out(b: Dict[str, Any], ground: Dict[str, Any]) -> Dict[str, Any]:
    c = b["geom"].centroid
    return {
        "id": b["id"], "osm_id": b["osm_id"], "name": b["name"], "name_source": b.get("name_source", "osm"),
        "building_type": b["building_type"], "usage": b["usage"],
        "footprint": ring_coords(b["geom"]), "centroid": [round(c.x, 2), round(c.y, 2)],
        "area_m2": round(b["geom"].area, 1), "base_z": terrain.height_at(ground, c.x, c.y),
        "min_height": b["min_height"], "height": b["height"], "floors": b["floors"], "floor_height": FLOOR_HEIGHT_M,
        "height_source": b["height_source"], "footprint_source": b["footprint_source"], "roof_shape": b["roof_shape"],
        "sanctioned_floors": b["sanctioned_floors"], "sanctioned_height": b["sanctioned_height"],
        "sanction_status": b["sanction_status"], "permit_no": b["permit_no"], "block_no": b.get("block_no", 1),
        "under_construction": bool(b.get("under_construction")),
        "parcel_id": b.get("parcel_id"), "ulpin": b.get("ulpin"), "units_per_floor": b["units_per_floor"],
        "basement_levels": b.get("basement_levels", 0), "violation_ids": b.get("violation_ids", []),
        "footpath_encroachment_m2": b.get("footpath_encroachment_m2", 0.0), "seed": b["seed"],
        **({"ai_score": b["ai_score"]} if "ai_score" in b else {}),
    }


def _simple_features(records, frame: LocalFrame, extent_poly: Polygon, kind: str) -> List[Dict[str, Any]]:
    out = []
    for rec in records:
        g = frame.to_local(rec["geom"]).intersection(extent_poly)
        if g.is_empty:
            continue
        parts = [g] if g.geom_type in ("Polygon", "LineString") else list(getattr(g, "geoms", []))
        for part in parts:
            if part.geom_type == "Polygon" and part.area > 4:
                out.append({"id": rec["osm_id"], "kind": kind, "polygon": ring_coords(part), "source": "osm"})
            elif part.geom_type == "LineString" and part.length > 2:
                out.append({"id": rec["osm_id"], "kind": kind, "path": line_coords(part), "source": "osm"})
    return out


def building_detail(scene: Dict[str, Any], building_id: str) -> Optional[Dict[str, Any]]:
    return scene_ops.building_detail(scene, building_id)
