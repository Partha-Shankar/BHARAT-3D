# BHARAT 3D Documentation Builder
import os

DOCS_DIR = os.path.abspath('actual_docs')
os.makedirs(DOCS_DIR, exist_ok=True)

def write_doc(filename, content):
    path = os.path.join(DOCS_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')
    print('Generated:', filename)

# -----------------------------------------------------------------------------
# 01_OVERALL_SYSTEM_ARCHITECTURE.md
# -----------------------------------------------------------------------------
write_doc('01_OVERALL_SYSTEM_ARCHITECTURE.md', """# BHARAT 3D: Overall System Architecture & Engineering Blueprint

**Project Name:** BHARAT 3D  
**Tagline:** 2D-to-3D Spatial Property & Infrastructure Registry  
**Category:** Government Geospatial Intelligence / Cadastral Modernization  

---

## 1. Executive Summary & Problem Context

Traditional land administration systems across India and global cadastres are fundamentally **two-dimensional (2D)**. A 2D cadastral parcel representation records a polygonal boundary on a horizontal plane (e.g., ULPIN - Unique Land Parcel Identification Number, also known as the *Bhu-Aadhaar*). 

In modern, dense urban environments, real estate and municipal infrastructure extend significantly in the **vertical dimension**:
- **High-rise residential towers**: 12-storey condominiums containing 48 distinct homeowners on a single 1,200 sq.m land parcel.
- **Multi-level commercial complexes**: Shopping malls and office hubs with vertically stratified commercial leases.
- **Elevated civil infrastructure**: Flyovers, elevated metro rail viaducts, skywalks.
- **Subsurface / Subterranean infrastructure**: Underground metro transit tunnels (-14.2m MSL), subsurface vehicular tunnels (-8.5m MSL), multi-level basement parking (-6.0m MSL), and subterranean power/water/gas utility networks (-2.5m to -4.5m).

### The Critical Core Principle
> **"Keep India's existing 2D cadastral/ULPIN system as the foundation, and add a 3D spatial layer only where property or infrastructure has meaningful vertical extent."**

BHARAT 3D **does not** turn flat roads, empty agricultural plots, or vacant rural fields into heavy 3D meshes. 2D remains the legal and spatial foundation. 3D volumetric parcels (VPRIDs) are created **selectively and deterministically** for vertically stratified buildings, elevated flyovers, and subterranean tunnels.

---

## 2. High-Level System Architecture Diagram

```
 +-----------------------------------------------------------------------------------+
 |                             USER INTERACTION TIER                                 |
 |  [Surveyor Studio]   [Municipality Enforcement]  [Utility Desk]   [Citizen Portal]|
 +------------------------------------------+----------------------------------------+
                                            |
                                            | REST API / JSON Streaming / WebSocket
                                            v
 +-----------------------------------------------------------------------------------+
 |                              APPLICATION API TIER                                 |
 |                          (FastAPI / Python 3.11 / Async)                          |
 |                                                                                   |
 |  +--------------------+  +--------------------+  +------------------------------+ |
 |  | Auth & RBAC Engine |  | Project & Datasets |  | 3D Spatial Geometry Engine   | |
 |  +--------------------+  +--------------------+  +------------------------------+ |
 |  | Telemetry & Jobs   |  | Violation Detector |  | 3D Excavation Clash Engine   | |
 |  +--------------------+  +--------------------+  +------------------------------+ |
 |  | Audit & Compliance |  | Citizen Registry   |  | Human-in-the-Loop 3D Editor  | |
 |  +--------------------+  +--------------------+  +------------------------------+ |
 +------------------------------------------+----------------------------------------+
                                            |
                                            | Async ORM / Spatial SQL Queries
                                            v
 +-----------------------------------------------------------------------------------+
 |                                DATA PERSISTENCE TIER                              |
 |   +---------------------------------------------------------------------------+   |
 |   | SQLite Database (Embedded Development) / PostGIS Spatial Database (Prod) |   |
 |   | - Parcels (2D ULPIN)          - Buildings (3D Envelopes)                  |   |
 |   | - Vertical Floors (3D Slabs)  - Vertical Property Units (3D VPRIDs)       |   |
 |   | - Subsurface Tunnels          - Elevated Flyovers & Infrastructure        |   |
 |   | - Violations & Penalties      - Excavation Clearances & Utility Permits   |   |
 |   +---------------------------------------------------------------------------+   |
 |   +---------------------------------------------------------------------------+   |
 |   | File System & Point Cloud Storage:                                        |   |
 |   | - 10 Precomputed Demo Datasets (Temporal Snapshots v1.0 -> v3.0)          |   |
 |   | - Raw GeoJSONs, LiDAR LAS, DEM/DSM GeoTIFFs, Drone Orthomosaics           |   |
 |   +---------------------------------------------------------------------------+   |
 +-----------------------------------------------------------------------------------+
```

---

## 3. Four Core Stakeholder Personas & Workflows

### 3.1. Surveyor & Geospatial Engineer
- Delineates survey boundary polygon (Ward 16 Central Urban Zone).
- Ingests raw survey packages (LiDAR point clouds, drone photogrammetry, cadastral shapefiles, floorplans).
- Triggers automated 16-stage 2D-to-3D volumetric reconstruction pipeline.
- Uses Human-in-the-Loop 3D Editor to split floor slabs into units, modify boundaries, and certify cadastre into 884 VPRIDs.

### 3.2. Municipal Corporation Authority (Town Planning & Enforcement)
- Inspects building envelopes against sanctioned architectural drawings.
- Flags vertical violations (e.g. Sharma Plaza: Sanctioned G+4, measured G+6 -> 2 unauthorized floors in warning RED).
- Issues automated digital demolition/regularization notices and recalculates municipal property tax rolls (+₹42,000/year per illegal floor).

### 3.3. Utility Operator (Excavation Clearance & Clash Prevention)
- Simulates proposed excavation trenches and underground utility lines.
- Performs 3D cylinder buffer clash detection against subterranean metro tunnels (-14.2m MSL), road tunnels (-8.5m MSL), and basement parking (-6.0m MSL).
- Automatically approves compliant projects and issues cryptographically signed Digital Digging NOCs.

### 3.4. Property Owner & Citizen
- Searches 3D property records using Base ULPIN (`IN-DEMO-0042`) or Unit VPRID (`VPR-BLD001-F08-U04`).
- Visualizes apartment unit in true 3D space with verified floor height, ceiling height, volume (345.6 m3), and carpet area (115.2 m2).
- Accesses chain-of-custody title deeds, pays municipal property tax online, and downloads certified digital 3D property ownership cards.

---

## 4. Key Architectural Design Decisions

| Architectural Component | Decision / Technology | Technical Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite + TypeScript | Blazing fast rendering, deterministic typing, and instant sub-second Hot Module Replacement (HMR). |
| **2D/3D Map Viewport** | MapLibre GL JS (`fill-extrusion`) | Native GPU-accelerated 3D polygon extrusions with variable `base_height` and `height` without heavy external runtime plugins. |
| **3D Exploded BIM Engine** | Three.js (`WebGLRenderer`) | Smooth 360° orbital rotation, vertical floor slab explosion slider (0-100%), window transparencies, and cross-section inspection. |
| **Backend Framework** | FastAPI (Python 3.11 Async) | High-performance asynchronous REST endpoints, auto-generated OpenAPI/Swagger documentation, and Pydantic validation. |
| **State Management** | Zustand | Lightweight, zero-boilerplate global state management for active persona, map mode, and selected 3D entities. |
| **Data Engine** | Deterministic Precomputation (Seed 42) | Guarantees 100% crash-free, sub-second response times during live hackathon demos while strictly preserving production data schemas. |
""")

# -----------------------------------------------------------------------------
# 02_FRONTEND_ARCHITECTURE.md
# -----------------------------------------------------------------------------
write_doc('02_FRONTEND_ARCHITECTURE.md', """# BHARAT 3D: Frontend Architecture & UI Component Design

## 1. Overview & Technology Stack

The BHARAT 3D frontend is built as a single-page application (SPA) optimized for government geospatial professionals, municipal town planners, utility engineers, and citizens.

- **Core Framework:** React 18.3.1
- **Build Tool:** Vite 5.3.1 (Sub-second HMR, optimized production rollup chunks)
- **Language:** TypeScript 5.4.5 (Strict type-checking across all schemas)
- **Styling:** TailwindCSS 3.4.4 + Lucide React Icons
- **State Management:** Zustand 4.5.2
- **Data Fetching:** Axios + TanStack React Query v5
- **Mapping & 3D:** MapLibre GL JS 4.3.2 + Three.js

---

## 2. Directory Structure

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Global persona switcher, connection HUD, notifications
│   │   ├── Sidebar.tsx          # Dynamic role-based navigation links
│   │   └── MainLayout.tsx       # Standard shell container
│   ├── map/
│   │   ├── Map2D.tsx            # High-performance MapLibre 3D GIS viewport
│   │   └── Map3D.tsx            # Three.js 3D Exploded BIM Floor & Subsurface Viewer
│   └── ui/
│       ├── Button.tsx           # Standardized button variants (primary, accent, outline, danger)
│       ├── Card.tsx             # Surface containers with subtle borders & elevation
│       └── Badge.tsx            # Status pills (Sanctioned, Violation, Certified, Leased)
├── lib/
│   ├── api.ts                  # Axios client configured with base URL and JWT interceptor
│   └── auth.ts                 # Local storage token and user session persistence
├── stores/
│   ├── appStore.ts             # Global map mode, active project ID, selected entity
│   └── authStore.ts            # Authenticated user persona, permissions, login/logout
└── pages/
    ├── auth/LoginPage.tsx       # Role-based 1-click persona login
    ├── surveyor/                # Surveyor workflow pages (Area, Upload, Processing, Map, Editor)
    ├── municipality/            # Municipality dashboards (Violations, Approvals, Notices)
    ├── utility/                 # Utility operator (Excavation Clash Detector, NOC Generator)
    └── citizen/                 # Citizen property deed portal & tax payments
```

---

## 3. Global State Management (Zustand)

The application maintains two primary Zustand stores:

### 3.1. `authStore.ts`
Manages the active persona authentication session. Supports 4 personas:
- `surveyor` (`survey@bharat3d.demo` / `demo2026`)
- `municipality` (`municipality@bharat3d.demo` / `demo2026`)
- `utility` (`utility@bharat3d.demo` / `demo2026`)
- `citizen` (`citizen@bharat3d.demo` / `demo2026`)

### 3.2. `appStore.ts`
Manages global GIS viewport modes and active selections:
- `mapMode`: `'2d' | '3d' | 'underground' | 'hybrid'`
- `selectedProjectId`: Default `'proj-001'`
- `selectedEntity`: Active building, floor, or subterranean asset metadata.

---

## 4. UI Design System & Government-Grade Aesthetics

1. **Color Palette**:
   - Deep Navy Slate (`bg-slate-900`, `bg-slate-950`): High-contrast dark backgrounds for 3D map HUDs and BIM viewports.
   - Government Blue (`#2563EB` / `#1D4ED8`): Compliant residential towers (Aarav Heights).
   - Commercial Indigo (`#4F46E5`): Commercial properties (Civic Grand Mall).
   - Subterranean Cyan (`#06B6D4`): Underground metro tunnels and subsurface infrastructure.
   - Infrastructure Orange (`#EA580C`): Elevated flyover decks.
   - Warning Red (`#DC2626`): Unsanctioned extra floors and critical municipal violations.
2. **Typography & HUDs**:
   - Monospace numeric telemetry: Live pitch/yaw degrees (`65° Pitch • -25° Yaw`), exact MSL elevations (`+39.0m MSL`, `-14.2m BGL`), and ULPIN hashes.
""")

# -----------------------------------------------------------------------------
# 03_BACKEND_ARCHITECTURE.md
# -----------------------------------------------------------------------------
write_doc('03_BACKEND_ARCHITECTURE.md', """# BHARAT 3D: Backend Architecture & REST API Specification

## 1. Overview & Technology Stack

The BHARAT 3D backend is a high-performance Python application built on **FastAPI** and **SQLAlchemy Asyncio**, providing sub-second geospatial query responses, background job telemetry, violation analysis, and excavation clash detection.

- **Framework:** FastAPI 0.111.0
- **ASGI Server:** Uvicorn 0.30.1 with auto-reload
- **Database ORM:** SQLAlchemy 2.0 (Asyncio)
- **Data Serialization:** Pydantic v2 + ORJSON (Ultra-fast JSON serialization)
- **Authentication:** JWT (JSON Web Tokens) with Argon2 / bcrypt password hashing
- **File I/O:** `aiofiles` for asynchronous upload handling

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py              # User authentication, token issuance, persona switching
│   │   ├── projects.py          # Project management, survey area, dataset uploads, 3D GeoJSON
│   │   ├── jobs.py              # Background job status & telemetry event stream
│   │   ├── buildings.py         # 3D building envelopes & vertical floor hierarchies
│   │   ├── units.py             # Volumetric Property Units (VPRIDs) & deed lookups
│   │   ├── violations.py        # Municipal vertical & setback violation detection
│   │   ├── infrastructure.py    # Subsurface tunnels, flyovers, metro lines
│   │   ├── excavation.py        # 3D excavation simulation & clash detection NOC
│   │   ├── citizen.py           # Citizen property search & tax roll settlement
│   │   └── audit.py             # Blockchain/immutable audit log verification
│   ├── core/
│   │   ├── config.py            # Environment settings (Pydantic BaseSettings)
│   │   ├── database.py          # Async SQLAlchemy engine & session factory
│   │   └── deps.py              # Dependency injection (get_db, get_current_user)
│   ├── models/
│   │   └── models.py            # SQLAlchemy database models
│   ├── schemas/
│   │   └── schemas.py           # Pydantic request/response schemas
│   ├── services/
│   │   ├── processing_service.py # 16-stage deterministic processing job pipeline
│   │   └── spatial_service.py    # 3D GeoJSON streaming & registry statistics
│   └── main.py                  # FastAPI application entrypoint & middleware
└── requirements.txt             # Python dependencies
```

---

## 3. Core REST API Endpoints

### 3.1. Authentication (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate persona with email & password, returns JWT token |
| `GET` | `/api/auth/me` | Fetch current authenticated user session |

### 3.2. Projects & 3D Spatial Layers (`/api/projects`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects` | List all cadastral survey projects |
| `GET` | `/api/projects/{id}` | Retrieve specific project details |
| `POST` | `/api/projects/{id}/area` | Save survey delineation boundary polygon |
| `POST` | `/api/projects/{id}/process` | Trigger 16-stage 2D-to-3D volumetric processing pipeline |
| `GET` | `/api/projects/{id}/3d` | Stream 3D FeatureCollection GeoJSON with heights & subsurface depths |
| `GET` | `/api/projects/{id}/registry` | Fetch certified registry statistics (134 parcels, 64 blds, 884 units) |
| `POST` | `/api/projects/{id}/finalize` | Certify and publish 3D cadastral registry snapshot |

### 3.3. Violations & Municipal Enforcement (`/api/violations`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/violations` | List all flagged municipal non-compliance violations |
| `POST` | `/api/violations/{id}/notice` | Generate digital municipal violation notice & tax surcharge |

### 3.4. Utility Excavation Clash Detection (`/api/excavation`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/excavation/check-clash` | Run 3D buffer clash analysis on proposed trench line |
| `POST` | `/api/excavation/apply-permit` | Issue certified Digital Excavation NOC |

### 3.5. Citizen Registry (`/api/citizen`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/citizen/property/{ulpin}` | Search property by ULPIN or VPRID |
| `POST` | `/api/citizen/pay-tax` | Settle municipal property tax dues online |
""")

# -----------------------------------------------------------------------------
# 04_DATABASE_SCHEMA_AND_MODELS.md
# -----------------------------------------------------------------------------
write_doc('04_DATABASE_SCHEMA_AND_MODELS.md', """# BHARAT 3D: Database Schema & Entity-Relationship Architecture

## 1. Overview

BHARAT 3D implements a relational geospatial data model designed to support both standard 2D cadastral records (parcels, roads, owners) and vertically stratified 3D real estate (floors, units, subterranean tunnels, elevated flyovers).

---

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    PROJECT ||--o{ DATASET : contains
    PROJECT ||--o{ PARCEL : contains
    PROJECT ||--o{ INFRASTRUCTURE : contains
    PROJECT ||--o{ JOB : tracks
    PARCEL ||--o{ BUILDING : hosts
    BUILDING ||--o{ VERTICAL_FLOOR : contains
    VERTICAL_FLOOR ||--o{ VERTICAL_UNIT : contains
    BUILDING ||--o{ VIOLATION : flags
    VERTICAL_UNIT ||--o{ TAX_RECORD : assesses
    INFRASTRUCTURE ||--o{ EXCAVATION_PERMIT : evaluates
```

---

## 3. Database Table Definitions

### 3.1. `parcels` (2D Cadastral Base Layer)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Internal parcel identifier |
| `ulpin` | VARCHAR(32) | UNIQUE, NOT NULL, INDEX | Unique Land Parcel ID (Bhu-Aadhaar) |
| `project_id` | INTEGER | FOREIGN KEY (`projects.id`) | Associated survey project |
| `ward_number` | VARCHAR(16) | NOT NULL | Municipal administrative ward |
| `area_sqm` | FLOAT | NOT NULL | 2D horizontal plot area ($m^2$) |
| `geometry_geojson` | TEXT | NOT NULL | 2D Polygon in EPSG:4326 GeoJSON |
| `land_use` | VARCHAR(32) | NOT NULL | `RESIDENTIAL`, `COMMERCIAL`, `PUBLIC` |

### 3.2. `buildings` (3D Volumetric Envelopes)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(32) | PRIMARY KEY | Building ID (e.g. `BLD-001`) |
| `parcel_ulpin` | VARCHAR(32) | FOREIGN KEY (`parcels.ulpin`) | Base land parcel ULPIN |
| `name` | VARCHAR(128) | NOT NULL | Building name (e.g. Aarav Heights) |
| `total_floors` | INTEGER | NOT NULL | Total above-ground floors |
| `height_meters` | FLOAT | NOT NULL | Total measured vertical height ($m$) |
| `elevation_base` | FLOAT | NOT NULL | Base elevation in meters MSL |
| `footprint_geojson`| TEXT | NOT NULL | Ground footprint polygon |
| `building_type` | VARCHAR(32) | NOT NULL | `RESIDENTIAL`, `COMMERCIAL`, `MIXED` |

### 3.3. `vertical_floors` (3D Floor Slabs)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(32) | PRIMARY KEY | Floor ID (e.g. `BLD001-F08`) |
| `building_id` | VARCHAR(32) | FOREIGN KEY (`buildings.id`) | Parent building |
| `floor_number` | INTEGER | NOT NULL | Sequential floor index (1 to $N$) |
| `base_elevation`| FLOAT | NOT NULL | Base height above ground ($m$) |
| `top_elevation` | FLOAT | NOT NULL | Top height above ground ($m$) |
| `unit_count` | INTEGER | NOT NULL | Number of subdivided units |

### 3.4. `vertical_units` (3D Property Units - VPRIDs)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `vprid` | VARCHAR(64) | PRIMARY KEY, INDEX | Volumetric Property ID (`VPR-BLD001-F08-U04`) |
| `floor_id` | VARCHAR(32) | FOREIGN KEY (`vertical_floors.id`) | Parent floor |
| `unit_number` | VARCHAR(16) | NOT NULL | Flat / suite number (`804`) |
| `carpet_area` | FLOAT | NOT NULL | Internal carpet area ($m^2$) |
| `volume_m3` | FLOAT | NOT NULL | 3D volumetric space ($m^3$) |
| `owner_name` | VARCHAR(128) | NOT NULL | Registered title owner |
| `deed_number` | VARCHAR(64) | NOT NULL | Registered title deed ID |
| `tax_annual` | FLOAT | NOT NULL | Annual municipal property tax ($₹$) |

### 3.5. `infrastructure_assets` (Subsurface Tunnels & Flyovers)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(32) | PRIMARY KEY | Asset ID (e.g. `TNL-002`, `FLY-001`) |
| `name` | VARCHAR(128) | NOT NULL | Infrastructure name |
| `asset_type` | VARCHAR(32) | NOT NULL | `TUNNEL`, `FLYOVER`, `METRO`, `PARKING` |
| `depth_base_msl`| FLOAT | NOT NULL | Z-Elevation in meters MSL |
| `clearance_radius`| FLOAT | NOT NULL | Safety buffer radius ($m$) |
| `geometry_geojson`| TEXT | NOT NULL | 3D centerline / tube geometry |
""")

# -----------------------------------------------------------------------------
# 05_PRECOMPUTED_DATA_AND_SIMULATION_ENGINE.md
# -----------------------------------------------------------------------------
write_doc('05_PRECOMPUTED_DATA_AND_SIMULATION_ENGINE.md', """# BHARAT 3D: Precomputed Data Pipeline & Simulation Engine

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
""")

# -----------------------------------------------------------------------------
# 06_3D_GIS_AND_SUBTERRANEAN_VISUALIZATION.md
# -----------------------------------------------------------------------------
write_doc('06_3D_GIS_AND_SUBTERRANEAN_VISUALIZATION.md', r"""# BHARAT 3D: 3D GIS & Subterranean Visualization Engine

## 1. MapLibre GL JS 3D Extrusion Engine

BHARAT 3D uses **MapLibre GL JS** with GPU-accelerated `fill-extrusion` layers to render true 3D volumetric structures directly in the browser canvas.

### 1.1. Dynamic Extrusion Properties
```javascript
map.addLayer({
  id: 'cadastre-buildings-3d',
  type: 'fill-extrusion',
  source: 'cadastre-3d-data',
  paint: {
    'fill-extrusion-color': [
      'case',
      ['==', ['get', 'entity_type'], 'violation'], '#DC2626', // Red violation
      ['==', ['get', 'entity_type'], 'tunnel'],    '#06B6D4', // Cyan tunnel
      ['==', ['get', 'entity_type'], 'flyover'],   '#EA580C', // Orange flyover
      ['coalesce', ['get', 'color'], '#2563EB']
    ],
    'fill-extrusion-height': ['coalesce', ['get', 'height'], 15.0],
    'fill-extrusion-base':   ['coalesce', ['get', 'base_height'], 0.0],
    'fill-extrusion-opacity': 0.90
  }
});
```

---

## 2. Subterranean & Underground Mode Mechanics

Standard GIS platforms clamp $Z < 0$ elevations to the ground surface. BHARAT 3D implements a custom **Subterranean X-Ray Mode**:
1. When switching to **`Underground` Mode**:
   - The surface imagery opacity drops to **12%** (`raster-opacity: 0.12`).
   - The background canvas shifts to a deep navy blueprint grid (`#0b1120`).
   - Subterranean assets (Yellow Line Metro Tunnel at $-14.2\text{ m}$, Road Tunnel at $-8.5\text{ m}$, Mall 2-Level Basement Parking at $-6.0\text{ m}$) are rendered with glowing cyan/neon extrusion channels.
   - The camera eases smoothly to **$68^\circ$ pitch** and **$38^\circ$ bearing** for optimal subterranean perspective.

---

## 3. Elevated Infrastructure Deck (Flyover FLY-001)

The Central Urban Elevated Flyover is rendered floating above the ground plane:
- **Base Height (`base_height`)**: $+8.5\text{ m}$ MSL
- **Top Height (`height`)**: $+10.7\text{ m}$ MSL
- **Support Pillars**: Solid concrete pier columns rendered at $100\text{ m}$ intervals extending from $0.0\text{ m}$ ground level to the $+8.5\text{ m}$ deck underside.

---

## 4. Three.js 3D BIM Floor Exploder Viewer

For micro-level inspection of individual high-rise apartments, BHARAT 3D embeds a custom **Three.js WebGL BIM Viewer**:
- **360° Mouse Orbit Controls**: Drag to rotate in 3D orbit space.
- **Explode Slider (0% to 100%)**: Dynamically translates each floor slab along the $Y$-axis:
  $$\Delta Y_f = (f - 1) \times (1.1 + k_{\text{explode}} \times 2.2)$$
- **Interactive Floor Highlighting**: Clicking any floor highlights the slab in amber gold, reveals unit divider partitions, and displays the exact subterranean metro clearance distance below the building's foundation ($14.2\text{ m}$ vertical clearance, 0 structural clashes).
""")

# -----------------------------------------------------------------------------
# 07_MUNICIPALITY_AND_VIOLATION_DETECTION.md
# -----------------------------------------------------------------------------
write_doc('07_MUNICIPALITY_AND_VIOLATION_DETECTION.md', r"""# BHARAT 3D: Municipality & 3D Violation Detection Engine

## 1. Overview & Municipal Compliance Rules

Traditional municipal corporations struggle to detect vertical property violations using flat satellite imagery because top-down ortho views cannot accurately measure vertical building heights or unauthorized upper floors.

BHARAT 3D automatically compares **sanctioned architectural approval plans** against **LiDAR-measured 3D volumetric reality**.

---

## 2. Sharma Commercial Plaza (`BLD-007`) Violation Case Study

| Compliance Parameter | Sanctioned Plan (Approved) | Measured 3D Reality (Surveyed) | Status |
| :--- | :--- | :--- | :--- |
| **Max Permissible Floors** | Ground + 4 Floors ($G+4$) | Ground + 6 Floors ($G+6$) | **CRITICAL VIOLATION (+2 Illegal Floors)** |
| **Maximum Permissible Height** | $14.0\text{ meters}$ | $21.2\text{ meters}$ | **EXCEEDED (+7.2 meters)** |
| **Front Setback Requirement** | $6.0\text{ meters}$ | $3.8\text{ meters}$ | **BREACH (-2.2m Setback Encroachment)** |
| **Total Carpet Area** | $1,800\text{ m}^2$ | $2,720\text{ m}^2$ | **+920 m² Unauthorized Commercial Space** |

---

## 3. Automated 3D Violation Highlighting

In the 3D Map and BIM Viewer:
- **Floors 1 to 4 ($0\text{ m}$ to $14\text{ m}$)**: Rendered in standard slate blue (Sanctioned).
- **Floors 5 and 6 ($14\text{ m}$ to $21.2\text{ m}$)**: Rendered in **vivid warning RED (`#DC2626`)** with pulsing hazard alert tags.

---

## 4. Municipal Enforcement Actions

1. **Digital Violation Notice Generation**:
   - Automated notice issued with cryptographic SHA-256 hash.
   - Legal Section: *Section 343/344 Delhi Municipal Corporation Act (Unauthorized Vertical Construction)*.
2. **Tax Penalty & Roll Recalculation**:
   - Base Annual Tax: $₹1,20,000$
   - Unauthorized Commercial Floor Surcharge: $+₹84,000 / \text{year}$ ($₹42,000 \times 2$ floors)
   - Penalty Assessment: $+₹2,50,000$ non-compoundable compounding fee.
""")

# -----------------------------------------------------------------------------
# 08_UTILITY_EXCAVATION_AND_CLASH_DETECTION.md
# -----------------------------------------------------------------------------
write_doc('08_UTILITY_EXCAVATION_AND_CLASH_DETECTION.md', r"""# BHARAT 3D: Utility Excavation & 3D Clash Detection Engine

## 1. Problem: Subsurface Utility Strikes

Excavation works in urban roads frequently damage high-voltage electrical cables, water mains, and gas pipes, or risk penetrating underground transit tunnels due to a lack of accurate 3D subterranean data.

---

## 2. 3D Subsurface Cylinder Buffer Algorithm

When a utility operator inputs a proposed excavation line (from Coordinate $A$ to Coordinate $B$, with trench depth $D$ and width $W$):

1. **3D Trench Envelope Construction**:
   $$\text{Box}_{\text{trench}} = [X_1, Y_1, Z_{\text{ground}}] \to [X_2, Y_2, Z_{\text{ground}} - D]$$
2. **Infrastructure Safety Buffer Extraction**:
   For each underground asset (Metro Tunnel $T$, Road Tunnel $R$, Utility Conduit $U$):
   $$\text{Buffer}_{\text{cylinder}}(A) = \{P \in \mathbb{R}^3 \mid \text{dist}(P, \text{Centerline}_A) \le r_A + \text{safety\_margin}\}$$
3. **Clash Intersection Query**:
   $$\text{Clash} = \text{Box}_{\text{trench}} \cap \text{Buffer}_{\text{cylinder}}(A)$$

---

## 3. Subterranean Assets in Central Urban Zone

- **Yellow Line Metro Transit Tunnel (`TNL-002`)**: Depth **$-14.2\text{ m}$ MSL**, Safety Radius $10.0\text{ m}$.
- **Central Road Tunnel (`TNL-001`)**: Depth **$-8.5\text{ m}$ MSL**, Safety Radius $6.0\text{ m}$.
- **Civic Mall Basement Parking (`PKG-001`)**: Depth **$-6.0\text{ m}$ MSL**, Safety Radius $4.0\text{ m}$.
- **Underground 11kV Power & 400mm Water Mains**: Depth **$-2.5\text{ m}$ to $-4.2\text{ m}$ MSL**.

---

## 4. Automated Digital Digging NOC Issuance

- If $\text{Clash} = \emptyset$: System approves permit and generates a **Digital Digging NOC** with QR code and cryptographic verification signature.
- If $\text{Clash} \ne \emptyset$: System denies permit, highlights the 3D clash intersection in red, and suggests an alternate depth profile.
""")

# -----------------------------------------------------------------------------
# 09_CITIZEN_PORTAL_AND_VPRID_REGISTRY.md
# -----------------------------------------------------------------------------
write_doc('09_CITIZEN_PORTAL_AND_VPRID_REGISTRY.md', r"""# BHARAT 3D: Citizen Portal & 3D Property Registry (VPRID)

## 1. Volumetric Property Registry ID (VPRID) Taxonomy

Under BHARAT 3D, every individual high-rise unit receives a unique, globally queryable 3D cadastral identifier:

$$\text{VPRID} = \text{VPR}-\underbrace{\text{BLD001}}_{\text{Building ID}}-\underbrace{\text{F08}}_{\text{Floor}}-\underbrace{\text{U04}}_{\text{Unit Number}}$$

Example: `VPR-BLD001-F08-U04` (Flat 804, Floor 8, Aarav Heights Condominium).

---

## 2. Citizen Property Card & Digital Deed Inspection

When a citizen searches their ULPIN or VPRID, the portal displays:
- **True 3D Spatial Geometry**: Exact floor elevation ($Z = 239.0\text{ m}$ to $242.0\text{ m}$ MSL), ceiling height ($3.0\text{ m}$), and 3D volumetric space ($345.6\text{ m}^3$).
- **Verified Carpet Area**: $115.2\text{ m}^2$ ($1,240\text{ sq.ft}$).
- **Registered Title Ownership**: Priya Mehta (Owner) / Rohan Gupta (Tenant).
- **Encumbrance Status**: Clear title, 0 legal disputes, bank mortgage registered with State Bank of India.
- **Municipal Property Tax**: $₹18,400 / \text{year}$ (Status: Paid).

---

## 3. Simulated Online Tax Settlement

Citizens can simulate municipal property tax payments with 1 click:
1. Citizen views outstanding dues.
2. Selects payment gateway (UPI / NetBanking / Debit Card).
3. Instant digital settlement updates SQLite/PostGIS database in real-time.
4. Downloads official **Government 3D Digital Cadastre Ownership Certificate**.
""")

# -----------------------------------------------------------------------------
# 10_JURY_PRESENTATION_AND_DEMO_GUIDE.md
# -----------------------------------------------------------------------------
write_doc('10_JURY_PRESENTATION_AND_DEMO_GUIDE.md', r"""# BHARAT 3D: 5-Minute Hackathon Jury Demonstration Script

## 1. Persona Credentials Summary

All personas share the password: **`demo2026`**

| Role | Email | Password | Primary Demo Screen |
| :--- | :--- | :--- | :--- |
| **Surveyor** | `survey@bharat3d.demo` | `demo2026` | `/surveyor/map` & `/surveyor/editor` |
| **Municipality** | `municipality@bharat3d.demo` | `demo2026` | `/municipality/violations` |
| **Utility Operator** | `utility@bharat3d.demo` | `demo2026` | `/utility/permits` |
| **Citizen** | `citizen@bharat3d.demo` | `demo2026` | `/citizen` |

---

## 2. Minute-by-Minute Demonstration Flow

### Minute 1: The Core Problem & Philosophy
- **Action**: Open `http://localhost:5173/login`, click **"1-Click Demo: Surveyor"**.
- **Speech**: *"Honorable judges, traditional land registries are flat 2D maps. But modern Indian cities exist in 3D. Our core principle is: Keep India's 2D ULPIN system as the foundation, and add a 3D volumetric layer only where vertical property exists."*

### Minute 2: 3D Cadastral Viewport & Subterranean X-Ray
- **Action**: Go to `/surveyor/map`. Toggle **`3D Volumetric`**, then toggle **`🚇 Underground`**.
- **Speech**: *"Notice how our map renders 12 discrete stacked floors for Aarav Heights, the elevated flyover at +8.5m, and the Yellow Line Metro Tunnel deep at -14.2m MSL. In underground mode, surface land turns transparent so subterranean infrastructure is crystal clear."*

### Minute 3: 3D BIM Floor Exploder & Editor
- **Action**: Click **"3D BIM Floor Exploder"**. Drag the explode slider to 35%, orbit the building in 3D, and click Floor 8. Then go to `/surveyor/editor` and click **"Add Floor"**.
- **Speech**: *"Surveyors can explode high-rises to inspect unit-level volumetric cadastre in 3D, add floors, and certify 884 legal VPRIDs."*

### Minute 4: Municipality Town Planning & Violation Detection
- **Action**: Switch persona to **Municipality** (`/municipality/violations`). Focus on Sharma Commercial Plaza.
- **Speech**: *"Our system automatically catches vertical violations. Sharma Plaza was approved for G+4, but our LiDAR survey measured G+6. The 2 unauthorized upper floors are flagged in red, with automatic municipal notice generation and tax recalculation."*

### Minute 5: Utility Excavation & Citizen Property Portal
- **Action**: Switch to **Utility** (`/utility/permits`) and run a clash check. Then switch to **Citizen** (`/citizen`) to show Flat 804 3D deed.
- **Speech**: *"Utility operators prevent underground cable and metro strikes using 3D buffer clash detection, and citizens can view their exact 3D property boundaries, volume in cubic meters, and digital title deeds. This is BHARAT 3D: India's spatial digital twin."*
""")

print('Successfully created all 10 documentation files in actual_docs!')


