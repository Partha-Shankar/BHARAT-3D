# Smart India Hackathon (SIH) — Problem Statement Context

---

## 📌 Problem Statement Overview

| Attribute | Details |
| :--- | :--- |
| **Statement ID** | **26011** |
| **Problem Statement Title** | **3D ULPIN Generation and Vertical Property Mapping System** |
| **Category** | Software / Smart Governance / Urban Land Records / GIS & Remote Sensing |
| **Target Beneficiaries** | Ministry of Rural Development (DoLR), MoHUA, State Revenue Departments, Municipal Corporations, Utility Operators, Citizens |
| **Core Proposed Solution** | **BHARAT 3D: 2D-to-3D Spatial Property & Infrastructure Registry** |

---

## 📖 Official Problem Description

### Background
With rapid urbanization and vertical growth of cities, conventional 2D land record systems are becoming inadequate for managing modern urban properties. Existing land administration systems are primarily designed to identify surface-level land parcels and are unable to uniquely define ownership rights associated with:
* Multi-storey apartments
* Underground infrastructure (tunnels, basements, metro corridors, subways)
* Elevated transport corridors (flyovers, elevated metro rail)
* Designated parking spaces (surface and multi-level underground)
* Air-rights and volumetric parcels
* Subsurface utility networks (telecom, electricity, water, gas pipelines)

### Description
The proposed solution should develop an advanced **3D ULPIN (Unique Land Parcel Identification Number) Generation and Vertical Property Mapping System** capable of creating unique spatial identities for:
1. **Surface land parcels**
2. **Multi-storey apartments and commercial spaces**
3. **Underground and elevated infrastructure**

The system should integrate multi-source spatial data:
* **Drone imagery** (High-resolution Orthomosaics, Oblique imagery)
* **LiDAR / 3D Point Cloud data** (Aerial & Terrestrial)
* **GIS parcel layers** (Cadastral shapefiles, GeoJSON, GeoPackage)
* **Building floor plans** (CAD / DXF / DWG / IFC / BIM)
* **GNSS / CORS-based coordinates** (High-precision georeferencing)
* **Digital Elevation Models (DEM / DSM / DTM)**

The solution should also incorporate **AI/ML capabilities** for:
* **Automated building extraction**
* **Floor segmentation and height estimation**
* **Vertical parcel delineation (volumetric units)**
* **Intelligent 3D topology validation**

### Expected Outcome
Development of a scalable, secure, and interoperable 3D cadastral framework capable of:
1. **Generating standardized 3D ULPINs / Volumetric Property Reference IDs (VPRID)**
2. **Mapping vertical and underground ownership and occupancy rights**
3. **Supporting volumetric cadastre systems (ISO 19152 LADM compliant)**
4. **Enabling accurate urban property governance and municipal compliance**
5. **Reducing ownership conflicts, property tax leakage, and title ambiguities**
6. **Improving infrastructure planning, utility coordination, and excavation safety**

---

## 🎯 BHARAT 3D Alignment Matrix

| SIH PS Requirement | BHARAT 3D Module / Architectural Component |
| :--- | :--- |
| **Surface Land Parcels** | PostGIS 2D Cadastral Layer with standard 14-digit ULPIN binding. |
| **Multi-Storey Apartments** | Volumetric parceling (`VPRID`), floor segmentation, unit partitioning, multi-tenant rights. |
| **Underground Infrastructure** | 3D Polyhedral / Mesh subsurface registry for tunnels, metro tracks, basements, and utilities. |
| **Elevated Corridors** | 3D spatial infrastructure layers for flyovers and skywalks independent of ground parcel ownership. |
| **Multi-Source Data Fusion** | Unified CRS normalization (EPSG:4326/EPSG:3857/UTM) engine fusing Drone, LiDAR, CAD, GNSS, DEM. |
| **AI/ML Automated Extraction** | UNet/Mask R-CNN building footprint extraction, DSM-DTM height calculation, floor inference engine. |
| **Topology Validation** | 3D geometric validation engine ensuring no spatial overlaps, gaps, or illegal boundary breaches. |
| **Bylaw & Compliance** | Automated detection of front/rear/side setback violations, unauthorized extra floors (G+N), footpath encroachment. |
| **Excavation & Utilities** | 3D buffer-intersection risk engine for underground excavation safety and conflict detection. |
| **Governance & Tax** | Separation of Physical Identity, Ownership, and Occupancy linked with municipal tax assessment. |

---

## 🏛️ Guiding Architectural Principle

> **"Keep India's existing 2D cadastral / ULPIN system as the foundation, and add a 3D spatial layer only where property or infrastructure has meaningful vertical extent."**
> 
> *2D is the foundation. 3D is the volumetric extension.*
