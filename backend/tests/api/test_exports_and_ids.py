# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""CityJSON / LADM exports, identifiers with check characters, and who may generate or change projects."""
from __future__ import annotations

import itertools
from collections import Counter
from typing import Any

import orjson
import pytest

from app.realgen import cache, idcheck
from tests.conftest import NON_EDITORS, ROLES, SEED_KEY, Api, json_body

K = SEED_KEY


def _first_unit(api: Api) -> dict[str, Any]:
    page = json_body(api.get(f"/api/realgen/scenes/{K}/registry", "SURVEYOR", params={"limit": 500}))
    return next(e for e in page["items"] if e["vprid"] and not e["vprid"].startswith("INF-"))


# ---------------------------------------------------------------- identifiers with a check character

def test_registry_search_accepts_the_issued_form(api: Api) -> None:
    e = _first_unit(api)
    for q in (idcheck.issue(e["vprid"]), idcheck.issue(e["vprid"]).lower(), e["vprid"]):
        page = json_body(api.get(f"/api/realgen/scenes/{K}/registry", "SURVEYOR", params={"q": q}))
        assert [x["vprid"] for x in page["items"]] == [e["vprid"]], q
        across = json_body(api.get("/api/realgen/registry", "SURVEYOR", params={"q": q}))
        assert [x["vprid"] for x in across["items"]] == [e["vprid"]], q


def test_wrong_check_character_is_422_everywhere(api: Api) -> None:
    issued = idcheck.issue(_first_unit(api)["vprid"])
    wrong = issued[:-1] + ("A" if issued[-1] != "A" else "B")
    for path, params in ((f"/api/realgen/scenes/{K}/registry", {"q": wrong}), ("/api/realgen/registry", {"q": wrong}),
                         (f"/api/realgen/scenes/{K}/lineage", {"q": wrong}), (f"/api/realgen/scenes/{K}/resolve/{wrong}", {})):
        r = api.get(path, "SURVEYOR", params=params)
        assert r.status_code == 422 and "probably mistyped" in r.json()["detail"], path


def test_resolve_and_lineage_accept_the_issued_form(api: Api) -> None:
    e = _first_unit(api)
    issued = idcheck.issue(e["vprid"])
    hit = json_body(api.get(f"/api/realgen/scenes/{K}/resolve/{issued}", "SURVEYOR"))
    assert hit["kind"] == "unit" and hit["vprid"] == e["vprid"]
    lin = json_body(api.get(f"/api/realgen/scenes/{K}/lineage", "SURVEYOR", params={"q": issued}))
    assert [u["id"] for u in lin["items"]] == [e["vprid"]]
    scene = cache.read_json(K, "scene.json")
    b = scene["buildings"][0]
    hit = json_body(api.get(f"/api/realgen/scenes/{K}/resolve/{idcheck.issue(b['ulpin'])}", "SURVEYOR"))
    assert hit["kind"] == "building" and hit["building_id"] == b["id"]


def test_plain_text_search_is_unchanged(api: Api) -> None:
    page = json_body(api.get(f"/api/realgen/scenes/{K}/registry", "SURVEYOR", params={"q": "BLD-0001", "limit": 500}))
    assert page["matches"] > 0 and all(x["building_id"] == "BLD-0001" for x in page["items"])


# ---------------------------------------------------------------- CityJSON

def _closed_and_outward(doc: dict[str, Any]) -> tuple[int, int]:
    sc, tr = doc["transform"]["scale"], doc["transform"]["translate"]
    v = [[c[i] * sc[i] + tr[i] for i in range(3)] for c in doc["vertices"]]
    solids = bad = 0
    for o in doc["CityObjects"].values():
        for g in o.get("geometry", []):
            if g["type"] != "Solid":
                continue
            solids += 1
            edges: Counter = Counter()
            vol = 0.0
            for face in g["boundaries"][0]:
                for ring in face:
                    edges.update(zip(ring, ring[1:] + ring[:1]))
                    p0 = v[ring[0]]
                    for a, b in itertools.pairwise(ring):
                        pa, pb = v[a], v[b]
                        cross = [(pa[1] - p0[1]) * (pb[2] - p0[2]) - (pa[2] - p0[2]) * (pb[1] - p0[1]),
                                 (pa[2] - p0[2]) * (pb[0] - p0[0]) - (pa[0] - p0[0]) * (pb[2] - p0[2]),
                                 (pa[0] - p0[0]) * (pb[1] - p0[1]) - (pa[1] - p0[1]) * (pb[0] - p0[0])]
                        vol += sum((p0[i] - tr[i]) * cross[i] for i in range(3))
            if any(edges[(b, a)] != n for (a, b), n in edges.items()) or vol <= 0:
                bad += 1
    return solids, bad


