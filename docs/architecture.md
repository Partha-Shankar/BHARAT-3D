# BHARAT 3D — System Architecture

## Core Philosophy
> **"Keep India's existing 2D cadastral / ULPIN system as the foundation, and add a 3D spatial layer only where property or infrastructure has meaningful vertical extent."**

---

## Architectural Topology

```text
                                  PRESENTATION LAYER
                       React 18 + TypeScript + Vite + TailwindCSS
                                          │
                                 ┌────────┴────────┐
                                 ▼                 ▼
                          MapLibre GL JS        CesiumJS
                            (2D Engine)       (3D Engine)
                                          │
══════════════════════════════════════════╪═════════════════════════════════════════
                                   REST & SSE APIs
                                          │
                                   FASTAPI GATEWAY
                                 (JWT Auth & RBAC)
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 ▼                        ▼                        ▼
         Spatial & Registry         Bylaw Compliance       Excavation Safety
              Service                    Engine                 Analyzer
                 │                        │                        │
                 └────────────────────────┼────────────────────────┘
                                          │
                                  PROCESSING ENGINE
                          (DemoProcessingEngine / RealML)
                                          │
══════════════════════════════════════════╪═════════════════════════════════════════
                                   PERSISTENCE TIER
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
        SQLite / PostgreSQL +                             Local File / Object
       PostGIS Spatial Database                                 Storage
```

---

## Component Separation
1. **Frontend**: Enterprise GIS interface with 5 role-specific portals (Surveyor, Municipality, Utility Operator, Citizen, Admin).
2. **Backend**: FastAPI with async route handlers, dependency injection, and Pydantic schemas.
3. **Processing Engine**: Interface-based design (`ProcessingEngine` base class) with `DemoProcessingEngine` for the 45s hackathon stream, fully pluggable for `RealProcessingEngine` in production.
4. **Data Persistence**: Unified schema supporting 2D Cadastral Parcels, 3D Buildings, Floors, Volumetric Units (VPRIDs), Infrastructure Assets, Ownership, Leases, Taxes, Violations, and Audit Events.
