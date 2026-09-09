# 📋 BHARAT 3D — Official Demo & Cadastral Editing Script

This document provides the **exact, deterministic step-by-step actions** to perform during the Smart India Hackathon internal and live jury demonstration.

---

## 🎯 Pre-Demo Verification
1. Start Backend: `uvicorn app.main:app --reload --port 8000` (from `backend/` directory)
2. Start Frontend: `npm run dev` (from `frontend/` directory at `http://localhost:5173`)
3. Reset & Seed (if needed): `python scripts/reset_demo.py`

---

## 🎭 ACT 1: Surveyor Ingestion & 45-Second AI Pipeline

### 1. Login
* Navigate to `http://localhost:5173/login`
* Click the quick-fill button **[ Surveyor ]** or enter:
  * **Email**: `survey@bharat3d.demo`
  * **Password**: `demo2026`
* Click **Sign In**. The Surveyor Dashboard opens.

### 2. Create Project & Select Area
* Click **[ + New Survey Project ]** or navigate to **Projects**.
* Fill in project metadata:
  * **Project Name**: `Central Urban Zone - Ward 16 Survey`
  * **Ward**: `Ward 16`
  * **Zone**: `Central Urban Zone`
* Click **Proceed to Area Selection**.
* On the 2D Map, click **[ Draw Survey Boundary ]** and click 4 points around the demonstration area (or use the pre-loaded bounding polygon).
* Click **Confirm Survey Area & Upload Data**.

### 3. Upload Multi-Modal Datasets
* On the **Data Upload** screen, the 8 upload dropzones are displayed.
* Click **[ Load Demo Survey Package ]** (or select the sample `.las`, `.tif`, `.geojson`, `.dxf`, `.csv` files).
* Click **Validate & Ingest Files**. The green checkmarks appear for all file formats and CRS detection (`EPSG:4326 / EPSG:32643`).
* Click **[ START 3D CADASTRE AI PIPELINE ]**.

### 4. The 45-Second AI Processing Stream
* The telemetry stream executes across 16 stages with live progress:
  1. `Upload Validation` $\to$ 2. `File Integrity Verification` $\to$ 3. `CRS Normalization` $\to$ 4. `GIS Parcel Alignment` $\to$ 5. `LiDAR Point Cloud Analysis` $\to$ 6. `Building Extraction` $\to$ 7. `Building Height Estimation` $\to$ 8. `Floor Segmentation` $\to$ 9. `Vertical Space Generation` $\to$ 10. `Infrastructure Extraction` $\to$ 11. `Topology Validation` $\to$ 12. `AI-Assisted Bylaw Analysis` $\to$ 13. `Property Data Linking` $\to$ 14. `3D Map Preparation` $\to$ 15. `Final Quality Check`.
* At 45 seconds: **Processing Metrics** appear:
  * *Buildings Detected*: `64`
  * *Floors Inferred*: `312`
  * *Vertical Units*: `884`
  * *Infrastructure Assets*: `52`
  * *Topology Score*: `98.9%`
  * *Potential Violations*: `18`
* Click **[ VIEW GENERATED 3D CADASTRE ]**.

---

## 🏢 ACT 2: Selective 3D & Human-in-the-Loop Cadastre Review

### 1. 2D-to-3D Visual Verification
* The map displays 2D base parcels with roads and footpaths.
* Multi-storey buildings and infrastructure emerge as selective 3D solids.
* Click the **[ Hybrid / 3D ]** mode toggle in the top toolbar to switch between 2D Cadastre and 3D Volumetric representations.

### 2. Enter 3D Cadastre Editor
* Click **[ Open 3D Cadastre Review & Editor ]**.
* Open the bottom **Suggested Demo Edits** helper drawer.

### 3. Execute Deterministic Demo Edits:
* **EDIT 1**: Select **Aarav Heights (`BLD-001`)** on the map.
  * In the inspector, click **[ + Add Floor ]** $\to$ Adds Floor 13 ($G+12$).
* **EDIT 2**: Select the newly added **Floor 13**.
  * Click **[ Split Floor ]** $\to$ Select `4 Units` (`U1301`, `U1302`, `U1303`, `U1304`) $\to$ Confirm.
* **EDIT 3**: Select **Central Urban Tunnel (`TNL-001`)**.
  * Modify length from `320m` to `350m`.
* **EDIT 4**: Select **Central Urban Flyover (`FLY-001`)**.
  * Adjust deck elevation from `8.5m` to `9.2m`.
* **EDIT 5**: Click **[ Save Draft ]** (Triggers immutable audit log event).
* **EDIT 6**: Click **[ ✅ CONFIRM CADASTRE & GENERATE 3D IDENTITIES ]**.
* The **VPRID Allocation Dialog** appears: `884 Volumetric Property Reference IDs Allocated`.

---

## 🔍 ACT 3: Cadastral Registry, Mall & Apartment Inspection

