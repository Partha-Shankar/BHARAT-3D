# BHARAT 3D — Master Demonstration Script & Execution Guide

**Project Name:** BHARAT 3D  
**Tagline:** 2D-First Spatial Property & Subterranean Infrastructure Cadastral Platform  
**Category:** Government Geospatial Intelligence / Cadastral Modernization  

---

## 1. Startup & Execution Commands

### Prerequisites
- Python 3.10+ (with FastAPI, SQLAlchemy, Uvicorn)
- Node.js 18+ (with npm/vite)

### Quick Start (Single Command)
Run from root workspace directory:
```bash
python run.py
```
Or start services independently:

**Backend (FastAPI on Port 8000):**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend (React + Vite on Port 5173):**
```bash
cd frontend
npm run dev
```

---

## 2. Demo Persona Credentials Summary

All personas share the default password: **`demo2026`** (also accessible via 1-click login buttons on the login screen):

| Stakeholder Persona | Email | Password | Primary Workflow |
| :--- | :--- | :--- | :--- |
| **Surveyor & Geospatial Lead** | `survey@bharat3d.demo` | `demo2026` | Polygon Delineation $\to$ Multi-Modal Upload $\to$ 45s AI Processing $\to$ 3D Inspection $\to$ 3D Editor $\to$ 3D ID Generation |
| **Municipal Corporation (Town Planning)** | `municipality@bharat3d.demo` | `demo2026` | 3D Bylaw Analysis $\to$ Unauthorized Floors Audit (Sharma Plaza G+6) $\to$ Notice Generation |
| **Utility Infrastructure Operator** | `utility@bharat3d.demo` | `demo2026` | 3D Subterranean Clash Detection $\to$ Trench Analysis $\to$ Dig-Safe Digital NOC |
| **Property Owner / Citizen** | `citizen@bharat3d.demo` | `demo2026` | Privacy-Guaranteed 3D Unit Deed $\to$ Flat 804 Volumetric Spatial Title $\to$ Tax Settlement |

---

## 3. Location of the 10 Prepared Datasets & 3D Maps

### 10 Independent Urban Areas
- **Storage Path:** `data/demo/areas/area_01/` through `data/demo/areas/area_10/`
- **Legacy Path Support:** `data/demo/dataset_01/` through `data/demo/dataset_10/`

Each area folder contains 24 standardized feature files:
`parcels.geojson`, `roads.geojson`, `footpaths.geojson`, `buildings.geojson`, `floors.geojson`, `units.geojson`, `mall.geojson`, `railway.geojson`, `metro.geojson`, `flyovers.geojson`, `tunnels.geojson`, `underground_parking.geojson`, `utilities.geojson`, `violations.geojson`, `ownership.csv`, `leases.csv`, `tax.csv`, `metrics.json`, `metadata.json`, `3d_data.json`, `lidar.las`, `dem.tif`, `dsm.tif`, `drone/orthomosaic.tif`.

### 10 Ready-to-Upload Ingestion Packages
- **Storage Path:** `prepared_upload/survey_package_01/` through `prepared_upload/survey_package_10/`

---

## 4. Primary Demo Setup

- **Recommended Primary Upload Package:** `prepared_upload/survey_package_01/` (or any package 01–10)
- **Resolved Geographic Area:** **Area 01: Central Heights** (`[77.2090, 28.6280]`)
- **Area Theme:** Apartment Tower & Mall Hub with Central Subsurface Road Tunnel

---

## 5. Minute-by-Minute Step-by-Step Demo Click Sequence

### Step 1: Login as Surveyor
1. Open `http://localhost:5173/login`.
2. Click **"1-Click Demo: Surveyor"** (`survey@bharat3d.demo`).
3. Click **"Launch Surveyor Workspace"**.

### Step 2: Delineate Survey Boundary Polygon
1. From Surveyor Dashboard, click **"New Survey Project"** (or open `/surveyor/area`).
2. Click **"Draw Polygon"** on the top toolbar. Click 4 points around the central map region, then click **"Finish Polygon"**.
3. *Alternative:* Click **"Pre-Delineated Zone"** to instantly lock the $0.43\text{ km}^2$ boundary.
4. Observe the floating **"Selected Survey Area"** card showing:
   - Extent: `0.43 km² (430,000 m²)`
   - Status: `Georeferenced`
5. Click **`CONFIRM SURVEY BOUNDARY & UPLOAD DATA`**.

### Step 3: Multi-Modal Data Ingestion Portal
1. Observe 8 multi-modal sensor streams quarantined and validated (LiDAR `.las`, Drone `.tif`, GIS `.geojson`, CAD `.dxf`, GNSS `.csv`, DEM `.tif`, Deeds `.csv`, Tax `.csv`).
2. Click **`START MULTI-MODAL 3D ANALYSIS`**.

