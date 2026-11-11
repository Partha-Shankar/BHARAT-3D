# Access policy: role-based views

BHARAT 3D serves the same 3D record to every signed-in role. What changes by role is **personal and financial
data**: owner names, identity documents, tenancy, tax, and the e-mail addresses of the people who edited an area.

## Sign-in, signing key and API docs

- **Every `/api` route requires sign-in** except `POST /api/auth/login` and `POST /api/auth/logout`. The only other
  public paths are `GET /health` and the satellite textures `GET /api/realgen/scenes/{key}/texture.jpg` and
  `context.jpg` (imagery only; the WebGL loader cannot send a token). Without a valid token every other route answers
  `401`, including the legacy demo routes below.
- **Changes need an editor** (`SURVEYOR` or `ADMIN`; `403` for every other role): generating an area and its
  pre-check (`POST /api/realgen/generate`, `/preflight`), deleting an area, adding, undoing or resetting edits, and
  creating a project or setting its survey area (`POST /api/projects`, `POST /api/projects/{id}/area`).
- **Signing key.** Tokens are signed with `SECRET_KEY` from the environment; there is no built-in value
  ([`config.py`](../backend/app/core/config.py)). With `ENVIRONMENT=production` the backend refuses to start when the
  key is missing, shorter than 32 characters, or a value published in this repository. Elsewhere it uses a random key
  per process, so no machine can sign tokens with a known key.
- **API docs.** `/docs`, `/redoc` and `/openapi.json` are off in production (`ENVIRONMENT=production`; the
  `API_DOCS` setting can override it) and on for local development.
- **Removed demo code.** The early demo routers that the web app no longer used are gone: `/api/buildings`,
  `/api/violations`, `/api/infrastructure`, `/api/excavation`, `/api/audit`, `/api/maps`, `/api/jobs`, the project
  routes for file upload, processing, map/3D data, registry and finalising, `POST /api/units/floors/{id}/split` and
  `POST /api/citizen/pay-tax`. Several of them returned owner, tenant, deed and tax data without sign-in, or reported
  success without doing anything. The tests check that each one is now `404`/`405`.

The policy is implemented in [`backend/app/core/access.py`](../backend/app/core/access.py) and applied in the route
handlers, **after** the existing code has computed the response. The 3D engine (`norms`, `pipeline`, `scene_ops`,
`synth`, `fuse`, `floorplan`, `ai_buildings`) is not involved and is unchanged.

## Views

| Caller | View | `X-BHARAT3D-View` header |
|---|---|---|
| `SURVEYOR`, `ADMIN` | Full: the original response, byte for byte | `full` |
| `MUNICIPALITY` | Municipal | `municipal` |
| `UTILITY_OPERATOR` | Utility | `utility` |
| `CITIZEN` | Public | `public` |
| No valid token | none: `401` | |

An unknown role gets the public view (fail closed). Every response that the policy applies to carries the
`X-BHARAT3D-View` header, so a reviewer can see in the browser's network panel which view was served.

## Policy

