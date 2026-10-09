"""Offline tests for the deterministic parts of the real-geography generator (no network)."""
import pytest
from shapely.geometry import Polygon

from app.realgen import synth
from app.realgen.geo import LocalFrame, polygon_from_geojson, polygon_key
from app.realgen.pipeline import AreaError, validate_area

CP = {"type": "Polygon", "coordinates": [[[77.2155, 28.6305], [77.2195, 28.6305], [77.2195, 28.6335],
                                          [77.2155, 28.6335], [77.2155, 28.6305]]]}


def test_polygon_key_is_stable():
    assert polygon_key(polygon_from_geojson(CP)) == polygon_key(polygon_from_geojson(CP))


def test_area_limits():
    assert 120_000 < validate_area(polygon_from_geojson(CP)) < 140_000
    huge = {"type": "Polygon", "coordinates": [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]]}
    with pytest.raises(AreaError):
        validate_area(polygon_from_geojson(huge))


def test_local_frame_round_trip():
    f = LocalFrame(77.2175, 28.632)
    x, y = f.point_to_local(77.2185, 28.633)
    lon, lat = f.point_to_lonlat(x, y)
    assert abs(lon - 77.2185) < 1e-7 and abs(lat - 28.633) < 1e-7
    assert 90 < x < 105 and 105 < y < 115  # ~98 m east, ~111 m north


def test_ulpin_and_3d_ulpin_syntax():
    from app.realgen import norms
    ulpin = synth.synth_ulpin("DL", 10.0, 20.0, 42)
    assert len(ulpin) == 14 and ulpin.isalnum() and ulpin.isupper()
    assert norms.valid_unit_id(f"{ulpin}-BL01-L08-U804")
    assert norms.valid_unit_id(f"{ulpin}-BL01-L04-UFLR") and norms.valid_unit_id(f"{ulpin}-BL01-S01-U0123")
    assert norms.valid_unit_id("INF-PUB-DL01-0007-BL01-L00-U012")
    assert not norms.valid_unit_id(f"{ulpin}-BL00-L01-U101")  # BL00 is reserved for parcel-level common space
    assert not norms.valid_unit_id(f"IN-DL-{ulpin}-BL01-L08-U804-R")  # no country prefix, no usage suffix
    assert norms.INF_RE.match("INF-TUN-DL01-0012") and norms.UTL_RE.match("INF-UTL-GAS-DL01-003410")
    assert norms.CSR_RE.match(f"CSR-{ulpin}-BL01-C004")


def test_unit_split_covers_footprint():
    sq = Polygon([(0, 0), (20, 0), (20, 10), (0, 10)])
    cells = synth.unit_polygons(sq, 4)
    assert len(cells) == 4
    assert abs(sum(c.area for c in cells) - sq.area) < 1e-6


def test_excavation_direct_strike_and_clear():
    assets = [
        {"id": "W", "kind": "water", "name": "Water main", "source": "synthetic", "path": [[-50, 0], [50, 0]],
         "depth_m": 1.8, "radius_m": 0.2, "buffer_m": 1.5},
        {"id": "M", "kind": "metro", "name": "Metro", "source": "osm", "path": [[-50, 0], [50, 0]],
         "depth_m": 15.0, "radius_m": 3.1, "buffer_m": 6.0},
    ]
    trench = Polygon([(-1, -2), (1, -2), (1, 2), (-1, 2)])  # crosses both lines in plan
    shallow = synth.excavation_check(trench, 1.0, assets)
    deep = synth.excavation_check(trench, 2.5, assets)
    assert shallow["overall_risk_level"] == "HIGH_RISK"  # within the water main's buffer, not touching it
    assert deep["overall_risk_level"] == "CRITICAL_RISK"
    assert {c["asset_id"] for c in deep["clashes"]} == {"W"}  # metro crown at 11.9 m is far below 2.5 m
