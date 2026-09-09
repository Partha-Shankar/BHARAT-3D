# 07. REST & Real-Time API Specifications

---

## 🌐 1. API Architecture Overview

The BHARAT 3D platform exposes a RESTful API compliant with **OpenAPI 3.1** standards, paired with **Server-Sent Events (SSE)** for streaming long-running geospatial and AI pipeline states.

```text
Base URL: https://api.bharat3d.gov.in/api/v1
Authentication: Bearer <JWT_TOKEN>
Content-Type: application/json (or multipart/form-data for uploads)
```

---

## 🔐 2. Authentication & User Endpoints

### `POST /api/v1/auth/login`
Authenticates a user and issues a scoped JWT access token.

#### Request Body
```json
{
  "email": "surveyor.rajesh@delhi.gov.in",
  "password": "SecurePassword#2026"
}
```

#### Response `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": {
    "user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "full_name": "Rajesh Kumar",
    "role": "SURVEYOR",
    "department": "Delhi Revenue & Land Records Dept"
  }
}
```

---

## 📁 3. Project & Survey Management Endpoints

### `POST /api/v1/projects`
Creates a new 3D cadastral survey project.

#### Request Body
```json
{
  "project_name": "Urban Zone 01 - Ward 16 Survey",
  "ward_number": "Ward 16",
  "zone_name": "South Delhi Zone"
}
```

#### Response `201 Created`
```json
{
  "project_id": "a812bc45-4512-4cf2-8921-12f00a98412e",
  "project_name": "Urban Zone 01 - Ward 16 Survey",
  "status": "DRAFT",
  "dataset_version": 1,
  "created_at": "2026-09-09T10:15:00Z"
}
```

---

### `POST /api/v1/projects/{id}/area`
Sets the boundary polygon for the survey project.

#### Request Body
```json
{
  "survey_polygon": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.2085, 28.6130],
        [77.2115, 28.6130],
        [77.2115, 28.6165],
        [77.2085, 28.6165],
        [77.2085, 28.6130]
      ]
    ]
  }
}
```

---

## 📤 4. Multi-Modal Data Ingestion Endpoints

### `POST /api/v1/projects/{id}/upload`
Uploads multi-sensor and administrative dataset files (`multipart/form-data`).

#### Form Fields
* `lidar_file`: `.las` / `.laz` file
* `drone_orthomosaic`: `.tif` / `.tiff` / `.jp2`
* `gis_parcels`: `.geojson` / `.shp.zip` / `.gpkg`
* `floor_plans`: `.dxf` / `.dwg` / `.ifc`
* `gnss_points`: `.csv` / `.txt`
* `elevation_dem`: `.tif`
* `ownership_data`: *(Optional)* `.csv`
* `tax_data`: *(Optional)* `.csv`

#### Response `202 Accepted`
```json
{
  "status": "UPLOAD_SUCCESS",
  "project_id": "a812bc45-4512-4cf2-8921-12f00a98412e",
  "files_received": [
    {"name": "urban_area.las", "size_mb": 420.5, "type": "LIDAR", "status": "QUARANTINED_CLEAN"},
    {"name": "orthomosaic.tif", "size_mb": 850.2, "type": "DRONE_RASTER", "status": "QUARANTINED_CLEAN"},
    {"name": "parcels.geojson", "size_mb": 2.4, "type": "GIS_VECTOR", "status": "VALID"}
  ],
  "job_id": "job_9410284_proc"
}
```

---

## ⚡ 5. Asynchronous Processing & SSE Stream

### `POST /api/v1/projects/{id}/process`
Triggers the multi-modal AI extraction and 3D geometry pipeline.

#### Response `202 Accepted`
```json
{
  "job_id": "job_9410284_proc",
  "stream_url": "/api/v1/jobs/job_9410284_proc/stream",
  "estimated_duration_seconds": 45
}
```

---

### `GET /api/v1/jobs/{job_id}/stream` (SSE Event Stream)
Streams real-time execution steps to the client dashboard:

```text
event: progress
data: {"second": 3, "step": "VALIDATING_FILES", "progress": 8, "message": "Validating file headers & CRS integrity"}

