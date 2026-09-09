# BHARAT 3D — REST API Reference

## Base URL: `/api`

### Authentication
* `POST /api/auth/login` — Authenticate and receive JWT access token
* `GET /api/auth/me` — Get authenticated user profile and role
* `POST /api/auth/logout` — Invalidate session

### Projects & Ingestion
* `GET /api/projects` — List all survey projects
* `POST /api/projects` — Create a new survey project
* `GET /api/projects/{id}` — Get project metadata
* `POST /api/projects/{id}/area` — Set survey boundary polygon
* `GET /api/projects/{id}/datasets` — List ingested datasets
* `POST /api/projects/{id}/datasets` — Upload multi-modal survey files
* `POST /api/projects/{id}/process` — Start 45-second AI extraction job
* `GET /api/jobs/{job_id}` — Poll job progress (0-100%, 16 stages)

### 3D Cadastre & Editor
* `GET /api/projects/{id}/3d` — Get 3D GeoJSON for CesiumJS & MapLibre
* `GET /api/projects/{id}/registry` — Get cadastral summary metrics
* `POST /api/projects/{id}/finalize` — Finalize dataset and allocate VPRIDs
* `GET /api/buildings?project_id=...` — List buildings
* `GET /api/buildings/{id}` — Get building details
* `GET /api/buildings/{id}/floors` — Get floors for a building
* `POST /api/buildings/{id}/floors` — Add a floor
* `POST /api/floors/{floor_id}/split` — Split a floor into N units
* `GET /api/units/{id}` — Get volumetric unit details

### Ownership, Tax & Violations
* `GET /api/units/{id}/ownership` — Get unit title deed
* `GET /api/units/{id}/tax` — Get municipal tax assessment
* `GET /api/units/{id}/lease` — Get active lease record
* `GET /api/violations?project_id=...` — List detected violations
* `GET /api/bylaws/analyze/{building_id}` — Run bylaw check

### Infrastructure & Excavation
* `GET /api/infrastructure?project_id=...` — List tunnels, flyovers, utilities
* `PUT /api/infrastructure/{id}` — Update infrastructure geometry (Editor)
* `POST /api/excavation/analyze` — 3D buffer clash analysis for proposed trench

### Citizen & Governance
* `GET /api/citizen/my-properties` — Privacy-scoped list of properties owned by current citizen
* `GET /api/audit?project_id=...` — Non-repudiation audit trail logs
