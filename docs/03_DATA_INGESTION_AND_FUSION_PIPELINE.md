# 03. Data Ingestion & Multi-Modal Spatial Fusion Pipeline

---

## 📥 1. The Multi-Source Ingestion Challenge

In real-world urban land administration, spatial data does not originate from a single pristine repository. A government-grade system must ingest diverse, multi-modal datasets created by different sensors, contractors, and municipal departments at varying scales and formats:

```text
                               DATA INGESTION STACK
                               
     ┌──────────────────────┬──────────────────────┬──────────────────────┐
     │    SURFACE SENSORS   │     3D & HEIGHT      │    VECTOR & CAD      │
     ├──────────────────────┼──────────────────────┼──────────────────────┤
     │ • Drone Orthomosaics │ • Aerial LiDAR Point │ • Cadastral GIS      │
     │   (.TIF, .JP2, .JPG) │   Clouds (.LAS/.LAZ) │   (.GeoJSON, .SHP)   │
     │ • Satellite Imagery  │ • DEM / DSM / DTM    │ • CAD Floor Plans    │
     │ • Oblique Drone Pics │   Rasters (.TIF)     │   (.DXF, .DWG, .IFC) │
     └──────────────────────┴──────────────────────┴──────────────────────┘
                                      │
     ┌────────────────────────────────┴───────────────────────────────────┐
     │                GROUND CONTROL & ENRICHMENT RECORDS                 │
     ├────────────────────────────────────────────────────────────────────┤
     │ • GNSS / CORS Base-Rover Ground Control Points (.CSV, .TXT, .RNX)  │
     │ • State Land Ownership Title Records (.CSV, .XLSX, .JSON)          │
     │ • Municipal Property Assessment & Tax Roll (.CSV, .XLSX, .JSON)    │
     └────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 2. Ingestion Security & Validation Pipeline

Before any uploaded file enters the spatial processing core, it undergoes a strict multi-tier security and verification workflow to prevent corrupted data, injection attacks, and geometric anomalies from contaminating national cadastral records.

```mermaid
flowchart LR
    Upload[1. Upload Stream] --> Quarantine[2. Isolated Quarantine Zone]
    Quarantine --> AntiVirus[3. ClamAV / Malware Scan]
    AntiVirus --> MIMECheck[4. MIME & Header Magic Check]
    MIMECheck --> GeoValidation[5. Geometric & CRS Sanity Check]
    GeoValidation --> S3Store[6. Encrypted Object Storage (MinIO)]
    S3Store --> ProcessQueue[7. Worker Task Queue (Redis)]
```

### Validation Checkpoint Matrix

| Validation Phase | Tool / Engine | Purpose & Criteria |
| :--- | :--- | :--- |
| **MIME & Magic Bytes** | `python-magic` / `file-type` | Confirms file header matches extension (e.g., GeoTIFF magic `49 49 2A 00`, LAS magic `LASF`). Prevents malicious executables disguised as spatial data. |
| **File Size & Integrity** | SHA-256 Hashing | Computes cryptographic digest for non-repudiation audit trails. Enforces maximum per-file thresholds (e.g., LiDAR $\le 2\text{GB}$, Orthomosaic $\le 5\text{GB}$). |
| **LiDAR Sanity Check** | `PDAL` info / `laspy` | Validates ASPRS LAS version (1.2 to 1.4), point format record, bounding box sanity, and non-zero point count. |
| **Vector Topology** | `GDAL/OGR` / `Shapely` | Checks for self-intersecting polygons, invalid rings (`ST_IsValid`), duplicate vertices, and null geometries. |
| **Raster Georeferencing** | `Rasterio` / `GDAL` | Verifies non-empty bounding box, valid spatial transform matrix (GeoTransform), and nodata definitions. |

---

## 🌐 3. Coordinate Reference System (CRS) Normalization

A fundamental bottleneck in GIS is that different sensors operate on different spatial projections. For instance, Drone GPS uses WGS84 ellipsoidal heights, LiDAR contractors often output in local UTM projection zones, and state cadastral maps may reside in local Cassini or EPSG:7755 (India National Grid).

### Geodetic Transformation Strategy

All ingested spatial layers are automatically transformed into a standardized **Common Project Reference System**:
1. **Storage & Web Standard**: **WGS 84 (EPSG:4326)** for geographic coordinates and **Web Mercator (EPSG:3857)** for 2D/3D visual tiling.
2. **Metric Computation Standard**: **UTM Projected Coordinate Systems (EPSG:32643 / EPSG:32644 for Northern India)** where Euclidean distances, floor areas in $m^2$, and volumes in $m^3$ must be calculated without projection distortion.

```text
[Source CRS: Unknown / UTM / Local]
                 │
                 ▼
  [PROJ.4 / PyProj Spatial Engine]
                 │
  ┌──────────────┴──────────────┐
  ▼                             ▼
