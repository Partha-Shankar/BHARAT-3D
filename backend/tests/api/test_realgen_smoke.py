# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Smoke tests for every existing realgen read endpoint, signed in as a surveyor, over one bundled seed area."""

import pytest

from tests.conftest import FAKE_EDITS, SEED_KEY, Api, json_body

K = SEED_KEY
UNIT_KEYS = {"unit_no", "unit_code", "index", "vprid", "status", "reason", "level", "polygon", "rooms", "built_up_m2",
             "carpet_m2", "volume_m3", "z_min", "z_max", "h_min", "h_max", "owner", "occupancy", "annual_tax_inr",
             "uds_ppm", "uds_percent", "usage_class", "source"}
FLOOR_KEYS = {"floor", "label", "level", "z_min", "z_max", "h_min", "h_max", "unauthorized", "status", "core", "corridor",
              "units"}
PAGE_KEYS = {"total", "matches", "by_status", "items"}


def test_list_scenes(api: Api) -> None:
    rows = json_body(api.get("/api/realgen/scenes", "SURVEYOR"))
    assert [r["key"] for r in rows] == [K]
    assert {"key", "place", "buildings", "vprids_reserved", "violations", "updated_at", "datasets"} <= set(rows[0])
    assert rows[0]["datasets"] == 6


def test_get_scene(api: Api) -> None:
    scene = json_body(api.get(f"/api/realgen/scenes/{K}", "SURVEYOR"))
    assert {"key", "buildings", "parcels", "roads", "subsurface", "violations", "integrity", "place", "origin",
            "stats", "terrain", "version", "plan_version"} <= set(scene)
    assert scene["key"] == K and len(scene["buildings"]) == 39


def test_unknown_scene_is_404(api: Api) -> None:
    assert api.get("/api/realgen/scenes/ffffffffffffffff", "SURVEYOR").status_code == 404
    assert api.get("/api/realgen/scenes/not-a-key", "SURVEYOR").status_code == 404


@pytest.mark.parametrize("name", ["texture", "context"])
def test_texture_is_public_jpeg(api: Api, name: str) -> None:
    r = api.get(f"/api/realgen/scenes/{K}/{name}.jpg")  # no sign-in: the WebGL loader fetches it directly
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg" and r.content[:2] == b"\xff\xd8"
    assert api.get(f"/api/realgen/scenes/{K}/other.jpg").status_code == 404


def test_building_detail_shape(api: Api, seed_buildings: dict[str, str]) -> None:
    for kind, bid in seed_buildings.items():
        d = json_body(api.get(f"/api/realgen/scenes/{K}/buildings/{bid}", "SURVEYOR"))
        assert set(d) == {"building", "floors", "common_spaces"}, kind
        assert d["building"]["id"] == bid and d["floors"]
        assert set(d["floors"][0]) == FLOOR_KEYS
        unit = d["floors"][0]["units"][0]
        assert set(unit) == UNIT_KEYS
        assert isinstance(unit["owner"], str) and isinstance(unit["occupancy"], str)
        assert isinstance(unit["annual_tax_inr"], int)
    assert api.get(f"/api/realgen/scenes/{K}/buildings/BLD-9999", "SURVEYOR").status_code == 404


def test_list_edits(api: Api) -> None:
    assert json_body(api.get(f"/api/realgen/scenes/{K}/edits", "SURVEYOR")) == FAKE_EDITS


def test_scene_registry_and_search(api: Api) -> None:
    page = json_body(api.get(f"/api/realgen/scenes/{K}/registry", "SURVEYOR", params={"limit": 5}))
    assert set(page) == PAGE_KEYS and len(page["items"]) == 5 and page["total"] >= page["matches"]
    vprid = next(e["vprid"] for e in page["items"] if e["vprid"])
    hit = json_body(api.get(f"/api/realgen/scenes/{K}/registry", "SURVEYOR", params={"q": vprid}))
    assert [e["vprid"] for e in hit["items"]] == [vprid]


def test_registry_across_areas(api: Api) -> None:
    page = json_body(api.get("/api/realgen/registry", "SURVEYOR", params={"limit": 3}))
    assert set(page) == PAGE_KEYS and len(page["items"]) == 3
    assert {"key", "place", "vprid", "ulpin", "building_id", "status"} <= set(page["items"][0])


def test_lineage(api: Api) -> None:
    page = json_body(api.get(f"/api/realgen/scenes/{K}/lineage", "SURVEYOR", params={"limit": 10}))
    assert set(page) == {"total", "by_status", "items"} and len(page["items"]) == 10
    assert {"id", "status", "minted_at", "parents"} <= set(page["items"][0])


def test_resolve(api: Api, seed_buildings: dict[str, str]) -> None:
    reg = json_body(api.get(f"/api/realgen/scenes/{K}/registry", "SURVEYOR"))
    vprid = next(e["vprid"] for e in reg["items"] if e["vprid"])
    unit = json_body(api.get(f"/api/realgen/scenes/{K}/resolve/{vprid}", "SURVEYOR"))
    assert unit["kind"] == "unit" and unit["vprid"] == vprid
    bid = seed_buildings["STRATA"]
    b = json_body(api.get(f"/api/realgen/scenes/{K}/resolve/{bid}", "SURVEYOR"))
    assert set(b) == {"kind", "building_id", "ulpin"} and b["building_id"] == bid
    assert api.get(f"/api/realgen/scenes/{K}/resolve/NOPE", "SURVEYOR").status_code == 404


def test_findings(api: Api) -> None:
    rows = json_body(api.get("/api/realgen/findings", "SURVEYOR"))
    assert len(rows) == 2
    assert {"id", "type", "severity", "building_id", "key", "place", "building_name", "ulpin", "floors"} <= set(rows[0])
    assert json_body(api.get("/api/realgen/findings", "SURVEYOR", params={"key": K})) == rows


def test_activity(api: Api) -> None:
    events = json_body(api.get("/api/realgen/activity", "SURVEYOR"))
    assert {e["kind"] for e in events} == {"generated", "ingested", "edit", "lifecycle"}
    assert all({"key", "place", "at", "kind", "by", "detail"} <= set(e) for e in events)
    assert [e["seq"] for e in events if e["kind"] == "edit"] == [3, 2, 1]  # newest first
    assert json_body(api.get("/api/realgen/activity", "SURVEYOR", params={"key": K})) == events


def test_unknown_job_is_404(api: Api) -> None:
    assert api.get("/api/realgen/jobs/doesnotexist", "SURVEYOR").status_code == 404


def test_excavation_check(api: Api) -> None:
    body = {"polygon_local": [[0, 0], [4, 0], [4, 2], [0, 2]], "depth_meters": 2.0}
    res = json_body(api.post(f"/api/realgen/scenes/{K}/excavation", "SURVEYOR", json=body))
    assert res["trench_area_m2"] == 8.0
    assert api.post(f"/api/realgen/scenes/{K}/excavation", "SURVEYOR", json={"depth_meters": 2}).status_code == 422


@pytest.mark.parametrize("path", [f"/api/realgen/scenes/{K}", f"/api/realgen/scenes/{K}/buildings/BLD-0001",
                                  "/api/realgen/activity", f"/api/realgen/scenes/{K}/edits", "/api/realgen/registry",
                                  f"/api/realgen/scenes/{K}/lineage", "/api/realgen/findings", "/api/realgen/scenes"])
def test_reads_require_sign_in(api: Api, path: str) -> None:
    assert api.get(path).status_code == 401
