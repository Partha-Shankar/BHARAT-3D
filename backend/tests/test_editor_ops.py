# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""The 3D editor's building operations: utility pipes and tunnels, basements, roads and flyovers, trees and
footpaths, basement levels, and bad input that must be recorded as an edit error instead of failing the area."""
import pytest
from shapely.geometry import Polygon

from app.realgen import cache, scene_ops
from tests.test_scene_ops import _scene

KEY = "testscene0000001"


@pytest.fixture(autouse=True)
def area(tmp_path, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ROOT", str(tmp_path))
    scene = _scene()
    scene["trees"] = [{"x": 10.0, "y": -30.0}, {"x": 40.0, "y": -30.0}]
    cache.write_json(KEY, "scene_base.json", scene)
    return scene_ops.rebuild(KEY)


def edit(*ops):
    return scene_ops.add_edits(KEY, list(ops), "survey@bharat3d.demo")


@pytest.mark.parametrize("kind,depth,radius", [("water", 1.2, 0.3), ("sewer", 2.5, 0.5), ("gas", 1.0, 0.15),
                                               ("power", 1.0, 0.1), ("telecom", 0.8, 0.1), ("road_tunnel", 8.0, 4.5)])
def test_every_utility_and_tunnel_can_be_laid(kind, depth, radius):
    s = edit({"op": "asset.add", "asset": {"kind": kind, "path": [[0, -20], [90, -20]], "depth_m": depth, "radius_m": radius,
                                            "buffer_m": 1.5, "name": f"New {kind}"}})
    a = s["subsurface"][-1]
    assert (a["kind"], a["depth_m"], a["radius_m"]) == (kind, depth, radius)
    assert a["source"] == "edited" and a["id"].startswith("TUN-E" if kind == "road_tunnel" else "UTL-E")
    assert s["stats"]["subsurface_assets"] == 1 and not s["edit_errors"]


def test_basement_from_a_drawn_outline():
    s = edit({"op": "asset.add", "asset": {"kind": "basement", "footprint": [[0, 0], [30, 0], [30, 16], [0, 16]], "depth_m": 7,
                                            "depth_top_m": 0.5, "name": "New basement"}})
    a = s["subsurface"][-1]
    assert a["kind"] == "basement" and a["id"].startswith("BSM-E") and a["depth_top_m"] == 0.5 and "path" not in a


def test_ground_road_and_flyover():
    s = edit({"op": "road.add", "road": {"kind": "residential", "path": [[0, -40], [100, -40]], "elevation_m": 0, "width_m": 9}},
             {"op": "road.add", "road": {"kind": "primary", "path": [[0, 40], [100, 40]], "elevation_m": 7, "width_m": 12}})
    ground, flyover = s["roads"][-2], s["roads"][-1]
    assert not ground["is_bridge"] and ground["width_m"] == 9
    assert flyover["is_bridge"] and flyover["elevation_m"] == 7


def test_plant_remove_and_undo_trees():
    s = edit({"op": "tree.add", "points": [[100, -30], [110, -30], [120, -30]]})
    planted = [t for t in s["trees"] if t.get("source") == "edited"]
    assert len(planted) == 3 and len(s["trees"]) == 5
    s = edit({"op": "tree.remove", "at": [110, -30], "radius_m": 6})
    assert [t["x"] for t in s["trees"] if t.get("source") == "edited"] == [100, 120]
    assert s["trees_removed"] == [{"x": 110.0, "y": -30.0, "r": 6.0}]  # also hides trees seen in the imagery there
    s = scene_ops.undo(KEY)
    assert len(s["trees"]) == 5 and not s.get("trees_removed")


def test_add_and_delete_a_drawn_footpath():
    before = len(scene_ops.rebuild(KEY)["footpaths"])
    s = edit({"op": "footpath.add", "footpath": {"path": [[0, -10], [50, -10]], "width_m": 2.5}})
    own = [f for f in s["footpaths"] if f["source"] == "surveyor"]
    assert len(own) == 1 and own[0]["id"] == "FPE-001" and own[0]["area_m2"] == pytest.approx(125, rel=0.02)
    assert len(s["footpaths"]) == before + 1
    s = edit({"op": "footpath.delete", "id": "FPE-001"})
    assert len(s["footpaths"]) == before and not [f for f in s["footpaths"] if f["source"] == "surveyor"]


def test_remove_a_derived_footpath_by_location():
    base = scene_ops.rebuild(KEY)["footpaths"]
    assert base, "the test road should have footpath bands"
    spot = Polygon(base[0]["rings"][0]).representative_point()
    s = edit({"op": "footpath.remove", "at": [spot.x, spot.y]})
    assert len(s["footpaths"]) == len(base) - 1
    assert not any(Polygon(f["rings"][0]).buffer(0.5).contains(spot) for f in s["footpaths"])


def test_basement_levels_are_whole_and_bounded():
    s = edit({"op": "building.update", "id": "BLD-0001", "set": {"basement_levels": 9.7}})
    assert next(b for b in s["buildings"] if b["id"] == "BLD-0001")["basement_levels"] == 6


@pytest.mark.parametrize("op,error", [
    ({"op": "tree.add", "points": [["a", "b"]]}, "planting trees needs at least one point"),
    ({"op": "tree.remove", "at": None}, "removing trees needs a point"),
    ({"op": "footpath.add", "footpath": {"path": [[0, 0]], "width_m": 2}}, "a footpath needs at least two points"),
    ({"op": "footpath.delete", "id": "FPE-999"}, "footpath FPE-999 not found"),
    ({"op": "footpath.remove", "at": [1]}, "removing a footpath needs a point"),
])
def test_bad_edits_are_recorded_not_fatal(op, error):
    s = edit(op)
    assert s["edit_errors"] == [{"edit": 1, "error": error}]
    assert s["stats"]["buildings"] == 3  # the area itself is unaffected
