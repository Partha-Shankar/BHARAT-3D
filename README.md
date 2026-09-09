# 🇮🇳 BHARAT 3D
### **2D-to-3D Spatial Property & Infrastructure Registry**
*Government-Grade Volumetric Cadastre & Subsurface Spatial Infrastructure Platform*

---

[![Smart India Hackathon](https://img.shields.io/badge/SIH%202024--2026-Problem%20ID%2026011-orange.svg)](file:///d:/Bharat%203d/SIH_PROBLEM_STATEMENT.md)
[![Standard](https://img.shields.io/badge/Standard-ISO%2019152%20LADM%20%2F%20OGC%20CityGML%203.0-blue.svg)](file:///d:/Bharat%203d/docs/02_DATA_MODEL_AND_3D_ULPIN_SPEC.md)
[![Architecture](https://img.shields.io/badge/Architecture-2D%20Foundation%20%2B%203D%20Extension-green.svg)](file:///d:/Bharat%203d/docs/01_SYSTEM_OVERVIEW_AND_ARCHITECTURE.md)
[![PostGIS Compatible](https://img.shields.io/badge/Spatial%20DB-SQLite%20Async%20%2F%20PostGIS%203D-blue.svg)](file:///d:/Bharat%203d/docs/05_BACKEND_AND_SPATIAL_SERVICES.md)

---

## 🌟 Executive Summary

**BHARAT 3D** is a sovereign, enterprise-grade geospatial cadastral platform built for the **Smart India Hackathon (Problem Statement #26011: 3D ULPIN Generation and Vertical Property Mapping System)**.

Instead of replacing India’s established **Unique Land Parcel Identification Number (ULPIN)** framework, BHARAT 3D enforces a fundamental design principle:

> **"Keep India's existing 2D cadastral / ULPIN system as the foundation, and add a 3D spatial layer only where property or infrastructure has meaningful vertical extent."**

```text
                                  AIR / UPPER REALM
             ┌────────────────────────────────────────────────────────┐
             │  Aarav Heights Apartment (Floor 1-12) [Flat 804]       │
             │  Civic Grand Mall (22 Commercial Lease Spaces)         │
             │  Elevated Flyover (FLY-001 at +8.5m MSL)               │
             └────────────────────────────────────────────────────────┘

GROUND LEVEL ═════════════════════════════════════════════════════════════════
             │  2D Cadastral Land Parcels (Base ULPIN: IN-DEMO-0042)  │
             │  Surface Roads, Footpaths, Rights-of-Way (RoW)         │
             ═════════════════════════════════════════════════════════

                                 SUBSURFACE REALM
             ┌────────────────────────────────────────────────────────┐
             │  Underground 2-Level Parking (-6.0m)                   │
             │  BSNL Optical Fiber Duct (-1.4m) & Water Main (-1.8m)  │
             │  DMRC Yellow Line Metro Rail Tunnel (-14.2m)           │
             └────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start & Run Commands

### One-Command Setup & Seed
```bash
# In the root workspace:
python run.py
```

### Launch Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# OpenAPI Docs: http://localhost:8000/docs
```

### Launch Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Web Interface: http://localhost:5173
```

---

## 👥 Demo Personas & Credentials

All demo accounts share the common password: **`demo2026`**

| Role | Email Address | Access & Scope |
| :--- | :--- | :--- |
| **👷 Surveyor** | `survey@bharat3d.demo` | Area selection, multi-modal upload, 45s AI pipeline, 3D Cadastre Editor, VPRID certification. |
| **🏛️ Municipality** | `municipality@bharat3d.demo` | Bylaw violation audit ($G+N$ extra floors, setbacks, footpath encroachments), property tax roll. |
| **⚡ Utility Operator** | `utility@bharat3d.demo` | Subsurface infrastructure inspection, 3D excavation buffer clash analysis, dig-safe clearance. |
| **👤 Citizen** | `citizen@bharat3d.demo` | **Privacy-Preserved View**: Scoped solely to their owned property (**Flat 804, Aarav Heights**). |
| **🛡️ Administrator** | `admin@bharat3d.demo` | Complete system governance, versioned snapshots, cryptographic SHA-256 audit trails. |

---

## 🗺️ Demonstration Geography & Scale

The prototype operates on a compact, geographically coherent demonstration area: **"Central Urban Zone"** (Latitude: `28.6265°` to `28.6298° N`, Longitude: `77.2075°` to `77.2125° E`).

* **2D Cadastral Parcels**: 134 parcels with geocoded ULPINs
* **3D Extruded Buildings**: 64 buildings (Residential towers, commercial complexes)
* **Vertical Floors Inferred**: 312 floor levels
* **Volumetric Units (VPRIDs)**: 884 distinct 3D properties (Apartments, shops, duplexes)
* **Underground & Elevated Infrastructure**: 52 assets (Metro tunnel, road tunnel, flyovers, optical fiber ducts, water trunk mains, multi-level basements)
* **Municipal Bylaw Violations**: 18 detected violations (Unauthorized floors, setback breaches, sidewalk encroachments)

---

## 📦 The 10 Seeded Datasets (Same Area, Temporal Evolution)

All 10 datasets cover the **same Central Urban Zone** and represent versioned snapshots:

1. **`dataset_01` (v1.0)**: Initial baseline cadastral survey.
2. **`dataset_02` (v1.1)**: Updated LiDAR point cloud refinement.
3. **`dataset_03` (v1.2)**: Additional rooftop and parapet geometry corrections.
4. **`dataset_04` (v1.3)**: State revenue ownership records attached.
5. **`dataset_05` (v1.4)**: Municipal property tax assessments updated.
6. **`dataset_06` (v2.0)**: AI detection of unauthorized construction (Sharma Complex $G+6$).
7. **`dataset_07` (v2.1)**: Subsurface infrastructure alignment updated (Tunnel TNL-001).
8. **`dataset_08` (v2.2)**: Surveyor human-in-the-loop geometry corrections applied.
9. **`dataset_09` (v2.3)**: Municipal compliance audit and notices stamped.
10. **`dataset_10` (v3.0)**: **Final Integrated Urban Cadastre** (Default richest demonstration dataset).

---

## 🎭 Step-by-Step SIH Demo Flow

Detailed narrative available in [`docs/editing-script.md`](file:///d:/Bharat%203d/docs/editing-script.md):

1. **Surveyor Ingestion**: Login $\to$ Create Project $\to$ Confirm Area $\to$ Ingest Multi-Modal Files (Drone, LiDAR, GIS, CAD, GNSS, DEM).
2. **45-Second AI Pipeline**: Live 16-stage telemetry stream executing automated building footprint extraction, $n\text{DSM}$ height calculation, floor segmentation, and 3D topology validation.
3. **Selective 3D Display**: 2D base parcels remain flat; buildings, flyovers, and tunnels emerge as 3D solids.
4. **3D Cadastre Review & Editor**:
   * *Edit 1*: Add Floor 13 to **Aarav Heights (`BLD-001`)**.
   * *Edit 2*: Split Floor 13 into 4 units (`U1301` to `U1304`).
   * *Edit 3*: Modify **Central Urban Tunnel (`TNL-001`)** length (320m $\to$ 350m).
   * *Edit 4*: Adjust **Central Urban Flyover (`FLY-001`)** elevation (+8.5m $\to$ +9.2m).
   * *Edit 5*: **Confirm Cadastre** $\to$ Allocate 884 VPRIDs.
5. **Cadastral Inspection**:
   * Inspect **Flat 804 (`VPR-BLD001-F08-U04`)**: Owner Priya Mehta, Tenant Rohan Gupta, Tax ₹18,400 (Paid).
   * Inspect **Civic Grand Mall (`BLD-003`)**: 1 Base Building ID with 22 commercial lease spaces (Store S-042).
6. **Municipal Bylaw Violations**:
   * **Sharma Commercial Plaza (`BLD-007`)**: Sanctioned $G+4$ vs Measured $G+6$ ($2$ unauthorized floors in red).
   * **Front Setback Breach**: $3.8m$ observed vs $6.0m$ required ($2.2m$ breach).
   * **Footpath Encroachment (`BLD-008`)**: $18.6 m^2$ sidewalk illegally occupied.
7. **Underground Subsurface Mode**:
   * Turn on Underground Mode $\to$ Metro Tunnel ($-14.2m$), Telecom fiber ($-1.4m$), Water trunk ($-1.8m$), Underground parking ($-6.0m$).
8. **Utility Excavation Safety Analysis**:
   * Login as Utility Operator $\to$ Input Trench Depth `2.0 meters` $\to$ **HIGH RISK Clash Detected**: Direct strike on optical fiber duct and water main safety buffer.
9. **Citizen Privacy Portal**:
   * Login as Citizen $\to$ Scoped view showing **only Flat 804** $\to$ Click "Flyto 3D Unit in Cesium".

---

## 🔬 Hackathon Mocking Strategy: Precomputed vs Production Ready

```text
┌───────────────────────────────────────┬───────────────────────────────────────┐
│ REAL IN THE PROTOTYPE                 │ PRECOMPUTED / MOCKED FOR SIH DEMO     │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • Complete React + TypeScript Frontend│ • 45-Second AI heavy GPU training /   │
│ • MapLibre GL 2D + CesiumJS 3D Viewers│   inference cluster (orchestrated     │
│ • 5-Role RBAC & JWT Authentication    │   via realistic 16-stage SSE stream)  │
│ • Real REST API Endpoints & Schemas   │ • Live nationwide integration with    │
│ • SQLite Async / PostGIS-ready DB     │   all 28 state land revenue systems   │
│ • Interactive 3D Cadastre Editor      │ • Real-time live utility SCADA feeds  │
│ • Subsurface 3D Clash Algorithms      │                                       │
│ • Cryptographic SHA-256 Audit Trail   │                                       │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 📂 Documentation Directory

Comprehensive technical documentation is stored in [`docs/`](file:///d:/Bharat%203d/docs):

* [`SIH_PROBLEM_STATEMENT.md`](file:///d:/Bharat%203d/SIH_PROBLEM_STATEMENT.md) — Official SIH PS #26011 details
* [`docs/editing-script.md`](file:///d:/Bharat%203d/docs/editing-script.md) — Step-by-step judge demonstration guide
* [`docs/architecture.md`](file:///d:/Bharat%203d/docs/architecture.md) — High-level architectural topology
* [`docs/data-model.md`](file:///d:/Bharat%203d/docs/data-model.md) — VPRID format & Tripartite Model
* [`docs/demo-flow.md`](file:///d:/Bharat%203d/docs/demo-flow.md) — Demonstration lifecycle
* [`docs/api.md`](file:///d:/Bharat%203d/docs/api.md) — REST API endpoint reference
* [`docs/future-ml.md`](file:///d:/Bharat%203d/docs/future-ml.md) — Production AI/ML deployment roadmap
