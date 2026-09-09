# BHARAT 3D: Backend Architecture & REST API Specification

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