### Step 4: Visible 45-Second Multi-Modal Processing
1. Observe the live countdown timer: `00:17 / 00:45` at `37%`.
2. Observe the 16 real engineering stages sequentially executing (Ground filtering, Footprint extraction, Slab stratification, VPRID allocation, Topology check, etc.).
3. Observe live counter metrics dynamically populating from `metrics.json`:
   - Buildings: `18`
   - Floors: `112`
   - Vertical Units: `188`
   - Infrastructure Assets: `7`
   - Potential Violations: `4`
4. At `00:45 / 00:45` ($100\%$), the **`3D ANALYSIS COMPLETE`** status banner appears.
5. Click **`View 3D Cadastral Map`** (Editor remains separated and does not open automatically).

### Step 5: 3D Cadastral Inspection & Spatial Hierarchy
1. The Map viewport opens in true 3D isometric view with MapLibre GL fill-extrusion layers.
2. Click **"Focus Tower"** or click on **Aarav Heights Condominium Tower (`BLD-01-01`)**.
3. In the right-side **3D Spatial Cadastre Inspector**:
   - Building ID: `BLD-01-01`
   - Base ULPIN: `IN-01-0008`
   - Total Floors: `12`
   - Height: `39.0m MSL`
4. Click **`F8`** on the Vertical Floor Stack.
5. Select **`Flat 804`**:
   - **3D Property ID:** `VPR-BLD0101-F08-U04`
   - **Carpet Area:** `94.5 m² (1,017 sq.ft)`
   - **Built-up Area:** `115.2 m² (1,240 sq.ft)`
   - **Enclosed Volume:** `345.6 m³`
   - **Elevation Bounds:** `237.75m to 241.0m MSL`
   - **Owner:** `Priya Mehta`
   - **Occupancy:** `Leased (Rohan Gupta)`
   - **Annual Tax:** `₹18,400 (Paid)`
   - **Title Deed:** `DEED-DL-2024-0981`
6. Click **"3D BIM Floor Exploder"**:
   - Drag the explosion slider to $40\%$ to view discrete floor slices.
   - Orbit building $360^\circ$ and verify the subterranean metro foundation clearance ($14.2\text{m}$ clearance, $0$ clash).

### Step 6: Commercial Mall & Leased Stores Inspection
1. Click **"Focus Mall"** on the map or click **Civic Grand Mall (`BLD-01-03`)**.
2. Inspect stratified commercial leases:
   - **Store S-101 (Anchor Hypermarket):** Apex Retail Supermarket ($1,200\text{ m}^2$, Active)
   - **Store S-201 (Fashion Apparel):** FabIndia Living ($320\text{ m}^2$, Active)
   - **Store S-202 (Footwear Outlet):** Bata India (Expired Lease)
   - **Store S-203:** Vacant Commercial Unit

### Step 7: Elevated Flyover & Subterranean Infrastructure
1. Click **"Elevated Flyover"** on the map HUD:
   - Flyover ID: `FLY-01-01`
   - Base Elevation: `+8.5m MSL`
   - Top Deck Elevation: `+10.7m MSL`
   - Structure: Elevated road deck supported on 6 solid concrete piers extending from $0.0\text{m}$ ground level.
2. Switch Mode to **`🚇 Underground`**:
   - Surface imagery becomes semi-transparent ($12\%$).
   - Yellow Line Metro Tunnel (`TNL-01-02`) glows at $-14.2\text{m}$ MSL.
   - Central Road Tunnel (`TNL-01-01`) glows at $-8.5\text{m}$ MSL.
   - Mall Basement Parking (`PKG-01-01`) glows at $-6.0\text{m}$ MSL.
   - Telecom fiber and 400mm water main lines appear along road corridors.

### Step 8: Municipal Violation Detection & Enforcement
1. Click **"Focus Violation"** on the map HUD or click **Sharma Commercial Plaza (`BLD-01-07`)**.
2. Observe the physical 3D geometry:
   - Approved sanction: `G + 4 (14.0m)` rendered in slate grey.
   - Observed LiDAR measurement: `G + 6 (21.2m)` with **Floors 5 & 6 physically rendered in warning RED**.
3. Inspect details in Inspector:
   - **Violation Type:** `UNAUTHORIZED_EXTRA_FLOORS`
   - **Excess:** `2 Unauthorized Upper Floors (7.2m excess)`
   - **Front Setback:** `3.8m observed vs 6.0m required (2.2m breach)`
4. Switch persona to **Municipality** (`municipality@bharat3d.demo`) $\to$ `/municipality/violations`:
   - Click **"Issue Demolition & Tax Surcharge Notice"** $\to$ Notice `MCD-NOT-2026-VLT-001` issued.