def test_cityjson_export(api: Api) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/export/cityjson", "SURVEYOR")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/city+json")
    assert r.headers["content-disposition"] == f'attachment; filename="bharat3d-{K}.city.json"'
    doc = r.json()
    assert doc["type"] == "CityJSON" and doc["version"] == "2.0"
    assert doc["metadata"]["referenceSystem"] == "https://www.opengis.net/def/crs/EPSG/0/32643"  # Bhopal: UTM 43N
    scene = cache.read_json(K, "scene.json")
    types = Counter(o["type"] for o in doc["CityObjects"].values())
    assert types["Building"] == len(scene["buildings"]) and types["LandUse"] == len(scene["parcels"])
    assert types["BuildingUnit"] > 0 and types["GenericCityObject"] == len(scene["subsurface"])
    assert all(isinstance(c, int) for xyz in doc["vertices"][:200] for c in xyz)
    solids, bad = _closed_and_outward(doc)
    assert solids > len(scene["buildings"]) and bad == 0
    unit = next(o for o in doc["CityObjects"].values() if o["type"] == "BuildingUnit")
    assert idcheck.parse(unit["attributes"]["3d_ulpin_issued"]).canonical == unit["attributes"]["3d_ulpin"]
    assert unit["parents"][0] in doc["CityObjects"]


@pytest.mark.parametrize("role", ROLES)
def test_cityjson_has_no_personal_data_for_anyone(api: Api, role: str) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/export/cityjson", role)
    assert r.status_code == 200
    owners = {u["owner"] for d in _details() for f in d["floors"] for u in f["units"]}
    body = r.text
    assert '"owner' not in body and '"annual_tax' not in body and '"occupancy' not in body
    assert not any(name in body for name in list(owners)[:50])


def _details() -> list[dict[str, Any]]:
    from app.realgen import export

    scene = cache.read_json(K, "scene.json")
    return export.building_details(K, scene)


# ---------------------------------------------------------------- LADM

def test_ladm_export_for_an_editor(api: Api) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/export/ladm", "SURVEYOR")
    assert r.status_code == 200 and r.headers["x-bharat3d-view"] == "full"
    assert r.headers["content-disposition"] == f'attachment; filename="bharat3d-{K}.ladm.json"'
    doc = r.json()
    assert doc["ladm"]["standard"].startswith("ISO 19152")
    levels = Counter(su["level"] for su in doc["LA_SpatialUnit"])
    assert levels["L1-PARCEL"] and levels["L2-UNIT"] and levels["L3-COMMON"] and levels["L4-INF-UTL"]
    assert doc["LA_Party"] and all(r_["pID"] for r_ in doc["LA_RRR"])
    party_ids = {p["pID"] for p in doc["LA_Party"]}
    bau_ids = {b["uID"] for b in doc["LA_BAUnit"]}
    su_ids = {su["suID"] for su in doc["LA_SpatialUnit"]}
    for right in doc["LA_RRR"]:
        assert right["pID"] in party_ids and right["uID"] in bau_ids
        assert 0 <= right["share"]["numerator"] <= right["share"]["denominator"] == 1_000_000
    for rel in doc["LA_RequiredRelationshipSpatialUnit"]:
        assert rel["su1"] in su_ids and rel["su2"] in su_ids
    unit = next(su for su in doc["LA_SpatialUnit"] if su["level"] == "L2-UNIT")
    assert idcheck.parse(unit["suID"]).canonical == unit["canonicalID"] and unit["zMax"] > unit["zMin"]


