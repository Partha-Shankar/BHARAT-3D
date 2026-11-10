# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""The area pre-check (POST /api/realgen/preflight) and the generation job's live log, retry and error kinds.

No network: the India check, the map download and the engine are replaced by fakes.
"""
from __future__ import annotations

import asyncio
import json
from concurrent.futures import Future
from typing import Any

import pytest
from shapely.geometry import Polygon, box

from app.api import realgen
from app.realgen import cache, fetch_osm, pipeline, progress
from app.realgen.geo import polygon_from_geojson, polygon_key
from tests.conftest import FAKE_USERS, SEED_KEY, Api, json_body

LON, LAT = 77.4300, 23.2300  # Bhopal, away from the seed area
SIDE = 0.002  # ~200 m


def square(lon: float = LON, lat: float = LAT, side: float = SIDE) -> dict[str, Any]:
    ring = [[lon, lat], [lon + side, lat], [lon + side, lat + side], [lon, lat + side], [lon, lat]]
    return {"type": "Polygon", "coordinates": [ring]}


def fake_osm(buildings: int, roads: int = 3, lon: float = LON, lat: float = LAT) -> dict[str, Any]:
    """Overpass-shaped data: `buildings` small squares inside the default square, plus a few roads."""
    els: list[dict[str, Any]] = []
    step = SIDE / 40
    for i in range(buildings):
        x, y = lon + step * (i % 38 + 1), lat + step * (i // 38 % 38 + 1)
        g = [{"lon": x, "lat": y}, {"lon": x + step / 2, "lat": y}, {"lon": x + step / 2, "lat": y + step / 2},
             {"lon": x, "lat": y + step / 2}, {"lon": x, "lat": y}]
        els.append({"type": "way", "id": i + 1, "geometry": g, "tags": {"building": "yes"}})
    for j in range(roads):
        g = [{"lon": lon, "lat": lat + SIDE * (j + 1) / (roads + 1)}, {"lon": lon + SIDE, "lat": lat + SIDE * (j + 1) / (roads + 1)}]
        els.append({"type": "way", "id": 10_000 + j, "geometry": g, "tags": {"highway": "residential"}})
    return {"elements": els, "osm3s": {"timestamp_osm_base": "2026-01-01T00:00:00Z"}}


def done(value: Any = None, exc: BaseException | None = None) -> Future:
    f: Future = Future()
    if exc is not None:
        f.set_exception(exc)
    else:
        f.set_result(value)
    return f


@pytest.fixture
def in_india(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fetch_osm, "india_check", lambda poly: None)


class Downloads(list):
    """The boxes the pre-check asked to download; `answer` is the future every request gets."""

    answer: Future


@pytest.fixture
def downloads(monkeypatch: pytest.MonkeyPatch) -> Downloads:
    asked = Downloads()
    asked.answer = done(fake_osm(10))

    def start_fetch(poly: Polygon) -> Future:
        asked.append(poly)
        return asked.answer

    monkeypatch.setattr(fetch_osm, "start_fetch", start_fetch)
    return asked


def preflight(api: Api, polygon: Any, role: str | None = "SURVEYOR") -> dict[str, Any]:
    return json_body(api.post("/api/realgen/preflight", role, json={"polygon": polygon}))


# ---------------------------------------------------------------- pre-check

def test_preflight_needs_sign_in(api: Api) -> None:
    assert api.post("/api/realgen/preflight", None, json={"polygon": square()}).status_code == 401


def test_generated_area_opens_instantly(api: Api, downloads: Downloads) -> None:
    ring = cache.read_json(SEED_KEY, "meta.json")["survey_polygon"]
    polygon = {"type": "Polygon", "coordinates": [ring]}
    assert polygon_key(polygon_from_geojson(polygon)) == SEED_KEY
    v = preflight(api, polygon)
    assert (v["level"], v["reason"], v["cached"], v["key"]) == ("ok", "exists", True, SEED_KEY)
    assert downloads == []  # nothing downloaded for an area that already exists


@pytest.mark.parametrize(("polygon", "reason"), [
    ({"type": "Point", "coordinates": [LON, LAT]}, "invalid"),
    (square(side=0.02), "size"),  # ~4 km²
    (square(side=0.0002), "size"),  # ~400 m²
])
def test_unusable_shapes_are_blocked(api: Api, polygon: Any, reason: str) -> None:
    v = preflight(api, polygon)
    assert (v["level"], v["reason"]) == ("block", reason) and v["message"]


def test_outside_india_is_blocked(api: Api, monkeypatch: pytest.MonkeyPatch, downloads: Downloads) -> None:
    monkeypatch.setattr(fetch_osm, "india_check", lambda poly: "This area is outside India (Test).")
    v = preflight(api, square())
    assert (v["level"], v["reason"], v["message"]) == ("block", "outside_india", "This area is outside India (Test).")
    assert downloads == []


def test_measured_area_reports_counts_and_reuses_the_generation_box(api: Api, in_india: None, downloads: Downloads) -> None:
    v = preflight(api, square())
    assert (v["level"], v["reason"], v["buildings"], v["roads"]) == ("ok", "measured", 10, 3)
    assert v["eta_s"] == realgen.estimate_seconds(10) and "10 buildings" in v["message"]
    # the pre-check downloads exactly the box pipeline.generate will ask for, so the download is reused
    poly = polygon_from_geojson(square())
    m = pipeline.MARGIN_DEG
    b = poly.bounds
    pipeline_box = Polygon(box(b[0] - m, b[1] - m, b[2] + m, b[3] + m).exterior.coords)
    assert fetch_osm.build_query(downloads[0]) == fetch_osm.build_query(pipeline_box)


def test_empty_area_is_fine(api: Api, in_india: None, downloads: Downloads) -> None:
    downloads.answer = done(fake_osm(0, roads=0))
    v = preflight(api, square())
    assert (v["level"], v["buildings"]) == ("ok", 0) and "No buildings are mapped" in v["message"]


def test_dense_area_warns(api: Api, in_india: None, downloads: Downloads, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(realgen, "DENSE_WARN_BUILDINGS", 20)
    downloads.answer = done(fake_osm(25))
    v = preflight(api, square())
    assert (v["level"], v["reason"], v["buildings"]) == ("warn", "dense", 25) and "dense area" in v["message"]


def test_too_dense_area_is_blocked(api: Api, in_india: None, downloads: Downloads, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(realgen, "DENSE_WARN_BUILDINGS", 20)
    monkeypatch.setattr(realgen, "DENSE_BLOCK_BUILDINGS", 40)
    downloads.answer = done(fake_osm(80))
    v = preflight(api, square())
    assert (v["level"], v["reason"], v["buildings"]) == ("block", "too_dense", 80)
    assert "smaller area, about 40% of this one" in v["message"]


def test_default_thresholds_are_sane() -> None:
    assert 300 <= realgen.DENSE_WARN_BUILDINGS < realgen.DENSE_BLOCK_BUILDINGS <= 1500


def test_map_servers_down_is_busy(api: Api, in_india: None, downloads: Downloads) -> None:
    downloads.answer = done(exc=fetch_osm.SourceUnavailable("a: HTTP 502; b: HTTP 504"))
    v = preflight(api, square())
    assert (v["level"], v["reason"], v["message"]) == ("busy", "osm_unavailable", fetch_osm.BUSY_MESSAGE)
    assert v["detail"] == "a: HTTP 502; b: HTTP 504"


def test_slow_download_lets_the_survey_continue(api: Api, in_india: None, downloads: Downloads,
                                                monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(realgen, "PREFLIGHT_WAIT_S", 0.05)
    downloads.answer = Future()  # never finishes within the wait
    v = preflight(api, square())
    assert (v["level"], v["reason"]) == ("ok", "pending")


def test_unexpected_download_error_fails_open(api: Api, in_india: None, downloads: Downloads) -> None:
    downloads.answer = done(exc=ValueError("bad JSON"))
    assert preflight(api, square())["reason"] == "unchecked"


def test_cached_raw_osm_is_used_without_downloading(api: Api, in_india: None, downloads: Downloads) -> None:
    key = polygon_key(polygon_from_geojson(square()))
    cache.write_json(key, "osm_raw.json", fake_osm(7))
    v = preflight(api, square())
    assert (v["level"], v["buildings"]) == ("ok", 7) and downloads == []


@pytest.mark.parametrize(("seconds", "text"), [(60, "about a minute"), (150, "about 2 minutes"), (300, "about 5 minutes")])
def test_duration_text(seconds: int, text: str) -> None:
    assert realgen._duration_text(seconds) == text


# ---------------------------------------------------------------- generation job: live log, retry, error kinds

def run_job(monkeypatch: pytest.MonkeyPatch, fake_generate: Any) -> dict[str, Any]:
    """Start a generation with a fake engine and wait for its background task; returns the job."""
    monkeypatch.setattr(fetch_osm, "india_check", lambda poly: None)
    monkeypatch.setattr(pipeline, "generate", fake_generate)
    monkeypatch.setattr(realgen, "RETRY_PAUSE_S", 0)

    async def go() -> dict[str, Any]:
        out = await realgen.generate(realgen.GenerateRequest(polygon=square()), db=None, user=FAKE_USERS["SURVEYOR"])
        await asyncio.gather(*list(realgen._tasks))
        return realgen.jobs[out["job_id"]]

    return asyncio.run(go())


FAKE_SCENE = {"stats": {"buildings": 3}, "place": {"locality": "Test Nagar"}, "summary": "A test area."}


def test_job_logs_stages_and_live_notes(area_cache: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_generate(polygon: Any, report: Any, force: bool) -> dict[str, Any]:
        report(0, pipeline.STAGES[0], "")
        report(1, pipeline.STAGES[1], "Overpass API")
        progress.note("Asking test server for the map data…")
        report(3, pipeline.STAGES[3], "Esri World Imagery")
        progress.note("Downloaded 4 of 8 map tiles", 0.5)
        report(3, pipeline.STAGES[3], "zoom 18")  # same stage again: a sub-step, not a new stage
        return FAKE_SCENE

    job = run_job(monkeypatch, fake_generate)
    assert job["status"] == "COMPLETE" and job["progress"] == 100 and job["stats"] == {"buildings": 3}
    msgs = [(e["kind"], e["msg"]) for e in job["log"]]
    assert msgs[0] == ("stage", "Generation queued") and msgs[-1] == ("done", "3D world ready")
    assert ("stage", "Fetching OpenStreetMap features · Overpass API") in msgs
    assert ("note", "Asking test server for the map data…") in msgs
    assert ("note", "zoom 18") in msgs
    assert not any("map tiles" in m for _, m in msgs)  # counters update the detail line only
    assert sum(1 for k, m in msgs if k == "stage" and m.startswith(pipeline.STAGES[3])) == 1
    assert job["stage_progress"] == 0.5 and job["stage_index"] == 3
    assert all(isinstance(e["t"], float) for e in job["log"])


def test_job_retries_once_when_map_servers_are_busy(area_cache: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = []

    def flaky(polygon: Any, report: Any, force: bool) -> dict[str, Any]:
        attempts.append(1)
        if len(attempts) == 1:
            raise fetch_osm.SourceUnavailable("a: HTTP 504")
        return FAKE_SCENE

    job = run_job(monkeypatch, flaky)
    assert job["status"] == "COMPLETE" and job["attempt"] == 2 and len(attempts) == 2
    assert any(e["kind"] == "retry" and "attempt 2 of 2" in e["msg"] for e in job["log"])


def test_job_reports_busy_after_the_last_attempt(area_cache: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    def down(polygon: Any, report: Any, force: bool) -> dict[str, Any]:
        raise fetch_osm.SourceUnavailable("a: HTTP 502; the API: timed out")

    job = run_job(monkeypatch, down)
    assert (job["status"], job["error_kind"], job["error"]) == ("FAILED", "busy", fetch_osm.BUSY_MESSAGE)
    assert job["error_detail"] == "a: HTTP 502; the API: timed out" and job["log"][-1]["kind"] == "error"


@pytest.mark.parametrize(("exc", "kind"), [(pipeline.AreaError("BHARAT 3D works only inside India."), "area"),
                                           (KeyError("buildings"), "internal")])
def test_job_error_kinds(area_cache: Any, monkeypatch: pytest.MonkeyPatch, exc: Exception, kind: str) -> None:
    def broken(polygon: Any, report: Any, force: bool) -> dict[str, Any]:
        raise exc

    job = run_job(monkeypatch, broken)
    assert (job["status"], job["error_kind"], job["error"]) == ("FAILED", kind, str(exc))


def test_job_log_is_bounded_and_skips_repeats(monkeypatch: pytest.MonkeyPatch) -> None:
    job = {"started_at": 0.0, "log": []}
    monkeypatch.setattr(realgen, "JOB_LOG_MAX", 5)
    for i in range(12):
        realgen._job_log(job, f"line {i}", "note")
        realgen._job_log(job, f"line {i}", "note")
    assert [e["msg"] for e in job["log"]] == ["line 0", "line 8", "line 9", "line 10", "line 11"]


def test_job_status_returns_a_copy_of_the_log(api: Api) -> None:
    job = {"id": "testjob00001", "key": "k", "status": "RUNNING", "started_at": 0.0,
           "log": [{"t": 0.0, "msg": "Generation queued", "kind": "stage"}]}
    realgen.jobs[job["id"]] = job
    try:
        got = json_body(api.get(f"/api/realgen/jobs/{job['id']}", "SURVEYOR"))
        assert got["log"] == job["log"] and got["elapsed_s"] > 0
        assert json.dumps(got)  # serialisable
    finally:
        realgen.jobs.pop(job["id"], None)
