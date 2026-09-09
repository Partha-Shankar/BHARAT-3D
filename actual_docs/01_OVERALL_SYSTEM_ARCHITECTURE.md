# BHARAT 3D: Overall System Architecture & Engineering Blueprint

**Project Name:** BHARAT 3D  
**Tagline:** 2D-to-3D Spatial Property & Infrastructure Registry  
**Smart India Hackathon Problem Statement ID:** #26011  
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
