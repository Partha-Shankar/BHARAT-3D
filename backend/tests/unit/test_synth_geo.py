# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Behaviour-locking tests for the synthetic ULPIN and the local metric frame."""
import re

import pytest
from shapely.geometry import Polygon

from app.realgen import synth
from app.realgen.geo import LocalFrame, polygon_from_geojson, polygon_key, stable_int

ULPIN_RE = re.compile(r"^[0-9A-Z]{14}$")


@pytest.mark.parametrize("state", ["DL", "KA", "MH", "TN", "WB"])
def test_synth_ulpin_shape(state: str) -> None:
    for i in range(50):
        u = synth.synth_ulpin(state, i * 13.7, -i * 4.1, 1000 + i)
        assert ULPIN_RE.match(u), u
        assert u.startswith(state)
        assert 10 <= int(u[2:4]) <= 98  # two-digit synthetic district


def test_synth_ulpin_is_deterministic_and_position_dependent() -> None:
    a = synth.synth_ulpin("DL", 10.0, 20.0, 42)
    assert a == synth.synth_ulpin("DL", 10.0, 20.0, 42)
    assert a != synth.synth_ulpin("DL", 30.0, 20.0, 42)
    assert a == synth.synth_ulpin("DL", 10.04, 19.96, 42)  # positions are rounded to 0.1 m


@pytest.mark.parametrize("state, prefix", [("ka", "KA"), ("D", "DX"), ("", "XX"), (None, "XX"), ("KAR", "KA")])
def test_synth_ulpin_normalises_the_state_code(state, prefix: str) -> None:
    u = synth.synth_ulpin(state, 1.0, 2.0, 3)
    assert u.startswith(prefix) and ULPIN_RE.match(u)


@pytest.mark.parametrize("lon, lat", [(77.2175, 28.632), (72.8777, 19.0760), (80.2707, 13.0827), (88.3639, 22.5726),
                                      (77.4126, 23.2599)])
def test_local_frame_round_trip_across_india(lon: float, lat: float) -> None:
    f = LocalFrame(lon, lat)
    for dx, dy in ((0.0, 0.0), (0.004, 0.003), (-0.006, 0.002)):
        x, y = f.point_to_local(lon + dx, lat + dy)
        back = f.point_to_lonlat(x, y)
        assert abs(back[0] - (lon + dx)) < 1e-9 and abs(back[1] - (lat + dy)) < 1e-9
    assert f.point_to_local(lon, lat) == pytest.approx((0.0, 0.0), abs=1e-6)


def test_local_frame_polygon_round_trip_keeps_area() -> None:
    ring = [[77.2155, 28.6305], [77.2195, 28.6305], [77.2195, 28.6335], [77.2155, 28.6335], [77.2155, 28.6305]]
    poly = Polygon(ring)
    f = LocalFrame.for_polygon(poly)
    local = f.to_local(poly)
    assert 120_000 < local.area < 140_000
    back = f.to_lonlat(local)
    assert back.symmetric_difference(poly).area < 1e-12


def test_polygon_key_is_stable_and_sixteen_hex_chars() -> None:
    gj = {"type": "Polygon", "coordinates": [[[77.0, 28.0], [77.01, 28.0], [77.01, 28.01], [77.0, 28.0]]]}
    k = polygon_key(polygon_from_geojson(gj))
    assert re.fullmatch(r"[0-9a-f]{16}", k)
    assert k == polygon_key(polygon_from_geojson(gj))
    assert k == polygon_key(polygon_from_geojson(gj["coordinates"][0]))  # a bare ring gives the same key


def test_polygon_key_rounds_to_six_decimals_and_tracks_vertices() -> None:
    ring = [[77.0, 28.0], [77.01, 28.0], [77.01, 28.01], [77.0, 28.0]]
    nudged = [[x + 1e-8, y] for x, y in ring]
    moved = [[x + 1e-4, y] for x, y in ring]
    k = polygon_key(Polygon(ring))
    assert polygon_key(Polygon(nudged)) == k
    assert polygon_key(Polygon(moved)) != k


def test_stable_int_is_deterministic() -> None:
    assert stable_int("a", 1, 2.5) == stable_int("a", 1, 2.5)
    assert stable_int("a", 1) != stable_int("a", 2)
    assert 0 <= stable_int("x") < 16 ** 12
