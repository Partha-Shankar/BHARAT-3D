# 🇮🇳 BHARAT 3D
### **2D-to-3D Spatial Property & Infrastructure Registry**
*Sovereign Volumetric Cadastre, 3D Digital Twin & Subterranean Spatial Infrastructure Platform*

---

## 🌟 Overview

**BHARAT 3D** is a modern geospatial intelligence platform that upgrades 2D land records into high-precision 3D digital twins. It maintains India's 2D land parcel identification (ULPIN / Bhu-Aadhaar) as the ground foundation, while introducing sovereign 3D property identifiers (VPRIDs) for vertical real estate and infrastructure.

```text
                             AIR / UPPER REALM (+Z)
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Multi-Storey Apartments (Floors 1-12) with Individual Flat Titles     │
  │  Commercial Shopping Mall Retail Showrooms                             │
  │  Elevated Arterial Flyover (+8.5m Air-Rights Corridor)                 │
  └────────────────────────────────────────────────────────────────────────┘

GROUND LEVEL ═════════════════════════════════════════════════════════════════
  │  2D Cadastral Land Parcels (Base ULPIN)                                │
  │  Surface Roads, Footpaths, Public Rights-of-Way (RoW)                  │
  ═════════════════════════════════════════════════════════════════════════════

                          SUBTERRANEAN REALM (-Z)
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Multi-Level Subterranean Basement Parking (-6.0m)                     │
  │  Underground Water Mains, Telecom Ducts & Power Lines (-1.8m to -3.2m) │
  │  Subterranean Rapid Transit Metro Tunnel & Station (-14.2m)            │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Capabilities

1. **2D-to-3D Selective Cadastre**: 2D base parcels remain the legal anchor, while 3D volumetric parcels (VPRIDs) are generated for vertically stratified buildings, elevated flyovers, and subterranean tunnels.
2. **Dedicated 3D Digital Twin**: Realistic procedural satellite terrain, curved flyovers, multi-lane roads, and individual apartment floor subdivisions.
3. **360° Subterranean Exploration**: Full spherical orbit navigation below ground level to inspect metro transit corridors, basement parking, and utility duct banks.
4. **Automated Enforcement**: Flags unauthorized building floors, setback violations, and airspace encroachments against sanctioned plans.
5. **Dig-Safe Clash Prevention**: 3D buffer clash detection for proposed excavation trenches against underground utilities and transit tunnels.

---

## 👥 Four Core Stakeholder Portals

- **👷 Surveyor Studio**: Ingest drone photogrammetry and LiDAR point clouds, delineate survey boundaries, and reconstruct 3D floor slabs and units.
- **🏛️ Municipal Enforcement**: Automated height and setback compliance detection with instant violation notices.
- **⚡ Utility Dig-Safe**: 3D subsurface clash analysis and digital excavation NOC clearances.
- **👤 Citizen Property Card**: Search 3D volumetric property deeds, verify title ownership, and pay municipal property taxes online.

---

## ⚡ Quick Start (Local Run)

### 1. Backend Setup (FastAPI & Python 3.11)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
API Documentation: `http://localhost:8000/docs`

### 2. Frontend Setup (React 18 + Vite + TypeScript)
```bash
cd frontend
npm install
npm run dev
```
Open application: `http://localhost:5173`

---

## 🌐 Production Deployment

- **Frontend**: Deploy on [Cloudflare Pages](https://dash.cloudflare.com/) (Output directory: `dist`, Build command: `npm run build`, Env: `VITE_API_URL`).
- **Backend**: Deploy on [Render](https://render.com/) Web Service (Root: `backend`, Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).

Full instructions: [`actual_docs/12_DEPLOYMENT_GUIDE_CLOUDFLARE_AND_RENDER.md`](actual_docs/12_DEPLOYMENT_GUIDE_CLOUDFLARE_AND_RENDER.md).

---

## 📜 Standards & Compliance
- **ISO 19152 LADM** (Land Administration Domain Model)
- **MoHUA Standard B3D-STD-2026-ULPIN-01** (3D Property Identifier Norms)
- **OGC CityGML 3.0 / IndoorGML**
- **WGS84 / EPSG:4326** Coordinate Reference System

---

## 📄 License
Government Spatial Intelligence / Proprietary Cadastre Framework.
