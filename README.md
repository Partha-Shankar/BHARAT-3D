<p align="center">

# BHARAT 3D

**2D-to-3D Spatial Property and Infrastructure Registry**

A geospatial land-administration platform that keeps India's two-dimensional parcel identity as the legal base, and adds a volumetric record where property and infrastructure rise above the ground or continue beneath it.

</p>

<p align="center">

[![Live demo](https://img.shields.io/badge/LIVE%20DEMO-bharat--3d.pages.dev-0f172a?style=for-the-badge)](https://bharat-3d.pages.dev/)
[![Research paper](https://img.shields.io/badge/RESEARCH%20PAPER-Read-1d4ed8?style=for-the-badge)](https://drive.google.com/file/d/1kvqzkMEoMkUsR5eao9VdZZps2BJJOVbO/view)
[![YouTube presentation](https://img.shields.io/badge/YOUTUBE%20PRESENTATION-Watch-b91c1c?style=for-the-badge)](https://www.youtube.com/watch?v=4fDEwOVy2ug)
[![Blog](https://img.shields.io/badge/BLOG-Read-0f766e?style=for-the-badge)](https://paladuguganesh.blogspot.com/2026/09/bharat-3d-3d-land-administration.html)
[![Demo video](https://img.shields.io/badge/DEMO%20VIDEO-Watch-7c3aed?style=for-the-badge)](https://www.youtube.com/watch?v=BHARAT3DDEMO)

</p>

## Project links

| | |
| --- | --- |
| **Live demo** | [https://bharat-3d.pages.dev/](https://bharat-3d.pages.dev/) |
| **Research paper** | [BHARAT 3D research paper](https://drive.google.com/file/d/1kvqzkMEoMkUsR5eao9VdZZps2BJJOVbO/view) |
| **YouTube presentation** | [https://www.youtube.com/watch?v=4fDEwOVy2ug](https://www.youtube.com/watch?v=4fDEwOVy2ug) |
| **Blog** | [BHARAT 3D: 3D land administration](https://paladuguganesh.blogspot.com/2026/09/bharat-3d-3d-land-administration.html) |
| **Demo video** | [https://www.youtube.com/watch?v=BHARAT3DDEMO](https://www.youtube.com/watch?v=BHARAT3DDEMO) |

[![React](https://img.shields.io/badge/frontend-React%2018-111827)](frontend/package.json)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-111827)](frontend/package.json)
[![FastAPI](https://img.shields.io/badge/api-FastAPI-111827)](backend/requirements.txt)
[![Python](https://img.shields.io/badge/python-3.11-111827)](backend/requirements.txt)

---

## Proposed solution

**3D ULPIN for vertical and underground rights**

One ground number is not enough. A 14-digit ULPIN names the land on the ground. A flat, a basement car park, and a metro tunnel can all sit inside that same footprint. The record as it stands cannot say which volume belongs to whom. Ownership disputes begin where the map stays flat.

The same parcel, read as height rather than as a polygon:

```text
Air-rights corridor          +8 m to +11 m
Flat 804                     +24 m to +27 m
Floor plate of the building
Parent parcel                14-digit ULPIN
Basement parking             -7 m to -1 m
Metro segment                -14 m to -10 m
```

### The 3D ULPIN extension

1. Keep the existing 14-digit ULPIN as the parent parcel.
2. Give every owned volume a child identity made of parent, level, and unit.
3. Store the height range of that volume in metres.
4. A surveyor confirms the volume before the identity is saved.

| Level | 3D identity | Height |
| --- | --- | --- |
| Parent parcel | `48291503726481` | ground |
| Flat 804 | `48291503726481-F08-U804` | +24 m to +27 m |
| Basement | `48291503726481-B02` | −7 m to −1 m |
| Metro segment | `48291503726481-M01` | −14 m to −10 m |

The national ULPIN stays the same. It is extended only where the property has a vertical or underground extent.

---

## About

BHARAT 3D is built for the problem created by vertical cities. A conventional land record can name a plot. It cannot, by itself, name the flat on the eighth floor of a tower that shares that plot, the flyover that occupies the air above a road, or the metro and utilities that run underneath private land. Those are different legal and engineering objects. They happen to share the same ground coordinates.

The platform treats the existing Unique Land Parcel Identification Number (ULPIN) as the parent identity of the surface parcel. Where a building, floor, unit, flyover, tunnel, or utility has real vertical extent, BHARAT 3D attaches a volumetric child identity, the Volumetric Property Reference ID (VPRID). Two-dimensional parcels stay two-dimensional. Three-dimensional records are created only where height or depth changes the meaning of the property.

This repository contains the BHARAT 3D application: role-based workspaces for the surveyor, the municipal authority, the utility operator, and the citizen; a spatial API; a two-dimensional cadastral map; a three-dimensional ward viewer; and prepared urban survey areas used to exercise that workflow. The platform is designed around a volumetric data model, survey ingestion and fusion, candidate geometry, compliance checks, excavation safety, and access control.

The reference story in the application is **Central Heights, Ward 16**. A surveyor opens that ward, stays on the two-dimensional cadastre, then enters the three-dimensional world to inspect a condominium unit, an unsanctioned commercial floor, an elevated flyover, and an underground metro.

BHARAT 3D was developed for Smart India Hackathon problem statement **26011**, *3D ULPIN Generation and Vertical Property Mapping System*, in the area of software, smart governance, urban land records, and GIS.

---

## GitHub repository about

Use the following in the repository About settings.

| Field | Value |
| --- | --- |
| Description | A 2D-to-3D spatial property and infrastructure registry. The land-parcel ULPIN stays the legal parent. Volumetric identities cover flats, flyovers, and underground infrastructure. |
| Website | `https://bharat-3d.pages.dev/` |
| Topics | `gis` `cadastre` `ulpin` `land-administration` `digital-twin` `geospatial` `3d` `fastapi` `react` `smart-india-hackathon` |

---

## Contents

- [Project links](#project-links)
- [Proposed solution](#proposed-solution)
- [The problem](#the-problem)
- [What the platform does](#what-the-platform-does)
- [Design principle](#design-principle)
- [Who it is for](#who-it-is-for)
- [Workspaces](#workspaces)
- [Reference ward](#reference-ward)
- [Spatial model](#spatial-model)
- [Property identity](#property-identity)
- [System architecture](#system-architecture)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API](#api)
- [Data](#data)
- [Security and access](#security-and-access)
- [Deployment](#deployment)
- [Standards](#standards)
- [License](#license)

---

## The problem

Indian land administration is anchored on a two-dimensional parcel. The ULPIN identifies that parcel from its location on the ground. That model is sufficient for a plotted house whose land and building are one property. It is not sufficient for the way dense cities are actually built and used.

Four situations break a flat map:

1. **Stacked ownership.** A condominium can place dozens of separately owned flats on one ground footprint. Each flat has its own carpet area, enclosed volume, title, tax, and share of the parent land. They share X and Y. They do not share Z.
2. **Air rights.** Flyovers, elevated corridors, and similar structures occupy a band of space above a road or a parcel. The road on the map and the deck above it are not the same object.
3. **Subsurface rights and risk.** Metro tunnels, basement parking, water mains, and telecom ducts cross beneath parcels that a surface map still shows as empty ground. Excavation planned from a two-dimensional drawing can strike infrastructure that was never drawn in the same record.
4. **Vertical compliance.** A building can be sanctioned to one height and constructed to another. Extra floors, setback breaches, and footpath encroachments are spatial facts. They are difficult to see when the only official geometry is a polygon on the ground.

BHARAT 3D is the record that holds those facts together: the parent parcel, the vertical property, the infrastructure above and below, and the comparison between what was sanctioned and what is standing.

---

## What the platform does

The surveyor-facing path is the spine of the product.

1. Sign in to a role-specific workspace.
2. Open a cadastral survey project for a ward.
3. Delineate or confirm the survey boundary on the two-dimensional map.
4. Bring in a multi-modal survey package: drone imagery, LiDAR, GIS, CAD, GNSS, elevation, ownership, and tax.
5. Run the cadastral analysis pipeline, which reports buildings, floors, volumetric units, infrastructure, and potential violations.
6. Inspect the ward in three dimensions: towers, flyovers, and the underground.
7. Open a single unit and read its volumetric identity, area, volume, title, and link back to the parent ULPIN.
8. Review bylaw findings where observed geometry departs from the sanctioned envelope.
9. Confirm the model and generate three-dimensional property identities into the registry.

Other roles read the same spatial record for a different decision:

- Municipal officers review height, setback, and encroachment findings.
- Utility operators test a proposed excavation against subsurface assets.
- Citizens see the property record that belongs to them.

---

## Design principle

The two-dimensional cadastre remains the legal foundation. A volumetric identity is added only where property or infrastructure has vertical extent.

That choice is deliberate.

- Existing parcel identifiers stay intact, so the platform extends today's land record instead of asking a revenue department to replace it.
- Roads, open ground, and parcels without vertical complexity stay light. They are not forced into heavy three-dimensional meshes.
- A flat, a shop, a flyover span, and a tunnel segment can each carry an identity without becoming a new land system.
- Geometry and rights stay separate, in line with ISO 19152 (Land Administration Domain Model). A volume can be described, inspected, and linked to a right without treating a model prediction as a title.

AI in this design proposes candidate geometry: footprints, heights, and floor breaks. The surveyor inspects and corrects that candidate. Deterministic checks then compare the verified geometry with sanctions and with nearby infrastructure. A suggestion does not become a land record by itself.

---

## Who it is for

| Role | Person | Question the workspace answers |
| --- | --- | --- |
| Surveyor | Geospatial lead preparing a ward record | What is the parent parcel, and which vertical objects must receive their own identity? |
| Municipality | Town planning and enforcement | Where does observed height, setback, or footpath occupation depart from the sanction? |
| Utility operator | Excavation and network safety | If a trench is cut here, to this depth, what lies in the way? |
| Citizen | Property holder | What is my unit, its volume, its title, and its tax position? |
| Admin | Platform operator | Who can see which record, and what changed? |

Beneficiaries described by the problem statement are state revenue departments, municipal corporations, town planning authorities, utility operators, and citizens.

---

## Workspaces

Sign-in is at `/login`. Each role opens a protected workspace.

| Role | Email | Password | Entry |
| --- | --- | --- | --- |
| Surveyor | `survey@bharat3d.demo` | `demo2026` | `/surveyor/dashboard` |
| Municipality | `municipality@bharat3d.demo` | `demo2026` | `/municipality/dashboard` |
| Utility operator | `utility@bharat3d.demo` | `demo2026` | `/utility/dashboard` |
| Citizen | `citizen@bharat3d.demo` | `demo2026` | `/citizen/dashboard` |
| Admin | `admin@bharat3d.demo` | `demo2026` | Surveyor workspace |

The login screen can preselect a role. The password is shared across these accounts so a reviewer can move through the same ward from four points of view.

### Surveyor studio

The surveyor workspace is the authoring environment.

| Route | Purpose |
| --- | --- |
| `/surveyor/dashboard` | Ward summary: parcels, buildings, volumetric units, infrastructure, and bylaw flags |
| `/surveyor/projects` | Survey projects and their status |
| `/surveyor/area` | Survey-boundary delineation on the two-dimensional map |
| `/surveyor/upload` | Multi-modal package intake |
| `/surveyor/processing` | Staged cadastral analysis and live counts |
| `/surveyor/map` | Two-dimensional base cadastre for the active area |
| `/surveyor/3d-viewer`, `/3d-space/:areaId` | Full-screen three-dimensional ward |
| `/surveyor/editor` | Human review of floors, units, and infrastructure before identities are issued |
| `/surveyor/registry` | Searchable three-dimensional property registry |
| `/surveyor/violations` | Bylaw findings for the ward |
| `/surveyor/audit` | Audit trail |

The standard ingestion path on the dashboard is: area selection, multi-modal upload, analysis, surveyor review.

### Municipal enforcement

Municipal users inspect the same geometry against sanctions: unauthorised upper floors, setback breach, and occupation of the public footpath. Findings can be reviewed and a notice can be issued from the violations API.

### Utility dig-safe

Utility users describe a proposed excavation, including trench depth, and run a subsurface clash analysis. The check distinguishes a shallow strike, a buffer breach, and a deep asset that still has clearance. The reference case is a 2.0 metre trench against telecom, a water main, and the metro tunnel.

### Citizen property card

The citizen workspace is limited to that person's property: unit identity, area, volume, title, and tax. It is the public face of the same volumetric record, not a second map of the whole ward.

---

## Reference ward

The primary prepared area is **Central Heights (Ward 16)**, `area_01`, centred near longitude `77.2090` and latitude `28.6280`.

Use it in this order when showing the product:

1. Sign in as the surveyor.
2. Read the workspace counts for the ward.
3. Open the two-dimensional cadastre and enter the three-dimensional world.
4. Select **Aarav Heights Tower A** (`BLD-01-01`). Twelve floors share one parent parcel, `IN-DL-01-849201`.
5. Open floor 8, flat 804. The unit card shows carpet area `108.5 sq.m`, enclosed volume `347.2 m3`, an undivided land share of the parent parcel, and a volumetric identity of the form `IN-DL-01-849201-B01-F08-U804-R`.
6. Switch to **Violations** and inspect **Sharma Commercial Plaza**. The sanctioned envelope is ground plus four at `14.5 m`. The standing structure is ground plus six at `22.8 m`. Floors 5 and 6 are drawn in red. The inspector also records a `3.5 m` footpath overlap and a `2.1 m` side-setback breach.
7. Switch to **Underground Metro**. The Yellow Line station is recorded `14.2 m` below the ward.

The three-dimensional viewer also includes a top orthographic view, underground parking, a 360-degree orbit keypad, and an optional surface hide so subsurface assets can be read clearly.

Other prepared areas, `area_02` through `area_10`, follow the same package shape so the workflow can be repeated on more than one ward.

---

## Spatial model

The city is modelled as three vertical realms on one cadastral base.

```text
AIR
  Apartment and commercial volumes
  Elevated flyovers and decks

GROUND
  Two-dimensional parcels and ULPIN
  Roads, footpaths, and rights of way

SUBSURFACE
  Basements and parking
  Metro and road tunnels
  Water, telecom, and power
```

| Realm | Examples in the reference ward | Identifier |
| --- | --- | --- |
| Air | Condominium units, flyover deck | VPRID / infrastructure id |
| Ground | Cadastral parcel, plot, road, footpath | Base ULPIN |
| Subsurface | Metro, basement parking, utility lines | Infrastructure volumetric id |

A plotted villa whose land and building are one freehold can remain on the base ULPIN. A condominium flat receives its own volumetric child. An unsanctioned volume can be refused an identity and held as a compliance rejection instead of being quietly registered.

---

## Property identity

A volumetric identifier is a readable child of the parent parcel, not a replacement for it.

```text
IN-DL-01-849201 / B01 / F08 / U804
        |          |     |      |
   parent ULPIN   block floor  unit
```

| Segment | Meaning |
| --- | --- |
| Base ULPIN | Immutable parent parcel |
| Building block | Structural envelope on that parcel |
| Floor | Vertical index, including basements where used |
| Unit | Private volume or, where modelled, a common area |
| Spatial hash | Optional octree-style locator for indexing |

Infrastructure that crosses many parcels uses its own infrastructure identity, for example a tunnel or flyover segment, with elevation or depth stored on the asset.

The registry is designed so that title, lease, tax, and geometry can be queried separately and then joined. A unit can show an owner, an occupancy lease, and a tax status without collapsing those into the mesh.

---

## System architecture

```text
Workspaces
  Surveyor  |  Municipality  |  Utility  |  Citizen
        |            |            |           |
        +------------+------------+-----------+
                         |
                    React application
              MapLibre GL (2D)   Three.js (3D ward)
                         |
                    HTTPS  /api
                         |
                    FastAPI
         Auth and RBAC  |  Projects and jobs
         Buildings, floors, units  |  Violations
         Infrastructure  |  Excavation  |  Audit
                         |
              SQLAlchemy  +  prepared survey areas
         SQLite in this repository
         PostGIS in the target spatial deployment
```

Five tiers describe the intended platform. The repository implements the presentation tier, the API tier, the domain model, and the ward datasets. The processing, storage, and governance tiers below are the design those services are built toward.

| Tier | Responsibility | In this design |
| --- | --- | --- |
| Presentation | Role workspaces, 2D map, 3D ward | React, MapLibre GL, Three.js |
| API | Authentication, projects, registry, compliance, excavation | FastAPI, JWT, OpenAPI |
| Workers | Ingestion, harmonisation, candidate geometry | Staged processing service; pluggable engine |
| Spatial store | Parcels, volumes, infrastructure, audit | SQLAlchemy models; SQLite locally; PostGIS for spatial deployment |
| Governance | Bylaws, clash checks, role boundaries | Violation and excavation services, RBAC |

### Intended data path

The architecture is designed as a single path from a survey package to a certified identity:

1. The surveyor submits drone imagery, LiDAR, cadastral GIS, CAD or BIM, GNSS control, and elevation.
2. Files are validated before they enter the working set.
3. Coordinates are harmonised, including to EPSG:4326 for the web map and a metric UTM projection for measurement.
4. Layers are co-registered so imagery, point clouds, and drawings describe the same place.
5. The AI layer proposes footprints, classes, heights, and floor breaks. Bharat 3D ReconNet is the reconstruction model in that design, alongside imagery segmentation and point-cloud classification.
6. Geometry is reconstructed as floor and unit volumes, with topology checks for closed, non-overlapping solids.
7. The surveyor reviews and corrects the candidate.
8. Volumetric identities are allocated under the parent ULPIN.
9. Compliance compares observed envelopes with sanctions. Excavation analysis compares a proposed trench with utility and tunnel buffers.
10. The result is stored for map, registry, and role-specific queries.

---

## Technology

### Application in this repository

| Layer | Choice | Why it is here |
| --- | --- | --- |
| UI | React 18, TypeScript, Vite | Role workspaces and fast local development |
| Styling | Tailwind CSS | Consistent cadastral interface |
| Client state | Zustand | Session, area, and map selection |
| Server state | TanStack Query | Project and registry fetches |
| HTTP | Axios | API client with bearer token |
| 2D map | MapLibre GL JS | Parcel view on OpenStreetMap raster tiles |
| 3D ward | Three.js | Orbit, floor picking, underground view |
| API | FastAPI, Pydantic, ORJSON | Typed JSON API and `/docs` |
| Auth | JWT (`python-jose`), bcrypt (`passlib`) | Role-bearing access tokens |
| ORM | SQLAlchemy 2, aiosqlite | Async persistence for local runs |
| Geometry helpers | Shapely, PyProj, GeoJSON | Measurement and coordinate handling |
| Tables | pandas, openpyxl | Ownership and tax tables in survey packages |

### Target platform described in the architecture

These components are part of the BHARAT 3D design. They are the intended production shape of the pipeline and the spatial store.

| Concern | Design |
| --- | --- |
| Spatial database | PostgreSQL with PostGIS 3D geometry and spatial indexes |
| Object storage | S3-compatible store for imagery, point clouds, CAD, and tiles |
| Task execution | Asynchronous workers for long ingestion jobs |
| AI | Imagery segmentation, LiDAR classification, Bharat 3D ReconNet for envelopes and floor structure |
| Delivery of 3D | OGC 3D Tiles so detail streams as the user approaches a building |
| Interoperability | CityGML-style levels of detail; LADM separation of geometry and rights |
| Access | OAuth2-style JWT and five-role RBAC |

---

## Repository layout

```text
.
├── frontend/                 React application
│   └── src/
│       ├── pages/            Landing, login, surveyor, municipality, utility, citizen
│       ├── components/       Map, 3D viewer, inspector, layout, UI
│       ├── hooks/            Projects, buildings, processing, violations
│       ├── stores/           Auth and app state
│       └── lib/              API client and auth helpers
├── backend/
│   └── app/
│       ├── api/              Route modules
│       ├── core/             Settings, database, security, dependencies
│       ├── models/           SQLAlchemy domain model
│       ├── schemas/          Pydantic contracts
│       ├── services/         Auth, spatial, processing, excavation
│       └── demo/             Area selection and processing engine
├── data/                     Prepared areas, datasets, and survey packages
├── prepared_upload/          Ready-to-ingest survey packages
├── render.yaml               Render web-service definition for the API
├── run.py                    Local orientation script and credential printout
└── README.md
```

---

## Requirements

- Python 3.11
- Node.js 18 or newer, with npm
- A modern Chromium-based browser for the map and the WebGL ward view

Optional, for the documented spatial deployment: PostgreSQL with PostGIS, and an object store for raw survey files.

---

## Getting started

### 1. Clone and enter the repository

```bash
git clone <repository-url>
cd 01_Actual_Project
```

### 2. Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

macOS or Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

On startup the API creates tables. Change `SECRET_KEY` in `.env` before any shared deployment.

`python run.py` from the repository root prints the service URLs, the role credentials, and the data-seed commands. Start the API and the web app in two terminals as shown above.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies `/api` to `http://localhost:8000`, so the browser can call the API without a separate CORS setup during local development.

### 4. Production build of the web app

```bash
cd frontend
npm run build
npm run preview
```

The build runs the TypeScript project check and then Vite. Output is written to `frontend/dist`.

### 5. First session

1. Open `/login`.
2. Choose **Surveyor**.
3. Continue into the cadastral workspace.
4. Open **2D/3D Cadastre Map**, then enter the three-dimensional world for Central Heights.

---

## Configuration

Backend settings live in `backend/.env`. The sample file is `backend/.env.example`.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite+aiosqlite:///./bharat3d.db` |
| `SECRET_KEY` | JWT signing secret | Replace before any shared deployment |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `480` |
| `DEMO_MODE` | Use prepared ward data for the application flow | `true` |
| `DATA_DIR` | Root of prepared geospatial data | `../data` |
| `UPLOAD_DIR` | Incoming survey uploads | `../data/uploads` |
| `CESIUM_ION_TOKEN` | Reserved for a Cesium ion terrain or tileset | empty |

Frontend:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Absolute API origin for a deployed frontend. When unset, the app calls `/api` on the same host, which the Vite proxy serves in development. |

Do not commit a real `.env`. Do not reuse the sample secret outside a local machine.

---

## API

All application routes are mounted under `/api`. Authenticated routes expect `Authorization: Bearer <token>` from `POST /api/auth/login`.

| Group | Prefix | What it covers |
| --- | --- | --- |
| Auth | `/api/auth` | Login, current user, logout |
| Projects | `/api/projects` | Projects, survey area, datasets, processing, map, 3D scene, registry, identity generation, archive, finalize |
| Jobs | `/api/jobs` | Processing job status |
| Buildings | `/api/buildings` | Buildings, floors, add floor |
| Units | `/api/units` | Unit, ownership, tax, lease, split a floor into units |
| Violations | `/api/violations` | Findings, notice, bylaw analysis for a building |
| Infrastructure | `/api/infrastructure` | Tunnels, flyovers, utilities, and related assets |
| Excavation | `/api/excavation` | Analyse, clash check, permit application |
| Citizen | `/api/citizen` | My properties, lookup by identifier, tax payment |
| Audit | `/api/audit` | Audit events |
| Maps | `/api/maps` | Dataset map payload |
| Health | `/health` | Process health, outside the `/api` prefix |

The OpenAPI document generated by FastAPI is the contract to trust while exploring: `http://localhost:8000/docs`.

Example login body:

```json
{
  "email": "survey@bharat3d.demo",
  "password": "demo2026"
}
```

---

## Data

Prepared content is organised so a ward can be loaded without assembling a survey from scratch.

| Path | Contents |
| --- | --- |
| `data/demo/areas/area_01` … `area_10` | Ward packages: parcels, roads, buildings, floors, units, infrastructure, violations, ownership, tax, metrics, elevation |
| `data/demo/dataset_01` … `dataset_10` | Legacy dataset layout of the same kind |
| `prepared_upload/survey_package_01` … `survey_package_10` | Packages aligned with the ingestion screen |
| `data/survey_packages/` | Modality folders such as drone, LiDAR, GNSS, floor plans, and deeds |

A full area package is specified to include, among other files:

`parcels.geojson`, `roads.geojson`, `footpaths.geojson`, `buildings.geojson`, `floors.geojson`, `units.geojson`, `utilities.geojson`, `violations.geojson`, `ownership.csv`, `tax.csv`, `metrics.json`, `metadata.json`, `3d_data.json`, plus elevation and imagery assets where present.

Project status moves through `DRAFT`, `PROCESSING`, `REVIEW`, `CONFIRMED`, and `PUBLISHED`. Processing jobs move through `QUEUED`, `RUNNING`, `COMPLETE`, and `FAILED`.

Domain tables in `backend/app/models/models.py`:

`users`, `projects`, `datasets`, `processing_jobs`, `parcels`, `buildings`, `floors`, `vertical_units`, `infrastructure_assets`, `ownership`, `leases`, `tax_records`, `violations`, `audit_events`.

---

## Security and access

Access is role-based. The five roles are `SURVEYOR`, `MUNICIPALITY`, `UTILITY_OPERATOR`, `CITIZEN`, and `ADMIN`.

- Passwords are stored as hashes.
- Sessions are JWTs signed with `SECRET_KEY`.
- The citizen portal is designed to return that citizen's property, not the full ward roll.
- Audit events record significant changes so a registry edit can be reviewed later.
- The sample secret and the shared review password are for local and evaluation use. Replace both before any deployment that is not a private demonstration.
- A surveyor's confirmation is separate from an AI candidate and from a municipal notice. A suggestion does not become a land record by itself.

---

## Deployment

### Web application

The public frontend is deployed on Cloudflare Pages:

[https://bharat-3d.pages.dev/](https://bharat-3d.pages.dev/)

| Setting | Value |
| --- | --- |
| Root | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment | `VITE_API_URL` pointing at the API origin, with no trailing slash |

### API

`render.yaml` defines a Python web service:

| Setting | Value |
| --- | --- |
| Root | `backend` |
| Build | `pip install -r requirements.txt` |
| Start | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Python | 3.11.9 |

Set `SECRET_KEY` on the host. Leave `DEMO_MODE` enabled when the deployment should serve the prepared wards.

---

## Standards

The data model and identifiers are designed against the following references:

- ISO 19152, Land Administration Domain Model, separating spatial units from rights, restrictions, and responsibilities
- Department of Land Resources ULPIN practice for the parent parcel
- OGC CityGML and 3D Tiles as the interchange and delivery model for volumetric geometry
- EPSG:4326 (WGS 84) for web mapping, with metric UTM for measurement
- National Building Code and municipal sanction envelopes as the inputs to height and setback checks

Alignment with a standard means the model is shaped to that standard. It is not a claim of formal certification.

---

## License

Government spatial-intelligence / proprietary cadastre framework.

All rights reserved unless a separate license file is added to this repository. Do not assume an open-source license from the presence of this README.
