# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""OpenStreetMap download: tag rules, the API 0.6 converter, the hedged race, shared downloads and progress notes.

No network: every source is replaced by a fake.
"""
from __future__ import annotations

import io
import threading
import time
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any, Self

import numpy as np
import pytest
from PIL import Image
from shapely.geometry import Polygon, box

from app.realgen import fetch_osm, progress, tiles

BOUNDS = (77.57, 12.975, 77.577, 12.981)
POLY = Polygon(box(*BOUNDS).exterior.coords)
OVERPASS_LIKE = {"version": 0.6, "generator": "fake Overpass", "osm3s": {"timestamp_osm_base": "2026-01-01T00:00:00Z"},
                 "elements": [{"type": "node", "id": 1, "lat": 12.976, "lon": 77.571, "tags": {"natural": "tree"}}]}


@pytest.fixture(autouse=True)
def _fresh_downloads() -> Iterator[None]:
    fetch_osm.forget_downloads()
    yield
    fetch_osm.forget_downloads()


@pytest.fixture
def notes() -> Iterator[list[tuple[str, float | None]]]:
    got: list[tuple[str, float | None]] = []
    token = progress.use(lambda m, f: got.append((m, f)))
    yield got
    progress.reset(token)


class FakeClient:
    """Stands in for httpx.Client: every request gets `response`."""

    response: Any = None

    def __init__(self, *a: Any, **k: Any) -> None: ...
    def __enter__(self) -> Self: return self
    def __exit__(self, *a: object) -> None: ...
    def get(self, *a: Any, **k: Any) -> Any: return self.response
    def post(self, *a: Any, **k: Any) -> Any: return self.response


def fast_schedule(monkeypatch: pytest.MonkeyPatch, *entries: tuple[float, str, str | None]) -> None:
    monkeypatch.setattr(fetch_osm, "SCHEDULE", list(entries))


# ---------------------------------------------------------------- tag rules (must equal build_query)

@pytest.mark.parametrize(("etype", "tags", "expected"), [
    ("way", {"building": "yes"}, True),
    ("way", {"building": "no"}, True),  # Overpass way["building"] matches any value
    ("relation", {"building": "apartments", "type": "multipolygon"}, True),
    ("way", {"highway": "residential"}, True),
    ("way", {"railway": "rail"}, True),
    ("way", {"natural": "water"}, True),
    ("way", {"natural": "wood"}, False),
    ("way", {"waterway": "drain"}, True),
    ("way", {"leisure": "park"}, True),
    ("way", {"leisure": "parking"}, False),  # the regex is anchored: ^(park|...)$
    ("way", {"landuse": "construction"}, True),
    ("way", {"landuse": "residential"}, False),
    ("relation", {"landuse": "construction"}, True),
    ("relation", {"landuse": "grass"}, False),
    ("way", {"power": "line"}, True),
    ("way", {"power": "tower"}, False),
    ("way", {"man_made": "pipeline"}, True),
    ("node", {"natural": "tree"}, True),
    ("node", {"railway": "station"}, True),
    ("node", {"railway": "level_crossing"}, False),
    ("node", {"public_transport": "station"}, True),
    ("node", {"public_transport": "platform"}, False),
    ("node", {"building": "yes"}, False),
    ("way", {}, False),
    ("area", {"building": "yes"}, False),
])
def test_wanted_follows_build_query(etype: str, tags: dict[str, str], expected: bool) -> None:
    assert fetch_osm.wanted(etype, tags) is expected


def test_build_query_names_every_rule() -> None:
    q = fetch_osm.build_query(POLY)
    assert "[bbox:12.9750000,77.5700000,12.9810000,77.5770000]" in q
    for rule in ('way["building"]', 'relation["building"]', 'way["highway"]', 'node["natural"="tree"]',
                 'relation["landuse"="construction"]', 'node["public_transport"="station"]', "out geom;"):
        assert rule in q


# ---------------------------------------------------------------- API 0.6 map.json -> Overpass out geom

def _map_json() -> dict[str, Any]:
    sq = [(77.5710, 12.9760), (77.5712, 12.9760), (77.5712, 12.9762), (77.5710, 12.9762)]
    nodes = [{"type": "node", "id": 100 + i, "lat": lat, "lon": lon, "user": "someone", "uid": 7, "changeset": 9}
             for i, (lon, lat) in enumerate(sq)]
    rel_sq = [(77.5730, 12.9770), (77.5734, 12.9770), (77.5734, 12.9774), (77.5730, 12.9774)]
    nodes += [{"type": "node", "id": 200 + i, "lat": lat, "lon": lon} for i, (lon, lat) in enumerate(rel_sq)]
    nodes += [
        {"type": "node", "id": 300, "lat": 12.9780, "lon": 77.5750, "tags": {"natural": "tree"}},
        {"type": "node", "id": 301, "lat": 12.9900, "lon": 77.5750, "tags": {"natural": "tree"}},  # outside the box
        {"type": "node", "id": 302, "lat": 12.9790, "lon": 77.5760, "tags": {"railway": "station", "name": "Test"}},
        {"type": "node", "id": 303, "lat": 12.9791, "lon": 77.5761, "tags": {"amenity": "bench"}},
    ]
    ways = [
        {"type": "way", "id": 10, "nodes": [100, 101, 102, 103, 100], "tags": {"building": "yes"}, "user": "someone"},
        {"type": "way", "id": 11, "nodes": [100, 102], "tags": {"highway": "service"}},
        {"type": "way", "id": 12, "nodes": [200, 201, 202, 203, 200]},  # untagged outer of relation 50
        {"type": "way", "id": 13, "nodes": [100, 999], "tags": {"highway": "path"}},  # node 999 missing -> dropped
        {"type": "way", "id": 14, "nodes": [100, 101], "tags": {"barrier": "wall"}},  # not wanted
    ]
    rels = [
        {"type": "relation", "id": 50, "tags": {"type": "multipolygon", "building": "yes"},
         "members": [{"type": "way", "ref": 12, "role": "outer"}, {"type": "way", "ref": 777, "role": "inner"}]},
        {"type": "relation", "id": 51, "tags": {"type": "route", "route": "bus"},
         "members": [{"type": "way", "ref": 11, "role": ""}]},
    ]
    return {"version": "0.6", "generator": "fake API", "bounds": {}, "elements": rels + ways + nodes}


def test_converter_shape_and_filtering() -> None:
    out = fetch_osm.osm_api_to_overpass(_map_json(), BOUNDS)
    assert out["osm3s"]["timestamp_osm_base"].endswith("Z") and "ODbL" in out["osm3s"]["copyright"]
    ids = [(e["type"], e["id"]) for e in out["elements"]]
    assert ids == [("node", 300), ("node", 302), ("way", 10), ("way", 11), ("relation", 50)]
    way = next(e for e in out["elements"] if e["id"] == 10)
    assert way["geometry"][0] == {"lat": 12.9760, "lon": 77.5710} and len(way["geometry"]) == 5
    assert set(way) == {"type", "id", "nodes", "geometry", "tags"}  # no user names or changesets
    rel = next(e for e in out["elements"] if e["id"] == 50)
    assert len(rel["members"][0]["geometry"]) == 5 and "geometry" not in rel["members"][1]


def test_converted_data_parses_like_overpass() -> None:
    feats = fetch_osm.parse_elements(fetch_osm.osm_api_to_overpass(_map_json(), BOUNDS))
    assert sorted(b["osm_id"] for b in feats["buildings"]) == ["r50", "w10"]
    assert [r["osm_id"] for r in feats["roads"]] == ["w11"]
    assert [t["osm_id"] for t in feats["trees"]] == ["n300"]
    assert [s["osm_id"] for s in feats["stations"]] == ["n302"]


def test_converter_handles_an_empty_answer() -> None:
    out = fetch_osm.osm_api_to_overpass({"elements": []}, BOUNDS)
    assert out["elements"] == [] and fetch_osm.parse_elements(out)["buildings"] == []


# ---------------------------------------------------------------- hedged race

def test_first_good_answer_wins_and_is_reported(monkeypatch: pytest.MonkeyPatch, notes: list) -> None:
    calls: list[str] = []

    def overpass(url: str, query: str, timeout: Any = None) -> dict[str, Any]:
        calls.append(url)
        if url == "busy":
            raise RuntimeError("HTTP 504")
        time.sleep(5)  # never wins
        return {"elements": []}

    monkeypatch.setattr(fetch_osm, "_overpass_post", overpass)
    monkeypatch.setattr(fetch_osm, "fetch_osm_api", lambda bounds, timeout=None: OVERPASS_LIKE)
    fast_schedule(monkeypatch, (0.0, "busy server", "busy"), (0.0, "slow server", "slow"), (0.15, "the API", None))
    t0 = time.monotonic()
    data = fetch_osm.fetch_overpass(POLY)
    assert data is OVERPASS_LIKE and time.monotonic() - t0 < 2
    text = [m for m, _ in notes]
    assert text[0] == "Asking busy server and slow server for the map data…"
    assert any("busy server is busy (HTTP 504)" in m for m in text)
    assert any(m.startswith("Map data received from the API: 1 features") for m in text)


def test_everything_failed_raises_a_friendly_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def down(*a: Any, **k: Any) -> dict[str, Any]:
        raise RuntimeError("HTTP 502")

    monkeypatch.setattr(fetch_osm, "_overpass_post", down)
    monkeypatch.setattr(fetch_osm, "fetch_osm_api", down)
    fast_schedule(monkeypatch, (0.0, "a", "a"), (5.0, "b", "b"), (9.0, "the API", None))
    t0 = time.monotonic()
    with pytest.raises(fetch_osm.SourceUnavailable) as err:
        fetch_osm.fetch_overpass(POLY)
    assert time.monotonic() - t0 < 2  # a source that failed starts the next one at once, no idle waiting
    assert str(err.value) == fetch_osm.BUSY_MESSAGE
    assert all(label in err.value.detail for label in ("a: RuntimeError", "b: RuntimeError", "the API: RuntimeError"))


def test_deadline_stops_waiting(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fetch_osm, "_overpass_post", lambda *a, **k: time.sleep(3))
    monkeypatch.setattr(fetch_osm, "FETCH_DEADLINE_S", 0.3)
    fast_schedule(monkeypatch, (0.0, "stuck", "stuck"))
    t0 = time.monotonic()
    with pytest.raises(fetch_osm.SourceUnavailable) as err:
        fetch_osm.fetch_overpass(POLY)
    assert time.monotonic() - t0 < 1.5 and "no answer within" in err.value.detail


def test_overpass_partial_answer_is_a_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    partial = {"remark": 'runtime error: Query timed out in "query"', "elements": []}
    resp = SimpleNamespace(status_code=200, headers={"content-type": "application/json"}, json=lambda: partial)
    monkeypatch.setattr(FakeClient, "response", resp)
    monkeypatch.setattr(fetch_osm, "_client", lambda timeout: FakeClient())
    with pytest.raises(RuntimeError, match="incomplete answer"):
        fetch_osm._overpass_post("https://example.invalid", "q")


def test_client_is_ipv4_only() -> None:
    with fetch_osm._client(fetch_osm.OVERPASS_TIMEOUT) as client:
        pool = client._transport._pool
        assert pool._local_address == "0.0.0.0"
        assert client.headers["User-Agent"] == fetch_osm.USER_AGENT


# ---------------------------------------------------------------- shared downloads

def test_concurrent_requests_share_one_download_and_reuse_it(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    gate = threading.Event()

    def overpass(url: str, query: str, timeout: Any = None) -> dict[str, Any]:
        calls.append(url)
        gate.wait(2)
        return OVERPASS_LIKE

    monkeypatch.setattr(fetch_osm, "_overpass_post", overpass)
    fast_schedule(monkeypatch, (0.0, "only", "only"))
    pre = fetch_osm.start_fetch(POLY)  # the area pre-check
    results: list[dict] = []
    t = threading.Thread(target=lambda: results.append(fetch_osm.fetch_overpass(POLY)))  # the generation
    t.start()
    time.sleep(0.1)
    gate.set()
    t.join(3)
    assert pre.result(1) is OVERPASS_LIKE and results == [OVERPASS_LIKE] and calls == ["only"]
    assert fetch_osm.fetch_overpass(POLY) is OVERPASS_LIKE and calls == ["only"]  # remembered
    fetch_osm.forget_downloads()
    fetch_osm.fetch_overpass(POLY)
    assert calls == ["only", "only"]


def test_a_failed_download_is_not_remembered(monkeypatch: pytest.MonkeyPatch) -> None:
    answers = iter([RuntimeError("HTTP 429"), OVERPASS_LIKE])

    def overpass(*a: Any, **k: Any) -> dict[str, Any]:
        nxt = next(answers)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt

    monkeypatch.setattr(fetch_osm, "_overpass_post", overpass)
    fast_schedule(monkeypatch, (0.0, "one", "one"))
    with pytest.raises(fetch_osm.SourceUnavailable):
        fetch_osm.fetch_overpass(POLY)
    assert fetch_osm.fetch_overpass(POLY) is OVERPASS_LIKE


def test_late_joiner_sees_the_latest_note(monkeypatch: pytest.MonkeyPatch, notes: list) -> None:
    gate = threading.Event()
    monkeypatch.setattr(fetch_osm, "_overpass_post", lambda *a, **k: (gate.wait(2), OVERPASS_LIKE)[1])
    fast_schedule(monkeypatch, (0.0, "only", "only"))
    fetch_osm.start_fetch(POLY)
    time.sleep(0.1)
    threading.Timer(0.2, gate.set).start()
    fetch_osm.fetch_overpass(POLY)
    assert notes[0][0] == "Asking only for the map data…"


def test_memory_keeps_only_the_latest_boxes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fetch_osm, "_overpass_post", lambda *a, **k: {"elements": []})
    fast_schedule(monkeypatch, (0.0, "only", "only"))
    for i in range(fetch_osm.RECENT_MAX + 2):
        fetch_osm.fetch_overpass(Polygon(box(77.0 + i, 12.0, 77.001 + i, 12.001).exterior.coords))
    assert len(fetch_osm._recent) == fetch_osm.RECENT_MAX


def test_remembered_download_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fetch_osm, "_overpass_post", lambda *a, **k: {"elements": []})
    fast_schedule(monkeypatch, (0.0, "only", "only"))
    fetch_osm.fetch_overpass(POLY)
    monkeypatch.setattr(fetch_osm, "RECENT_TTL_S", -1)
    assert fetch_osm._remembered(fetch_osm.build_query(POLY)) is None


# ---------------------------------------------------------------- progress notes

def test_note_without_reporter_is_a_no_op() -> None:
    assert progress.current() is None
    progress.note("nothing listens")


def test_note_clamps_and_never_raises(notes: list) -> None:
    progress.note("half", 0.5)
    progress.note("over", 7)
    assert notes == [("half", 0.5), ("over", 1.0)]
    token = progress.use(lambda m, f: 1 / 0)
    try:
        progress.note("boom")  # a broken reporter must not fail a generation
    finally:
        progress.reset(token)


def test_tile_mosaic_reports_its_downloads(monkeypatch: pytest.MonkeyPatch, notes: list) -> None:
    buf = io.BytesIO()
    Image.new("RGB", (256, 256), (10, 20, 30)).save(buf, "PNG")

    monkeypatch.setattr(FakeClient, "response", SimpleNamespace(status_code=200, content=buf.getvalue()))
    monkeypatch.setattr(tiles.httpx, "Client", FakeClient)
    arr = tiles.mosaic(lambda z, x, y: f"tile/{z}/{x}/{y}", (77.570, 12.975, 77.577, 12.981), 17)
    assert arr.shape[2] == 3 and np.all(arr[0, 0] == (10, 20, 30))
    assert notes and notes[-1][1] == 1.0 and notes[-1][0].startswith("Downloaded ")
    assert all(f is not None for _, f in notes)
