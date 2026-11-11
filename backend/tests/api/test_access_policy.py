# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Role-based views through the real routes (docs/ACCESS_POLICY.md).

* SURVEYOR and ADMIN: byte-for-byte the unredacted output.
* MUNICIPALITY: owner, tenancy and tax visible; editor e-mails replaced by role labels.
* UTILITY_OPERATOR and CITIZEN: same keys, nesting and JSON types as the surveyor response; owner masked; tenancy
  and tax hidden; no e-mail address anywhere in activity or edits.
* Anonymous callers get 401 everywhere (the legacy demo routes included); removed demo stubs are 404/405.
"""
import re
from typing import Any

import pytest
from fastapi.responses import ORJSONResponse

from app.api import realgen
from app.realgen import cache, scene_ops
from tests.conftest import (
    EDITORS,
    FAKE_EDITS,
    FAKE_USERS,
    NON_EDITORS,
    ROLES,
    SEED_KEY,
    UNKNOWN_EDITOR,
    Api,
    json_body,
    token_for,
)

K = SEED_KEY
HEADER = "x-bharat3d-view"
EMAIL = re.compile(rb"[\w.+-]+@[\w-]+\.[\w.]+")
MASKED_NAME = re.compile(r"^\S\*{4}( \S\*{4})*$")
EXPECTED_VIEW = {"SURVEYOR": "full", "ADMIN": "full", "MUNICIPALITY": "municipal", "UTILITY_OPERATOR": "utility",
                 "CITIZEN": "public"}
MASKING_ROLES = ("UTILITY_OPERATOR", "CITIZEN")
ROLES_ALL = tuple(ROLES)


def _orjson(content: Any) -> bytes:
    """Exactly what the app's default response class writes for this content."""
    return ORJSONResponse(content).body