event: progress
data: {"second": 8, "step": "NORMALIZING_CRS", "progress": 20, "message": "Normalizing projections to EPSG:4326 / EPSG:32643"}

event: progress
data: {"second": 14, "step": "PROCESSING_LIDAR", "progress": 35, "message": "Filtering ground returns and extracting bare earth DTM"}

event: progress
data: {"second": 20, "step": "EXTRACTING_BUILDINGS", "progress": 50, "message": "AI Mask R-CNN extracting orthogonalized footprints"}

event: progress
data: {"second": 26, "step": "ESTIMATING_HEIGHTS", "progress": 62, "message": "Computing 95th percentile nDSM roof elevations"}

event: progress
data: {"second": 31, "step": "INFERRING_FLOORS", "progress": 75, "message": "Inferred vertical floor segmentation (G+8)"}

event: progress
data: {"second": 36, "step": "GENERATING_VOLUMES", "progress": 85, "message": "Constructing watertight 3D Polyhedral unit meshes"}

event: progress
data: {"second": 40, "step": "TOPOLOGY_VALIDATION", "progress": 92, "message": "3D topology checked: 0 mesh leaks, 0 unit overlaps"}

event: progress
data: {"second": 43, "step": "BYLAW_ANALYSIS", "progress": 97, "message": "Zonal setback and unauthorized construction scan complete"}