### Step 9: Human-in-the-Loop 3D Cadastre Editor & Bulk 3D ID Generation
1. Switch back to Surveyor $\to$ Click **"Open 3D Cadastre Editor"** (`/surveyor/editor`).
2. Perform deterministic edits:
   - **Edit 1:** Select Apartment Tower $\to$ Click **"Add Floor 13"** ($+3.25\text{m}$ slab added).
   - **Edit 2:** Subdivide new floor into **4 Units / Floor**.
   - **Edit 3:** Select Subsurface Tunnel $\to$ Slide Corridor Length from `280m` to `320m` and Depth to `-9.2m`.
   - **Edit 4:** Select Flyover Deck $\to$ Adjust Deck Elevation to `+9.0m MSL`.
   - **Edit 5:** Click **"Save Draft Edits"** $\to$ `Draft Saved ✓`.
3. Click **`CONFIRM MODEL & GENERATE 3D IDS`**:
   - Bulk generator allocates 3D spatial identities across all 18 buildings, stacked floors, and infrastructure assets.
   - Summary appears: **`401 3D Property Identities (VPRIDs) Generated & Certified`**.
4. Click **"Open Registry"** (`/surveyor/registry`):
   - View complete searchable land roll.
   - Click **"ARCHIVE 3D REGISTRY"** $\to$ Snapshot preserved.
   - Click **"REGENERATE 3D REGISTRY"** $\to$ Active status restored.

### Step 10: Utility Excavation Safety & Clash Analyzer
1. Switch persona to **Utility Operator** (`utility@bharat3d.demo`) $\to$ `/utility/permits`.
2. Set Proposed Excavation Trench Depth: **`2.0 meters`**.
3. Click **`RUN 3D SUBSURFACE CLASH ANALYSIS`**.
4. Result appears:
   - **Status:** **`HIGH RISK: Subsurface Utility Clashes Detected!`**
   - **Telecom:** Direct strike risk against BSNL 96-core fiber at `-1.4m`.
   - **Water:** Warning buffer breach against 400mm water main at `-1.8m`.
   - **Metro Tunnel:** Safe vertical clearance ($12.2\text{m}$ clearance from `-14.2m` tunnel crown).
   - **Recommendation:** `Clearance Verification Required before issuing Excavation Permit.`

### Step 11: Citizen Private Property Portal
1. Switch persona to **Citizen** (`citizen@bharat3d.demo`) $\to$ `/citizen`.
2. Observe DPDP data minimization: Citizen sees **only** their own property.
3. Inspect **Flat 804, Aarav Heights Condominium (`VPR-BLD0101-F08-U04`)**:
   - Volume: `345.6 m³`
   - Carpet Area: `94.5 m² (1,017 sq.ft)`
   - Title Deed: `DEED-DL-2024-0981 (Freehold 100%)`
   - Annual Tax: `₹18,400 (Paid in Full)`
4. Click **"Flyto 3D Unit in Cesium/MapLibre"** to view personal property boundaries in full 3D.

---

## 6. Exact IDs & Target Properties Reference

| Entity Type | Target ID | Display Name | Key Metric / Property |
| :--- | :--- | :--- | :--- |
| **Main Apartment Tower** | `BLD-01-01` | Aarav Heights Tower | 12 Floors • 39.0m MSL • 48 Units |
| **Selected Floor** | `FLR-BLD0101-F08` | Floor 8 | Z: 237.75m to 241.0m MSL |
| **Selected Citizen Unit** | `VPR-BLD0101-F08-U04` | Flat 804 | Area: 115.2 m² • Vol: 345.6 m³ • Owner: Priya Mehta |
| **Commercial Mall** | `BLD-01-03` | Civic Grand Mall | 4 Levels • 18.5m MSL • S-101 Anchor Hypermarket |
| **Elevated Flyover** | `FLY-01-01` | Elevated Bypass Flyover | Deck: +8.5m MSL • 6 Concrete Piers (0 to 8.5m) |
| **Subsurface Metro Tunnel** | `TNL-01-02` | Yellow Line Metro Tunnel | Depth: -14.2m MSL • Length: 380m • DMRC |
| **Subsurface Road Tunnel** | `TNL-01-01` | Central Road Tunnel | Depth: -8.5m MSL • Length: 280m • PWD Delhi |
| **Basement Parking** | `PKG-01-01` | Mall 2-Level Basement Parking | Depth: -6.0m MSL • 350 Bays |
| **Critical Violation** | `BLD-01-07` / `VLT-001` | Sharma Commercial Plaza | G+6 observed vs G+4 approved (Floors 5 & 6 in RED) |
| **Footpath Encroachment** | `VLT-01-ENC-01` | Retail Sidewalk Encroachment | 18.6 m² public sidewalk encroachment |

---

## 7. Known Limitations & Technical Scope
1. **Demo Ingestion Mode:** Deep learning photogrammetry point cloud densification ($10^7$ LiDAR points) is simulated deterministically across 45 seconds using precomputed datasets for 100% crash-free hackathon performance.
2. **Offline Local Vector Tiles:** High-performance vector polygon extrusions are rendered locally in GPU WebGL without external cloud service dependencies.
