# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Ingest endpoints, the stored plan written at generation, and generation surviving a failing planner."""
from typing import Any

import pytest

from app.api import realgen
from app.realgen import cache, fetch_osm, pipeline
from app.realgen.geo import polygon_from_geojson, polygon_key
from tests.conftest import ROLES, SEED_KEY, Api, json_body

K = SEED_KEY
POLYGON = {"type": "Polygon", "coordinates": [[[77.2155, 28.6305], [77.2195, 28.6305], [77.2195, 28.6335],
                                               [77.2155, 28.6335], [77.2155, 28.6305]]]}
NEW_KEY = polygon_key(polygon_from_geojson(POLYGON))
MANIFEST = [
    {"slot": "lidar", "title": "LiDAR point cloud", "name": "test_block.laz", "size_bytes": 1_000_000, "format": "LAZ",
     "checks": ["test"], "sample": True},
    {"slot": "plans", "title": "Floor plans / BIM", "name": "test_floors.dxf", "size_bytes": 2_000, "format": "DXF",
     "checks": [], "sample": True},
    {"slot": "ortho", "title": "Drone orthomosaic", "name": "test.tif", "size_bytes": 5, "format": "TIF", "checks": [],
     "sample": True},
]


@pytest.fixture
def offline_generation(monkeypatch: pytest.MonkeyPatch) -> list:
    """Generation without the network: the India check passes and the pipeline returns a stub scene."""
    calls: list = []

    def fake_generate(polygon: Any, on_progress: Any, force: bool = False) -> dict:
        calls.append(polygon)
        return {"stats": {}, "place": {}, "summary": "stub"}

    monkeypatch.setattr(fetch_osm, "india_check", lambda poly: None)
    monkeypatch.setattr(pipeline, "generate", fake_generate)
    return calls


@pytest.mark.parametrize("role", ROLES)
def test_formats_for_every_role(api: Api, role: str) -> None:
    got = json_body(api.get("/api/ingest/formats", role))
    assert [d["reader"] for d in got] == ["lidar", "ifc", "dxf", "gnss"]
    assert all(d["will_mint_ids"] is False and d["status"] == "PSEUDO_NOT_EXECUTED" for d in got)


def test_ingest_endpoints_require_sign_in(api: Api) -> None:
    assert api.get("/api/ingest/formats").status_code == 401
    assert api.post("/api/ingest/plan", json={"datasets": MANIFEST}).status_code == 401
    assert api.get(f"/api/realgen/scenes/{K}/ingest-plan").status_code == 401


@pytest.mark.parametrize("role", ["CITIZEN", "SURVEYOR"])
def test_plan_endpoint(api: Api, role: str) -> None:
    got = json_body(api.post("/api/ingest/plan", role, json={"datasets": MANIFEST}))
    assert [(p["reader"], p["format"], p["status"]) for p in got] == [
        ("lidar", "LAZ", "PSEUDO_NOT_EXECUTED"), ("dxf", "DXF", "PSEUDO_NOT_EXECUTED"), ("none", "TIF", "UNSUPPORTED")]
    assert all(p["will_mint_ids"] is False for p in got)
    assert {"name", "input", "output", "detail"} == set(got[0]["steps"][0])


def test_plan_endpoint_edge_cases(api: Api) -> None:
    assert json_body(api.post("/api/ingest/plan", "CITIZEN", json={})) == []
    junk = json_body(api.post("/api/ingest/plan", "CITIZEN", json={"datasets": [None, 1, "x", {"format": "ZIP"}]}))
    assert [p["status"] for p in junk] == ["UNSUPPORTED"] * 4
    many = json_body(api.post("/api/ingest/plan", "CITIZEN", json={"datasets": [MANIFEST[0]] * 80}))
    assert len(many) == 50
    assert api.post("/api/ingest/plan", "CITIZEN", json={"datasets": "nope"}).status_code == 422


def test_stored_plan_is_derived_for_older_areas_without_writing(api: Api) -> None:
    assert not cache.exists(K, "ingest_plan.json")
    got = json_body(api.get(f"/api/realgen/scenes/{K}/ingest-plan", "CITIZEN"))
    assert [p["dataset"]["slot"] for p in got] == ["ortho", "lidar", "cadastre", "sanctions", "plans", "utilities"]
    assert not cache.exists(K, "ingest_plan.json")  # derived on the fly, nothing written
    assert "@" not in repr(got)  # plans never carry who uploaded the package


def test_stored_plan_wins_and_empty_without_package(api: Api, area_cache: Any) -> None:
    cache.write_json(K, "ingest_plan.json", [{"stored": True}])
    assert json_body(api.get(f"/api/realgen/scenes/{K}/ingest-plan", "SURVEYOR")) == [{"stored": True}]
    (area_cache / K / "ingest_plan.json").unlink()
    (area_cache / K / "ingest.json").unlink()
    assert json_body(api.get(f"/api/realgen/scenes/{K}/ingest-plan", "SURVEYOR")) == []
    assert api.get("/api/realgen/scenes/ffffffffffffffff/ingest-plan", "SURVEYOR").status_code == 404


def test_derived_plan_failure_returns_empty(api: Api, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(datasets: Any) -> list:
        raise RuntimeError("planner down")

    monkeypatch.setattr(realgen, "plan_for_manifest", boom)
    assert json_body(api.get(f"/api/realgen/scenes/{K}/ingest-plan", "SURVEYOR")) == []


def test_generate_writes_ingest_and_plan(api: Api, offline_generation: list) -> None:
    r = api.post("/api/realgen/generate", "SURVEYOR", json={"polygon": POLYGON, "datasets": MANIFEST, "force": True})
    body = json_body(r)
    assert set(body) == {"job_id", "key", "status"} and body["key"] == NEW_KEY and body["status"] == "RUNNING"
    ingest = cache.read_json(NEW_KEY, "ingest.json")
    assert list(ingest) == ["at", "by", "datasets"] and ingest["datasets"] == MANIFEST
    stored = cache.read_json(NEW_KEY, "ingest_plan.json")
    assert stored == [p.to_dict() for p in realgen.plan_for_manifest(MANIFEST)]
    assert [p["reader"] for p in stored] == ["lidar", "dxf", "none"]
    assert "@" not in repr(stored)  # the plan never carries who uploaded the package


def test_generate_succeeds_when_the_planner_raises(api: Api, offline_generation: list,
                                                   monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(datasets: Any) -> list:
        raise RuntimeError("planner down")

    monkeypatch.setattr(realgen, "plan_for_manifest", boom)
    r = api.post("/api/realgen/generate", "SURVEYOR", json={"polygon": POLYGON, "datasets": MANIFEST, "force": True})
    body = json_body(r)
    assert set(body) == {"job_id", "key", "status"} and body["status"] == "RUNNING"
    assert cache.read_json(NEW_KEY, "ingest.json")["datasets"] == MANIFEST
    assert not cache.exists(NEW_KEY, "ingest_plan.json")


def test_generate_without_datasets_writes_no_plan(api: Api, offline_generation: list) -> None:
    body = json_body(api.post("/api/realgen/generate", "SURVEYOR", json={"polygon": POLYGON, "force": True}))
    assert body["key"] == NEW_KEY
    assert not cache.exists(NEW_KEY, "ingest.json") and not cache.exists(NEW_KEY, "ingest_plan.json")