@pytest.mark.parametrize(("role", "view"), [("UTILITY_OPERATOR", "utility"), ("CITIZEN", "public")])
def test_ladm_withholds_owners_from_masked_views(api: Api, role: str, view: str) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/export/ladm", role)
    doc = r.json()
    assert r.headers["x-bharat3d-view"] == view and doc["ladm"]["view"] == view
    assert doc["LA_Party"] == [] and all(x["pID"] is None and x["partyWithheld"] for x in doc["LA_RRR"])
    owners = {u["owner"] for d in _details() for f in d["floors"] for u in f["units"]}
    assert not any(name in r.text for name in owners)


def test_ladm_for_the_municipality_keeps_owners(api: Api) -> None:
    doc = json_body(api.get(f"/api/realgen/scenes/{K}/export/ladm", "MUNICIPALITY"))
    assert doc["LA_Party"] and doc["ladm"]["view"] == "municipal"


def test_export_errors(api: Api) -> None:
    assert api.get(f"/api/realgen/scenes/{K}/export/cityjson").status_code == 401
    assert api.get(f"/api/realgen/scenes/{K}/export/shapefile", "SURVEYOR").status_code == 404
    assert api.get("/api/realgen/scenes/ffffffffffffffff/export/cityjson", "SURVEYOR").status_code == 404


def test_export_is_cached_until_the_area_changes(api: Api, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.realgen import export, scene_ops

    export._details_memo.clear()
    calls = []
    real = scene_ops.building_detail
    monkeypatch.setattr(scene_ops, "building_detail", lambda s, b: calls.append(b) or real(s, b))
    api.get(f"/api/realgen/scenes/{K}/export/cityjson", "SURVEYOR")
    n = len(calls)
    api.get(f"/api/realgen/scenes/{K}/export/ladm", "SURVEYOR")
    assert n > 0 and len(calls) == n  # second export reused the details
    meta = cache.read_json(K, "meta.json")
    cache.write_json(K, "meta.json", {**meta, "updated_at": (meta.get("updated_at") or 0) + 1})
    api.get(f"/api/realgen/scenes/{K}/export/cityjson", "SURVEYOR")
    assert len(calls) == 2 * n


def test_owner_names_are_unchanged_by_the_faster_generator() -> None:
    from faker import Faker

    from app.realgen.llm import owner_name

    for seed in range(0, 2000, 7):
        fresh = Faker("en_IN")
        fresh.seed_instance(seed)
        assert owner_name(seed) == fresh.name()


# ---------------------------------------------------------------- who may generate and change projects

POLY = {"type": "Polygon", "coordinates": [[[77.43, 23.23], [77.432, 23.23], [77.432, 23.232], [77.43, 23.232], [77.43, 23.23]]]}


@pytest.mark.parametrize("role", NON_EDITORS)
@pytest.mark.parametrize("path", ["/api/realgen/generate", "/api/realgen/preflight"])
def test_only_editors_generate(api: Api, role: str, path: str) -> None:
    assert api.post(path, role, json={"polygon": POLY}).status_code == 403
    assert api.post(path, None, json={"polygon": POLY}).status_code == 401


def test_projects_need_sign_in_and_editors_to_change(api: Api) -> None:
    assert api.get("/api/projects").status_code == 401
    assert api.post("/api/projects/proj-001/area", json={"polygon_geojson": POLY}).status_code == 401
    assert api.post("/api/projects/proj-001/area", "CITIZEN", json={"polygon_geojson": POLY}).status_code == 403
    r = api.post("/api/projects/proj-001/area", "SURVEYOR", json={"polygon_geojson": POLY})
    assert r.status_code == 200 and r.json()["selected_area_id"].startswith("gen:")
    assert json_body(api.get("/api/projects/1", "CITIZEN"))["id"] == 1
    assert api.get("/api/projects/424242", "SURVEYOR").status_code == 404
    assert api.get("/api/projects/not-a-number", "SURVEYOR").status_code == 404
    created = json_body(api.post("/api/projects", "ADMIN", json={"name": "Test ward", "ward_number": "W1",
                                                                  "zone_name": "Z1"}))
    assert created["name"] == "Test ward" and api.post("/api/projects", "UTILITY_OPERATOR", json={
        "name": "x", "ward_number": "W", "zone_name": "Z"}).status_code == 403
    assert orjson.loads(api.get("/api/projects", "MUNICIPALITY").content)