### 1. Inspect Apartment (Aarav Heights - BLD-001)
* Navigate to **3D Registry** or click on `BLD-001` on the map.
* Click **Floor 8** $\to$ Click **Flat 804 (`VPR-BLD001-F08-U04`)**.
* The right property inspector displays:
  * **Base ULPIN**: `IN-DEMO-0042`
  * **3D Property ID**: `VPR-BLD001-F08-U04`
  * **Type**: `Residential` | **Area**: `115.2 m²` | **Volume**: `345.6 m³`
  * **Owner**: `Priya Mehta` (Masked Ref: `ID-XXXX-8921`)
  * **Occupancy**: `Leased` (Tenant: `Rohan Gupta`, Term: Active)
  * **Municipal Tax**: `₹18,400` (`Paid`)
  * **Compliance**: `Compliant`

### 2. Inspect Commercial Shopping Mall (Civic Grand Mall - BLD-003)
* Click **Civic Grand Mall (`BLD-003`)**.
* Notice: The entire mall has 1 Base Building ID (`BLD-003`), but contains 22 internal commercial lease spaces.
* Click **Ground Floor** $\to$ Click **Store S-042 (Anchor Hypermarket)**.
  * **Owner**: `Civic Grand Mall Ltd` (Corporate Entity)
  * **Occupancy**: `Leased` | **Status**: `Active` | **Use**: `Commercial`
  * **Tax**: `₹74,500 / year`

---

## ⚖️ ACT 4: Municipal Compliance & Bylaw Violations

### 1. Switch to Municipality Role
* Click top-right profile $\to$ Logout $\to$ Login as **[ Municipality ]** (`municipality@bharat3d.demo` / `demo2026`).
* The **Municipal Compliance Dashboard** opens.

### 2. Inspect Bylaw Violations
* Navigate to **Violations** or click on the glowing red structures:
* **Violation 1: Unauthorized Upper Floors (Sharma Commercial Complex - BLD-007)**:
  * Approved: `G + 4` ($15.0m$) vs Measured: `G + 6` ($21.2m$).
  * Result: `2 Unauthorized Floors` (Floors 5 & 6 glowing red).
* **Violation 2: Front Setback Breach (BLD-007)**:
  * Mandated: `6.0 m` vs Observed: `3.8 m` $\to$ **Violation: 2.2 m**.
* **Violation 3: Footpath Encroachment (Mehta Plaza - BLD-008)**:
  * Encroached Public Sidewalk Area: `18.6 m²`.

---

## 🚇 ACT 5: Subsurface Mode & Excavation Safety Analysis

### 1. View Underground Infrastructure
* Click top toolbar **[ Underground Mode ]**.
* Ground terrain opacity reduces to $20\%$.
* Subsurface assets become visible in 3D:
  * Metro Rail Tunnel (`TNL-002`) at depth $-14.2m$.
  * BSNL Telecom Optical Fiber (`TLC-001`) at depth $-1.4m$.
  * Water Trunk Pipeline (`WTR-001`) at depth $-1.8m$.
  * Mall Underground 2-Level Parking (`PKG-001`) at depth $-6.0m$.

### 2. Switch to Utility Operator Role & Run Dig-Safe Analysis
* Logout $\to$ Login as **[ Utility Operator ]** (`utility@bharat3d.demo` / `demo2026`).
* Navigate to **Excavation Analysis**.
* Draw a proposed trench polygon across the central road.
* Enter **Excavation Depth**: `2.0 meters`.
* Click **[ RUN 3D CLASH ANALYSIS ]**.
* **Instant Safety Output**:
  * **Risk Score**: `HIGH RISK (Clash Detected)`
  * **Telecom Cable TLC-001**: Depth $1.4m$ $\to$ `⚠️ DIRECT INTERSECTION`
  * **Water Pipeline WTR-001**: Depth $1.8m$ $\to$ `⚠️ WARNING BUFFER BREACH (0.2m)`
  * **Metro Tunnel TNL-002**: Depth $14.2m$ $\to$ `✅ CLEAR (12.2m Safety Margin)`
  * Recommendation: `Excavation permit requires manual utility clearance before digging`.

---

## 👤 ACT 6: Citizen Privacy-Preserved Portal

### 1. Login as Citizen
* Logout $\to$ Login as **[ Citizen ]** (`citizen@bharat3d.demo` / `demo2026`).
* Notice: Citizen **cannot** browse all city parcels or inspect neighbors' financial records.

### 2. View "My Property"
* Citizen sees their exact property card: **Flat 804, Aarav Heights**.
* Displays:
  * **Base ULPIN**: `IN-DEMO-0042`
  * **3D Property ID**: `VPR-BLD001-F08-U04`
  * **Ownership Deed**: `DEED-DL-2024-0981` (100% Share)
  * **Tenant**: `Rohan Gupta` (Active Lease)
  * **Tax Paid Status**: `₹18,400 (Paid)`
* Click **[ View in 3D ]**: The 3D camera smoothly flies and isolates their 8th-floor apartment in high contrast.