event: complete
data: {"status": "SUCCESS", "progress": 100, "project_id": "a812bc45-4512-4cf2-8921-12f00a98412e", "summary": {"parcels": 127, "buildings": 64, "floors": 311, "units": 884, "tunnels": 3, "flyovers": 2, "utilities": 47}}
```

---

## 🏢 6. 3D Cadastre & Spatial Geometry Endpoints

### `GET /api/v1/projects/{id}/cadastre/3d`
Retrieves the candidate 3D cadastral model for visualization in CesiumJS and MapLibre.

#### Response `200 OK`
```json
{
  "project_id": "a812bc45-4512-4cf2-8921-12f00a98412e",
  "parcels_2d_geojson": { "type": "FeatureCollection", "features": [...] },
  "buildings": [
    {
      "building_id": "BLD-0042",
      "ulpin": "IN-DL-01-849201",
      "height_meters": 27.8,
      "floors_count": 8,
      "footprint_area_sqm": 420.5,
      "floors": [
        {
          "floor_level": 8,
          "z_min": 239.0,
          "z_max": 242.0,
          "units": [
            {
              "vprid": "VPR-849201-B01-F08-U804",
              "unit_number": "U804",
              "usage_type": "RESIDENTIAL",
              "carpet_area_sqm": 115.2,
              "volume_cum": 345.6
            }
          ]
        }
      ]
    }
  ],
  "infrastructure": [
    {
      "infra_id": "INF-TUN-DL01-0012",
      "infra_name": "Yellow Line Metro Tunnel",
      "infra_type": "TUNNEL",
      "depth_meters": -14.2,
      "operator": "DMRC"
    }
  ]
}
```

---

### `POST /api/v1/cadastre/floors/split`
Splits a floor volume into multiple discrete volumetric units in the editor.

#### Request Body
```json
{
  "building_id": "BLD-0042",
  "floor_level": 5,
  "split_count": 4,
  "unit_labels": ["U501", "U502", "U503", "U504"],
  "usage_type": "RESIDENTIAL"
}
```

#### Response `200 OK`
```json
{
  "status": "SUCCESS",
  "building_id": "BLD-0042",
  "floor_level": 5,
  "generated_vprids": [
    "VPR-849201-B01-F05-U501",
    "VPR-849201-B01-F05-U502",
    "VPR-849201-B01-F05-U503",
    "VPR-849201-B01-F05-U504"
  ]
}
```

---

### `POST /api/v1/projects/{id}/finalize`
Surveyor certification and official publication of the 3D cadastre dataset.

#### Response `200 OK`
```json
{
  "status": "CONFIRMED_AND_PUBLISHED",
  "project_id": "a812bc45-4512-4cf2-8921-12f00a98412e",
  "dataset_version": 1,
  "sha256_snapshot_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "timestamp": "2026-09-09T10:45:00Z",
  "certified_by": "Rajesh Kumar (Surveyor ID: SRV-104)",
  "total_vprids_generated": 884
}
```

---

## ⚖️ 7. Municipal Bylaws & Compliance Endpoints

### `POST /api/v1/bylaws/analyze/{building_id}`
Runs deterministic spatial tests against municipal bylaws for a specific building.

#### Response `200 OK`
```json
{
  "building_id": "BLD-0021",
  "ulpin": "IN-DL-01-849105",
  "compliance_status": "NON_COMPLIANT",
  "violations": [
    {
      "violation_type": "EXTRA_FLOORS",
      "severity": "CRITICAL",
      "permissible_floors": "G+4",
      "observed_floors": "G+6",
      "violation_magnitude": "2 unauthorized upper floors detected"
    },
    {
      "violation_type": "FRONT_SETBACK_BREACH",
      "severity": "HIGH",
      "permissible_value_meters": 6.0,
      "observed_value_meters": 3.8,
      "violation_magnitude_meters": 2.2
    },
    {
      "violation_type": "FOOTPATH_ENCROACHMENT",
      "severity": "MEDIUM",
      "encroached_area_sqm": 21.4
    }
  ]
}
```

---

## 🚧 8. Subsurface Excavation Risk API

### `POST /api/v1/excavation/analyze`
Evaluates a proposed excavation polygon and depth against all subterranean utilities and infrastructure.

#### Request Body
```json
{
  "excavation_polygon": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.2090, 28.6139],
        [77.2095, 28.6139],
        [77.2095, 28.6142],
        [77.2090, 28.6142],
        [77.2090, 28.6139]
      ]
    ]
  },
  "proposed_depth_meters": 2.0
}
```

#### Response `200 OK`
```json
{
  "risk_level": "HIGH",
  "clearance_recommendation": "EXCAVATION_PERMIT_REQUIRES_MANUAL_CLEARANCE",
  "conflicts_detected": [
    {
      "infra_id": "INF-UTL-TEL-DL01-8921",
      "infra_name": "BSNL Optical Fiber Duct",
      "infra_type": "TELECOM",
      "depth_meters": 1.4,
      "strike_type": "DIRECT_INTERSECTION",
      "warning": "Critical fiber optic backbone within excavation trench depth"
    },
    {
      "infra_id": "INF-UTL-WAT-DL01-3410",
      "infra_name": "Jal Board Water Trunk Main",
      "infra_type": "WATER",
      "depth_meters": 1.8,
      "strike_type": "WARNING_ENVELOPE_BREACH",
      "warning": "Within 0.2m of high-pressure water main safety buffer"
    },
    {
      "infra_id": "INF-TUN-DL01-0012",
      "infra_name": "Yellow Line Metro Tunnel",
      "infra_type": "TUNNEL",
      "depth_meters": 14.2,
      "strike_type": "CLEAR",
      "clearance_margin_meters": 12.2
    }
  ]
}
```

---

## 👤 9. Citizen & Privacy-Preserved Endpoints

### `GET /api/v1/citizen/my-properties`
Returns only properties registered to the authenticated citizen's national ID hash.

#### Response `200 OK`
```json
{
  "citizen_id": "CIT-78401",
  "registered_properties": [
    {
      "vprid": "VPR-849201-B01-F08-U804",
      "property_name": "Flat 804, Tower Alpha",
      "base_ulpin": "IN-DL-01-849201",
      "usage_type": "RESIDENTIAL",
      "carpet_area_sqm": 115.2,
      "ownership": {
        "title_deed": "DEED-DL-2024-0981",
        "share_percentage": 100.0,
        "registration_date": "2024-04-15"
      },
      "occupancy": {
        "status": "LEASED",
        "tenant_name": "Tech Corp Pvt Ltd",
        "lease_expiry": "2027-03-31"
      },
      "tax": {
        "annual_amount_inr": 18400,
        "status": "PAID"
      },
      "bylaw_compliance": "COMPLIANT"
    }
  ]
}
```