| Data | Surveyor, Admin | Municipality | Utility operator | Citizen |
|---|---|---|---|---|
| Geometry, IDs (3D ULPIN, VPRID, INF, CSR), levels, Z ranges, areas, volumes, UDS, status, lineage, easements, subsurface assets | full | full | full | full |
| Sanction and permit numbers, compliance findings (building-level, not personal) | full | full | full | full |
| Unit owner (`owner`, `owner_name`) | full | full | masked | masked |
| `masked_id` | full | full | hidden | hidden |
| `title_deed` | full | full | hidden | last 4 characters |
| Tenancy: `tenant_name`, `monthly_rent`, lease `status` / `lease_status`, `occupancy` / `occupancy_status` | full | full | hidden | hidden |
| Tax: `annual_tax`, `annual_tax_inr`, `assessed_value`, `payment_status`, `amount_paid`, `amount_due` | full | full | hidden | hidden, except on `GET /api/citizen/my-properties` (the caller's own records) |
| Editor identity (`by` in activity and edits) | full e-mail | role label | role label | role label |

Surveyor and admin responses short-circuit: the redactor returns the very object it was given.

## How masked and hidden values look

No key is ever removed and no JSON type ever changes, so the web app renders every view without a code change. Each
choice below was checked against how the frontend renders the field.

| Field | Masked / hidden value | Why this value |
|---|---|---|
| Owner name | `"P**** M****"`: first character of each word, then four stars (the length of the name does not leak) | Rendered as plain text ([`WorldPage.tsx:567`](../frontend/src/pages/world/WorldPage.tsx), [`CitizenPortal.tsx:23`](../frontend/src/pages/citizen/CitizenPortal.tsx)). |
| `occupancy` (3D unit panel) | `"NOT_DISCLOSED"`, shown as "NOT DISCLOSED" | Rendered with `occupancy.replace(/_/g, ' ')` ([`WorldPage.tsx:568`](../frontend/src/pages/world/WorldPage.tsx)): `null` would crash. The field is typed `string` in `sceneSpec.ts`, with no enum or colour map, so any string renders. |
| `annual_tax_inr` | `0` (same numeric type) | Rendered with `annual_tax_inr.toLocaleString('en-IN')` ([`WorldPage.tsx:569`](../frontend/src/pages/world/WorldPage.tsx), [`CitizenPortal.tsx:23`](../frontend/src/pages/citizen/CitizenPortal.tsx)): `null` would crash, so the number type is kept. See the known limitations. |
| Other hidden text (`masked_id`, `tenant_name`, `title_deed` for utility) | `"Restricted"` | Strings stay strings. |
| Other hidden status values (`payment_status`, `lease_status`, `occupancy_status`, lease `status`) | `"NOT_DISCLOSED"` | Strings stay strings. |
| Other hidden numbers (`annual_tax`, `monthly_rent`, `assessed_value`, `amount_*`) | `0` or `0.0`, matching the original type | The legacy types in `types/index.ts` declare them as `number`. |
| `title_deed` for citizens | `"*************0981"`: all but the last 4 characters starred | As the policy asks. |
| Editor `by` | `"Surveyor"`, `"Administrator"`, `"Municipal officer"`, `"Utility operator"`, `"Citizen"`, or `"Registered user"` when the account cannot be found | The audit page renders `` `by ${e.by}` `` ([`AuditPage.tsx:86`](../frontend/src/pages/shared/AuditPage.tsx)). `by: null` (the generator) stays `null`. |

Values that are already `null` stay `null`.

## Endpoints

| Endpoint | Sign-in | Redactor |
|---|---|---|
| `GET /api/realgen/scenes/{key}/buildings/{id}` | required (unchanged) | `redact_building_detail`: each unit's owner, occupancy and tax |
| `GET /api/realgen/activity` | required (unchanged) | `redact_activity`: `by` becomes a role label |
| `GET /api/realgen/scenes/{key}/edits` | required (unchanged) | `redact_edits`: `by` becomes a role label |
| `GET /api/realgen/scenes/{key}/export/ladm` | required | `redact_building_detail` per building; owners appear as parties only in views that keep them (full, municipal), otherwise rights carry `pID: null` |
| `GET /api/realgen/scenes/{key}/export/cityjson` | required | none needed: the file never contains owner, occupancy or tax |
| `GET /api/units/{id}` | required | `redact_legacy_unit` |
| `GET /api/units/{id}/ownership` | required | `redact_ownership` |
| `GET /api/units/{id}/tax` | required | `redact_tax` |
| `GET /api/units/{id}/lease` | required | `redact_lease` |
| `GET /api/citizen/property/{identifier}` | required | `redact_citizen_property` |
| `GET /api/citizen/my-properties` | required | none: only the signed-in owner's own records, in full; everyone else gets `[]` |

A missing, invalid or expired token, or one for an unknown or inactive user, is a `401` on all of these.

Role labels need the editor's role, but `edits.json` and `ingest.json` store only an e-mail address. For non-full
views the handler therefore looks the e-mails up in the users table and passes the resulting map to the pure
redactor. If the lookup fails, the endpoint still answers, with generic labels.

**Not redacted, because they carry no personal fields:** the scene (`/scenes/{key}`), the area list, both registries,
lineage, findings, resolve, jobs, textures and the excavation check. The bundled `scene.json`, `registry.json`, `ids.json` and `meta.json` files contain no owner,
tax or e-mail fields.

Write endpoints are limited to surveyors and admins (see the first section).

## Guarantees and tests

- **Byte-identical editor views.** Surveyor and admin responses equal the unredacted output byte for byte, for
  building detail, activity and edits. For the legacy endpoints they equal golden copies captured from the backend
  before this change. See [`tests/api/test_access_policy.py`](../backend/tests/api/test_access_policy.py).
- **Same shape for every role.** Citizen and utility responses have the same keys, nesting and JSON types as the
  surveyor response. The owner is masked, tenancy and tax are hidden, and no e-mail address appears anywhere in
  activity or edits.
- **Municipality.** Owner and tax are visible; editor e-mails are replaced by role labels.
- **Pure redactors.** The input is never mutated, which matters because scene dicts come from the shared on-disk
  cache. Every redactor is tested against every view in
  [`tests/unit/test_access.py`](../backend/tests/unit/test_access.py).

## Known limitations

1. **"₹0" for hidden tax.** On the citizen portal and in the 3D unit panel, citizens and utility operators see
   "Annual property tax ₹0" and "Annual tax ₹0". The number type had to be kept, because the frontend calls
   `.toLocaleString` on it. The `X-BHARAT3D-View` header says the value was withheld.
2. **"NOT DISCLOSED" occupancy** is a new value for a field the UI treats as free text. It renders cleanly, but it is
   not one of the three values the generator produces.
3. **Demo ownership link.** `/api/citizen/my-properties` matches the demo record to the citizen account by the
   owner's name (the demo citizen owns it). A real deployment would link accounts to titles in the land records.
   The citizen portal's "my property" search uses the public building detail, so a citizen sees their own unit
   masked as well.
4. **Redaction happens at the API boundary.** Stored files (`edits.json`, `ingest.json`, and their copies in the R2
   area store) still contain editor e-mails. Only surveyors and admins see them.
5. **Lease dates, ownership type, share percentage and effective date** stay visible to every role: they are not in
   the policy table.
6. **Edge analytics** (`frontend/functions/`, Cloudflare D1) were out of scope and are unchanged.
7. **OpenAPI.** The generated API document is served only outside production (see the first section).