[EPSG:32643 / 32644]      [EPSG:4326 / 3857]
(Metric Geometric Ops)     (Web 3D Visualization)
• Exact Setback in meters  • CesiumJS 3D Tiles
• Precise Floor Area m²    • MapLibre Vector Tiles
• 3D Volumetric Buffer m³  • Standardized GeoJSON
```

### Architectural CAD / DXF Georeferencing

Architectural CAD floor plans (`.DXF` / `.DWG`) are drawn in local Cartesian space $(0, 0)$ without real-world geographic coordinates. BHARAT 3D employs **Affine Transformation with Ground Control Points (GCPs)**:

$$\begin{bmatrix} X_{\text{geo}} \\ Y_{\text{geo}} \end{bmatrix} = \begin{bmatrix} s_x \cos\theta & -s_y \sin\theta \\ s_x \sin\theta & s_y \cos\theta \end{bmatrix} \begin{bmatrix} X_{\text{cad}} \\ Y_{\text{cad}} \end{bmatrix} + \begin{bmatrix} T_x \\ T_y \end{bmatrix}$$

* Using GNSS/CORS coordinates of building corners, the system computes scale ($s$), rotation ($\theta$), and translation ($T_x, T_y$), anchoring interior floor plans directly into the cadastral building footprint.

---

## 🧩 4. Multi-Modal Spatial Data Fusion

Data fusion resolves the "multi-source evidence" problem by cross-validating disparate data sources into a unified spatial truth:

```text
              MULTI-MODAL DATA FUSION MATRIX
              
   EVIDENCE SOURCE         MEASUREMENT EXTRACTED          SPATIAL ROLE
 ┌──────────────────────┬─────────────────────────────┬──────────────────┐
 │ 2D Cadastral GIS     │ Parcel Polygon (1,250 m²)   │ Legal Ground Base│
 │ Aerial LiDAR Cloud   │ Roof Elevation (242.8m MSL) │ Vertical Height  │
 │ DEM / DTM Raster     │ Ground Elevation (215.0m)   │ Base Ground MSL  │
 │ Drone Orthomosaic    │ Roof RGB Geometry / Textures│ Visual Alignment │
 │ CAD Floor Plan       │ 8 Floors + Internal Walls   │ Unit Partitioning│
 │ GNSS Control Points  │ 4 Precise Corner Coordinates│ Geodetic Anchor  │
 └──────────────────────┴─────────────────────────────┴──────────────────┘
```

### Mathematical Fusion Formulation

1. **True Building Height ($H_{\text{bld}}$)**:
   $$H_{\text{bld}} = Z_{\text{roof}}^{\text{LiDAR}} - Z_{\text{ground}}^{\text{DTM}} = 242.8m - 215.0m = 27.8\text{ meters}$$

2. **Floor Level Alignment**:
   $$\text{Estimated Floor Height} = \frac{H_{\text{bld}}}{\text{Floor Count (from CAD/AI)}} = \frac{27.8m}{9} \approx 3.08\text{ meters/floor}$$

3. **Spatial Conflation & Footprint Reconciliation**:
   * If the LiDAR-detected building footprint deviates from the 2D Cadastral GIS layer:
   * $\text{IoU} = \frac{\text{Area}(\text{GIS} \cap \text{LiDAR})}{\text{Area}(\text{GIS} \cup \text{LiDAR})}$
   * If $\text{IoU} \ge 0.85$: Automated snap and conformal alignment.
   * If $\text{IoU} < 0.85$: Flagged for human surveyor verification (potential unauthorized ground encroachment).

---

## 🗃️ 5. Optional Enrichment Datasets

While physical 3D geometry can be extracted entirely from spatial sensors, the governance model is completed by linking administrative registers:

```text
[Spatial Unit: VPR-0042-F08-U804]
               │
      ┌────────┴────────┐
      ▼                 ▼
[Ownership CSV]    [Tax Assessment CSV]
• Owner Name       • Annual Tax Value (₹)
• Title Deed ID    • Payment Status (Paid / Arrears)
• Share Ratio      • Tax Assessment Zone / Rate
```

* **Resilience Principle**: If ownership or tax CSV files are omitted during survey ingestion, BHARAT 3D creates the full volumetric spatial registry with `Status: Unlinked/Pending Enrichment`, allowing administrative data to be attached at any future date without re-running the geometric pipeline.
