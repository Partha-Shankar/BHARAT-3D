# Backend architecture (short)

## Layers

```
 Browser (React app on Cloudflare Pages)
    │  same-origin /api/*  ── Pages Function proxy (frontend/functions): analytics, R2 area store, /scenes/{key} from R2
    ▼
 api/            FastAPI routers under /api: auth, realgen, ingest, and the legacy demo routers
    │            ── role-based views applied here (core/access.py), after the result is computed
    ▼
 realgen/        the 3D engine: pipeline (generation), scene_ops (edits, floor plans, building detail),
    │            norms (3D ULPIN rules, ledger, integrity axioms), synth / fuse / floorplan / ai_buildings
    ▼
 cache / store   area files on disk (data/generated or REALGEN_CACHE_DIR) ── copied to Cloudflare R2 after each change
```

| Layer | Modules | Responsibility |
|---|---|---|
| API | `app/api/*.py`, `app/core/deps.py` | HTTP, sign-in (`get_current_user`, `get_optional_user`), editor-only writes (`_require_editor`), role-based views |
| Access policy | `app/core/access.py` | Pure, shape-preserving redactors; see [ACCESS_POLICY.md](ACCESS_POLICY.md) |
| Engine | `app/realgen/` | Generation from a drawn polygon, edits, derivation (findings, INF IDs, registry, integrity) |
| Norms | `app/realgen/norms.py` | 3D ULPIN syntax, classification, the append-only unit ledger, UDS, integrity axioms |
| Ingestion (pseudo-code) | `app/ingest/` | Format detection and processing plans for LiDAR, IFC, DXF and GNSS; see [INGESTION_PSEUDOCODE.md](INGESTION_PSEUDOCODE.md) |
| Storage | `app/realgen/cache.py`, `app/realgen/store.py` | JSON files per area. Durable copy in R2 through the Pages Function (`STORE_URL` / `STORE_TOKEN`); off when unset. |
| Users and projects | `app/core/database.py`, `app/models/` | SQLite (SQLAlchemy async); demo accounts created at startup |

## Where role filtering happens

Only in the route handlers, as the last step: `access.view_of(user)` picks the view, the matching `redact_*`
function returns either the original object (surveyor, admin) or a redacted deep copy, and the handler sets
`X-BHARAT3D-View`. The engine never sees the caller's role, and the cached scene dicts are never mutated. Write
endpoints keep their existing editor check.

## Where ingestion plugs in

`POST /api/realgen/generate` stores the survey manifest in `ingest.json` (as before) and, best effort, the plan from
`app.ingest.plan_for_manifest` in `ingest_plan.json`. `GET /api/realgen/scenes/{key}/ingest-plan` and `/api/ingest/*`
expose the plans. Nothing in the engine reads them yet: this is the seam where real readers would feed measured
evidence (heights, unit polygons, ground control) into `scene_ops`.

## Map data, the area pre-check and live progress

Public Overpass servers are often overloaded or unreachable, so `fetch_osm.fetch_overpass` races them on a schedule
(two at once, more mirrors after a few seconds, then the OpenStreetMap API 0.6 `map` call converted to the same
"out geom" shape and tag rules), over IPv4, within a 75 s deadline. A download for the same box is shared and kept in
memory for 30 minutes. If no source answers it raises `SourceUnavailable`, and the job then retries once.

`POST /api/realgen/preflight` runs when the surveyor confirms an area. It checks the size limits and that the area is
in India, notes when the area was generated before, and starts the map download that generation will reuse. It then
counts the buildings: `ok` below 450, `warn` from 450 (slow, the user decides), `block` above 900 (draw a smaller
area), and `busy` when the map servers are down.

`app.realgen.progress` passes live notes from the downloads (map servers tried, tiles fetched) to the running job.
`GET /api/realgen/jobs/{id}` returns them in `log`, together with `stage_progress`, `stage_started_s`, `attempt`,
`error_kind` (`busy` | `area` | `internal`) and `error_detail`. The generation page uses these to animate its
progress between server updates, show what is happening, and offer a retry.

## What is real and what is synthetic

| Real (open data, fetched per area) | Estimated (models) | Synthetic (deterministic from the polygon seed) |
|---|---|---|
| Building footprints, roads, rail, water and tunnels (OpenStreetMap, ODbL) | Unmapped buildings detected in imagery: proposals until a surveyor verifies them | Parcels and 14-character ULPINs, 3D ULPIN / VPRID registry |
| Terrain elevation | Heights of untagged buildings (typology model, or Depth Anything V2 when ML is enabled) | Sanctions and permits, most utilities |
| Satellite imagery for the ground texture | | Floor plans and unit splits (`floorplan.plan_floor`) |
| | | Owners, occupancy and tax (Faker, `en_IN`); building names and the area summary (Groq LLM or Faker) |

Uploaded survey files are checked in the browser and listed in the survey record; their contents are not processed
(see the pseudo-code readers). The legacy demo routers `/api/units` and `/api/citizen` serve demo records
(`data/demo/areas/*/units.geojson` and literals in code); the current web app does not call them.

## Tests

`backend/tests/`: `unit/` (pure functions: norms, synthetic ULPIN, local frame, access), `api/` (endpoints through
TestClient with fake users and a temp copy of one seed area), `ingest/` (readers, registry, ingest endpoints), plus
the original `test_realgen.py` and `test_scene_ops.py`. Run `cd backend && python -m pytest -q`; coverage of the new
modules: `python -m pytest --cov=app.core.access --cov=app.ingest` (needs `requirements-dev.txt`).
