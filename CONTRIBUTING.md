# Development guidelines

BHARAT 3D is proprietary software of Partha Shankar and the BHARAT 3D team (see [LICENSE](LICENSE)). These are the
rules the team follows for every change.

## Before every commit

| Part | Command (from the folder) | Must |
| --- | --- | --- |
| Backend tests | `cd backend` then `python -m pytest -q` | pass |
| Backend lint | `cd backend` then `ruff check .` | pass |
| Frontend types | `cd frontend` then `npx tsc --noEmit` | pass |
| Frontend build | `cd frontend` then `npm run build:pages` | pass |

The same checks run on every push in GitHub Actions (`.github/workflows/ci.yml`).

## Architecture

- **Backend** (`backend/app/`): `api/` holds thin FastAPI routers (validation, sign-in, HTTP errors) that call the
  domain modules; `core/` holds settings, security, database, the role-based access policy and keep-awake;
  `realgen/` is the 3D generation engine and the durable area store; `ingest/` holds the survey-file readers and
  the inspection of uploaded files; `models/` and `schemas/` hold persistence and API contracts.
- **Frontend** (`frontend/src/`): `pages/` (one screen each), `components/` (shared layout and overlays), `lib/`
  (API client, session, roles, server status, analytics), `stores/` (state), `survey/` and `world/` (survey tools and
  the 3D engine).
- **Edge** (`frontend/functions/`): the same-origin `/api` proxy, the area store and analytics on Cloudflare Pages.
- One source of truth per concept (roles in `lib/roles.ts`, identifier rules in `survey/norms.ts` and
  `realgen/idcheck.py`).

## Code style

- Python: PEP 8 naming, type hints, a docstring on every module and public function, line length 120.
- TypeScript / React: functional components, camelCase functions, PascalCase components and types, named constants
  with units, no unused code or assets.
- Comments explain why something is done, not what the next line does.
- User-facing text is plain English in sentence case, and every message says what happened and what happens next.

## Compatibility

- Existing API responses never change shape; new behaviour comes as new endpoints or optional fields.
- No secrets in the repository: signing keys and tokens come from the environment.
- Accessibility basics on every screen: keyboard use, visible focus, labelled controls, announced status messages.
- Every screen works at 390 px wide without sideways scrolling.

## Commits

`type(scope): summary` with `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore` or `ci`. Every bug fix comes
with a test that fails without it.
