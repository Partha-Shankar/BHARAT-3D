# BHARAT 3D: Precomputed Data Pipeline & Simulation Engine

## 1. Architectural Strategy: The Precomputed Demo Engine

In a live hackathon jury presentation, executing heavy photogrammetry point cloud densification ($10^7$ LiDAR points) and 3D mesh polygonization takes **45 to 90 minutes of GPU cluster compute**. 

To deliver a **100% crash-free, sub-second, production-grade demonstration**, BHARAT 3D implements a **Deterministic Precomputed Engine** generated using Python scripts with a fixed random seed (`seed = 42`).

### Core Principle
> **The UI, API, database models, and spatial schemas are 100% production-ready. The expensive data crunching is precomputed into 10 temporal snapshot packages.**

---

## 2. The 10 Temporal Dataset Snapshots

Located in `data/demo/dataset_01/` through `data/demo/dataset_10/`:
- **`dataset_01` to `dataset_03` (Baseline v1.0)**: Initial 2D Cadastral boundary survey with coarse building heights.
- **`dataset_04` to `dataset_07` (Construction Phase v2.0)**: Introduction of the Central Urban Flyover construction and underground Metro tunneling.
- **`dataset_08` to `dataset_10` (Certified Cadastre v3.0)**: Complete 3D volumetric registry (64 buildings, 884 units, Sharma Plaza violation, subterranean metro tunnel at -14.2m).

---

## 3. The 24 Standardized Files Per Dataset

Each dataset package contains exactly 24 files:

| File Category | Files | Format | Description |
| :--- | :--- | :--- | :--- |
| **Geospatial GeoJSONs** | `parcels.geojson`, `buildings.geojson`, `floors.geojson`, `units.geojson`, `roads.geojson`, `footpaths.geojson`, `tunnels.geojson`, `flyovers.geojson`, `utilities.geojson`, `railway.geojson`, `metro.geojson`, `mall.geojson`, `infrastructure.geojson`, `violations.geojson` | GeoJSON | Complete 2D & 3D geospatial vector layers |
| **Tabular Land Rolls** | `ownership.csv`, `leases.csv`, `tax.csv`, `gnss.csv` | CSV | Citizen deeds, commercial leases, tax rolls, and survey control benchmarks |
| **Elevation Rasters** | `dem.tif`, `dsm.tif` | GeoTIFF | Digital Elevation Model & Digital Surface Model |
| **Point Cloud** | `lidar.las` | ASPRS LAS | 3D aerial LiDAR point cloud |
| **Imagery & BIM** | `drone/`, `floorplans/` | JPG / DXF | Aerial orthomosaics & architectural CAD floorplans |
| **3D Master Scene** | `3d/3d_data.json` | GeoJSON | Consolidated 3D volumetric scene streamed to map |

---

## 4. Deterministic 45-Second Processing Simulation

When the surveyor clicks **"Run 2D-to-3D Pipeline"**, the frontend streams a deterministic 45-second progress state across 16 authentic engineering stages:
1. `INGESTION`: Reading LiDAR LAS and GeoTIFF files.
2. `POINT_CLASSIFICATION`: Ground vs Non-Ground point filtering.
3. `BUILDING_EXTRACTION`: Roof plane segmentation & wall footprint extraction.
4. `FLOOR_STRATIFICATION`: Slicing vertical envelopes at 3.25m intervals.
5. `UNIT_SUBDIVISION`: Generating VPRID volumetric boundaries.
6. `SUBTERRANEAN_INTEGRATION`: Aligning -14.2m Metro tunnel with surface cadastre.
7. `VIOLATION_SCAN`: Checking measured heights against municipal sanctions.
8. `TOPOLOGY_VERIFICATION`: Ensuring 0 geometric overlaps and 0 sliver leaks.
9. `REGISTRY_CERTIFICATION`: Outputting 884 verified 3D digital deeds.