def _shape(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _shape(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_shape(v) for v in obj]
    return type(obj).__name__


def _units(detail: dict) -> list:
    return [u for f in detail["floors"] for u in f["units"]]


# --------------------------------------------------------------------------- building detail
@pytest.mark.parametrize("role", EDITORS)
def test_editors_get_byte_identical_building_detail(api: Api, seed_buildings: dict, role: str) -> None:
    for bid in seed_buildings.values():
        r = api.get(f"/api/realgen/scenes/{K}/buildings/{bid}", role)
        assert r.status_code == 200 and r.headers[HEADER] == "full"
        assert r.content == _orjson(scene_ops.building_detail(realgen._load_scene(K), bid))


@pytest.mark.parametrize("role", list(EXPECTED_VIEW))
def test_view_header_per_role(api: Api, seed_buildings: dict, role: str) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/buildings/{seed_buildings['STRATA']}", role)
    assert r.headers[HEADER] == EXPECTED_VIEW[role]


def test_municipality_sees_owner_occupancy_and_tax(api: Api, seed_buildings: dict) -> None:
    path = f"/api/realgen/scenes/{K}/buildings/{seed_buildings['STRATA']}"
    assert api.get(path, "MUNICIPALITY").content == api.get(path, "SURVEYOR").content


@pytest.mark.parametrize("role", MASKING_ROLES)
def test_masked_building_detail(api: Api, seed_buildings: dict, role: str) -> None:
    for kind, bid in seed_buildings.items():
        path = f"/api/realgen/scenes/{K}/buildings/{bid}"
        full, got = json_body(api.get(path, "SURVEYOR")), json_body(api.get(path, role))
        assert _shape(got) == _shape(full), kind  # identical keys, nesting and JSON types
        assert got["building"] == full["building"] and got["common_spaces"] == full["common_spaces"]
        for f_full, f_got in zip(full["floors"], got["floors"]):
            assert {k: v for k, v in f_got.items() if k != "units"} == {k: v for k, v in f_full.items() if k != "units"}
        for u_full, u_got in zip(_units(full), _units(got)):
            assert MASKED_NAME.match(u_got["owner"]) and u_got["owner"] != u_full["owner"]
            assert u_got["owner"][0] == u_full["owner"][0]
            assert u_got["occupancy"] == "NOT_DISCLOSED" and u_got["annual_tax_inr"] == 0
            rest = ("owner", "occupancy", "annual_tax_inr")
            assert {k: v for k, v in u_got.items() if k not in rest} == {k: v for k, v in u_full.items() if k not in rest}


def test_masked_detail_does_not_touch_the_cached_scene(api: Api, seed_buildings: dict) -> None:
    before = (cache.read_json(K, "scene.json"), cache.read_json(K, "registry.json"))
    api.get(f"/api/realgen/scenes/{K}/buildings/{seed_buildings['STRATA']}", "CITIZEN")
    assert (cache.read_json(K, "scene.json"), cache.read_json(K, "registry.json")) == before


# --------------------------------------------------------------------------- activity and edits
@pytest.mark.parametrize("role", EDITORS)
@pytest.mark.parametrize("query", [None, K])
def test_editors_get_byte_identical_activity(api: Api, role: str, query: Any) -> None:
    r = api.get("/api/realgen/activity", role, params={"key": query} if query else {})
    assert r.status_code == 200 and r.headers[HEADER] == "full"
    assert r.content == _orjson(realgen._activity_events(query, 200))
    assert FAKE_USERS["SURVEYOR"].email.encode() in r.content  # editors still see who did what


@pytest.mark.parametrize("role", EDITORS)
def test_editors_get_byte_identical_edits(api: Api, role: str) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/edits", role)
    assert r.status_code == 200 and r.headers[HEADER] == "full"
    assert r.content == _orjson(cache.read_json(K, "edits.json")) and r.json() == FAKE_EDITS


@pytest.mark.parametrize("role", NON_EDITORS)
def test_activity_without_emails(api: Api, role: str) -> None:
    full = json_body(api.get("/api/realgen/activity", "SURVEYOR"))
    r = api.get("/api/realgen/activity", role)
    got = json_body(r)
    assert r.headers[HEADER] == EXPECTED_VIEW[role]
    assert not EMAIL.search(r.content)
    assert _shape(got) == _shape(full)
    for e_full, e_got in zip(full, got):
        assert {k: v for k, v in e_got.items() if k != "by"} == {k: v for k, v in e_full.items() if k != "by"}
    by = {(e["kind"], e.get("seq")): e["by"] for e in got}
    assert by[("edit", 1)] == "Surveyor" and by[("edit", 2)] == "Administrator" and by[("edit", 3)] == "Registered user"
    assert by[("ingested", None)] == "Registered user"  # the seed's demo account is not in the test user table
    assert all(e["by"] is None for e in got if e["kind"] in ("generated", "lifecycle"))


@pytest.mark.parametrize("role", NON_EDITORS)
def test_edits_without_emails(api: Api, role: str) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/edits", role)
    got = json_body(r)
    assert r.headers[HEADER] == EXPECTED_VIEW[role] and not EMAIL.search(r.content)
    assert [e["by"] for e in got] == ["Surveyor", "Administrator", "Registered user"]
    assert [{k: v for k, v in e.items() if k != "by"} for e in got] == [
        {k: v for k, v in e.items() if k != "by"} for e in FAKE_EDITS]
    assert cache.read_json(K, "edits.json")[2]["by"] == UNKNOWN_EDITOR  # stored records keep the e-mail


def test_failed_role_lookup_falls_back_to_generic_labels(api: Api) -> None:
    from app.core.database import get_db

    class BrokenSession:
        async def execute(self, *a: Any, **kw: Any) -> None:
            raise RuntimeError("database unavailable")

    async def broken_db():
        yield BrokenSession()

    api.app.dependency_overrides[get_db] = broken_db
    got = json_body(api.get(f"/api/realgen/scenes/{K}/edits", "CITIZEN"))
    assert [e["by"] for e in got] == ["Registered user"] * 3


# --------------------------------------------------------------------------- writes stay editor-only
WRITES = [("DELETE", f"/api/realgen/scenes/{K}", None),
          ("POST", f"/api/realgen/scenes/{K}/edits", {"ops": [{"op": "building.delete", "id": "BLD-0001"}]}),
          ("POST", f"/api/realgen/scenes/{K}/edits/undo", None),
          ("DELETE", f"/api/realgen/scenes/{K}/edits", None)]


@pytest.mark.parametrize("role", NON_EDITORS)
@pytest.mark.parametrize("method, path, body", WRITES)
def test_writes_are_forbidden_for_non_editors(api: Api, role: str, method: str, path: str, body: Any) -> None:
    r = api.request(method, path, role, json=body) if body else api.request(method, path, role)
    assert r.status_code == 403
    assert cache.read_json(K, "edits.json") == FAKE_EDITS and cache.exists(K, "scene.json")


@pytest.mark.parametrize("method, path, body", WRITES)
def test_writes_require_sign_in(api: Api, method: str, path: str, body: Any) -> None:
    r = api.request(method, path, None, json=body) if body else api.request(method, path, None)
    assert r.status_code == 401


# --------------------------------------------------------------------------- legacy demo endpoints (sign-in required)
GOLDEN = {  # pre-change responses (captured from the running backend at 9906e82); editors must still get exactly these
    "/api/units/VPR-TEST-0001": b'{"id":"UNT-VPR-TEST-0001","vprid":"VPR-TEST-0001","unit_number":"Flat 804","property_type":"RESIDENTIAL","carpet_area_sqm":94.5,"built_up_area_sqm":115.2,"area_sqm":115.2,"volume_cum":345.6,"owner_name":"Priya Mehta","masked_id":"ID-XXXX-8921","tenant_name":"Rohan Gupta","lease_status":"ACTIVE","annual_tax":18400,"payment_status":"PAID","compliance_status":"COMPLIANT","title_deed":"DEED-DL-2024-0981"}',
    "/api/units/VPR-TEST-0001/ownership": b'{"unit_vprid":"VPR-TEST-0001","owner_name":"Priya Mehta","masked_id":"ID-XXXX-8921","ownership_type":"FREEHOLD","share_percentage":100.0,"title_deed":"DEED-DL-2024-0981","effective_date":"2024-04-15"}',
    "/api/units/VPR-TEST-0001/tax": b'{"unit_vprid":"VPR-TEST-0001","financial_year":"2026-27","usage_type":"RESIDENTIAL","assessed_value":184000,"annual_tax":18400,"amount_paid":18400,"amount_due":0,"payment_status":"PAID"}',
    "/api/units/VPR-TEST-0001/lease": b'{"unit_vprid":"VPR-TEST-0001","tenant_name":"Rohan Gupta","lease_start":"2025-01-01","lease_end":"2026-12-31","monthly_rent":38000.0,"status":"ACTIVE"}',
    "/api/citizen/my-properties": b'[{"id":"UNT-VPR-BLD0101-F08-U04","vprid":"VPR-BLD0101-F08-U04","unit_number":"Flat 804","building_name":"Aarav Heights Condominium","floor_number":8,"property_type":"RESIDENTIAL","carpet_area_sqm":94.5,"built_up_area_sqm":115.2,"volume_cum":345.6,"owner_name":"Priya Mehta","masked_id":"ID-XXXX-8921","tenant_name":"Rohan Gupta","occupancy_status":"LEASED","annual_tax":18400,"payment_status":"PAID","compliance_status":"COMPLIANT","title_deed":"DEED-DL-2024-0981","ulpin":"IN-01-0008","ward_id":"Ward 16","z_min":237.75,"z_max":241.0}]',
    "/api/citizen/property/VPR-TEST-0001": b'{"vprid":"VPR-TEST-0001","unit_number":"Flat 804","building_name":"Aarav Heights Condominium","floor_number":8,"property_type":"RESIDENTIAL","carpet_area_sqm":94.5,"built_up_area_sqm":115.2,"volume_cum":345.6,"owner_name":"Priya Mehta","masked_id":"ID-XXXX-8921","tenant_name":"Rohan Gupta","annual_tax":18400,"payment_status":"PAID","compliance_status":"COMPLIANT","title_deed":"DEED-DL-2024-0981","ulpin":"IN-01-0008"}',
}
REDACTED_LEGACY = [p for p in GOLDEN if p != "/api/citizen/my-properties"]
OWNER_NAME = "Priya Mehta (Property Owner)"  # the demo citizen account that owns the demo record


@pytest.mark.parametrize("path", list(GOLDEN))
def test_legacy_routes_need_sign_in(api: Api, path: str) -> None:
    r = api.get(path)
    assert r.status_code == 401 and b"Priya" not in r.content


@pytest.mark.parametrize("role", (*EDITORS, "MUNICIPALITY"))
@pytest.mark.parametrize("path", REDACTED_LEGACY)
def test_legacy_full_and_municipal_views_are_byte_identical(api: Api, role: str, path: str) -> None:
    r = api.get(path, role)
    assert r.status_code == 200 and r.content == GOLDEN[path]
    assert r.headers[HEADER] == EXPECTED_VIEW[role]


@pytest.mark.parametrize("role", MASKING_ROLES)
@pytest.mark.parametrize("path", REDACTED_LEGACY)
def test_legacy_masked_views_keep_keys_and_types(api: Api, role: str, path: str) -> None:
    import orjson

    full = orjson.loads(GOLDEN[path])
    r = api.get(path, role)
    got = json_body(r)
    assert r.headers[HEADER] == ("public" if role == "CITIZEN" else "utility")
    assert _shape(got) == _shape(full)
    assert b"Priya Mehta" not in r.content and b"Rohan Gupta" not in r.content and b"18400" not in r.content
    if "owner_name" in got:
        assert got["owner_name"] == "P**** M****"
    if "title_deed" in got:
        assert got["title_deed"] == ("*************0981" if role == "CITIZEN" else "Restricted")
    if "masked_id" in got:
        assert got["masked_id"] == "Restricted"


def test_legacy_lease_and_tax_placeholders(api: Api) -> None:
    lease = json_body(api.get("/api/units/VPR-TEST-0001/lease", "CITIZEN"))
    assert lease == {"unit_vprid": "VPR-TEST-0001", "tenant_name": "Restricted", "lease_start": "2025-01-01",
                     "lease_end": "2026-12-31", "monthly_rent": 0.0, "status": "NOT_DISCLOSED"}
    tax = json_body(api.get("/api/units/VPR-TEST-0001/tax", "UTILITY_OPERATOR"))
    assert tax == {"unit_vprid": "VPR-TEST-0001", "financial_year": "2026-27", "usage_type": "RESIDENTIAL",
                   "assessed_value": 0, "annual_tax": 0, "amount_paid": 0, "amount_due": 0,
                   "payment_status": "NOT_DISCLOSED"}


def test_my_properties_shows_the_owner_their_records_in_full(api: Api) -> None:
    from app.core.deps import get_current_user
    from app.models.models import RoleEnum, User

    me = FAKE_USERS["CITIZEN"]  # the same account, holding the owner's name for this test
    owner = User(id=me.id, email=me.email, full_name=OWNER_NAME, role=RoleEnum.CITIZEN, is_active=True,
                 hashed_password="!")
    api.as_role(None)
    api.app.dependency_overrides[get_current_user] = lambda: owner
    r = api.client.get("/api/citizen/my-properties")
    assert r.content == GOLDEN["/api/citizen/my-properties"] and r.headers[HEADER] == "full"


@pytest.mark.parametrize("role", ROLES_ALL)
def test_my_properties_is_empty_for_anyone_else(api: Api, role: str) -> None:
    r = api.get("/api/citizen/my-properties", role)  # the fake citizen is not the owner here
    assert r.status_code == 200 and r.json() == [] and b"Priya" not in r.content


def test_legacy_unit_from_demo_area_file(api: Api) -> None:
    import json
    import os

    from app.demo.area_selector import DemoAreaSelector

    with open(os.path.join(DemoAreaSelector.get_area_dir("area_01"), "units.geojson"), encoding="utf-8") as f:
        units = json.load(f)
    rec = next(u for u in units if u.get("owner_name"))
    full = json_body(api.get(f"/api/units/{rec['id']}", "SURVEYOR", params={"area_id": "area_01"}))
    assert full == rec
    pub = json_body(api.get(f"/api/units/{rec['id']}", "CITIZEN", params={"area_id": "area_01"}))
    assert set(pub) == set(rec) and pub["owner_name"] != rec["owner_name"] and pub["annual_tax"] == 0


# Demo stubs and unused routes that are gone: every one is 404/405 for every caller.
REMOVED = [("POST", "/api/citizen/pay-tax"), ("POST", "/api/units/floors/F1/split"),
           ("POST", "/api/projects/1/datasets"), ("POST", "/api/projects/1/process"), ("GET", "/api/projects/1/map"),
           ("GET", "/api/projects/1/3d"), ("GET", "/api/projects/1/registry"), ("POST", "/api/projects/1/finalize"),
           ("POST", "/api/projects/1/generate-3d-ids"), ("POST", "/api/projects/1/archive-3d-registry"),
           ("GET", "/api/buildings"), ("GET", "/api/buildings/BLD-0001/floors"), ("GET", "/api/violations"),
           ("GET", "/api/infrastructure"), ("PUT", "/api/infrastructure/1"), ("POST", "/api/excavation/check-clash"),
           ("GET", "/api/audit"), ("GET", "/api/maps/area_01"), ("GET", "/api/jobs/1")]


@pytest.mark.parametrize("role", ("SURVEYOR", None))
@pytest.mark.parametrize("method, path", REMOVED)
def test_removed_demo_routes_are_gone(api: Api, role: Any, method: str, path: str) -> None:
    assert api.request(method, path, role).status_code in (404, 405)


# --------------------------------------------------------------------------- real tokens
@pytest.mark.parametrize("role, view", [("SURVEYOR", "full"), ("MUNICIPALITY", "municipal"),
                                        ("UTILITY_OPERATOR", "utility"), ("CITIZEN", "public")])
def test_real_token_selects_the_view(api: Api, role: str, view: str) -> None:
    r = api.get("/api/citizen/property/VPR-TEST-0001", headers={"Authorization": f"Bearer {token_for(role)}"})
    assert r.status_code == 200 and r.headers[HEADER] == view


@pytest.mark.parametrize("auth", ["Bearer not-a-jwt", "Bearer ", "Basic abc"])
def test_bad_token_is_401(api: Api, auth: str) -> None:
    r = api.get("/api/units/VPR-TEST-0001/ownership", headers={"Authorization": auth})
    assert r.status_code == 401


def test_expired_unknown_and_malformed_subjects_are_401(api: Api) -> None:
    from datetime import timedelta

    from app.core.security import create_access_token

    tokens = [create_access_token({"sub": str(FAKE_USERS["SURVEYOR"].id)}, expires_delta=timedelta(seconds=-5)),
              create_access_token({"sub": "999999"}), create_access_token({"sub": "not-a-number"}),
              create_access_token({"role": "SURVEYOR"})]
    for t in tokens:
        assert api.get("/api/units/VPR-TEST-0001", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_inactive_user_is_401(api: Api, user_db: Any) -> None:
    import asyncio

    from sqlalchemy import update

    from app.models.models import User

    async def set_active(flag: bool) -> None:
        async with user_db() as s:
            await s.execute(update(User).where(User.id == FAKE_USERS["MUNICIPALITY"].id).values(is_active=flag))
            await s.commit()

    asyncio.run(set_active(False))
    try:
        r = api.get("/api/units/VPR-TEST-0001", headers={"Authorization": f"Bearer {token_for('MUNICIPALITY')}"})
        assert r.status_code == 401
    finally:
        asyncio.run(set_active(True))
