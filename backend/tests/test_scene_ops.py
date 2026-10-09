"""Offline tests for floor plans, the 3D ULPIN norms (identity, lifecycle, integrity), compliance rules and edits."""
import pytest
from shapely.geometry import Polygon

from app.realgen import cache, floorplan, norms, scene_ops


def _building(i, fp, floors=4, usage="R", **kw):
    g = Polygon(fp)
    b = {
        "id": f"BLD-{i:04d}", "osm_id": f"w{i}", "name": f"B{i}", "building_type": "yes", "usage": usage,
        "footprint": fp, "centroid": [g.centroid.x, g.centroid.y], "area_m2": g.area, "base_z": 0.0, "min_height": 0.0,
        "floors": floors, "height": floors * 3.2 + 0.6, "floor_height": 3.2, "height_source": "osm:levels",
        "footprint_source": "osm", "roof_shape": "flat", "sanctioned_floors": floors, "sanctioned_height": floors * 3.2 + 0.6,
        "sanction_status": "ON_RECORD", "permit_no": "BP/1", "parcel_id": f"PCL-{i:04d}", "ulpin": f"DL01ABCDEF{i:04d}",
        "block_no": 1, "units_per_floor": 1, "basement_levels": 0, "violation_ids": [], "footpath_encroachment_m2": 0.0,
        "seed": 1000 + i,
    }
    b.update(kw)
    return b


def _parcel(i, fp):
    return {"id": f"PCL-{i:04d}", "ulpin": f"DL01ABCDEF{i:04d}", "footprint": fp, "area_m2": Polygon(fp).area,
            "building_ids": [f"BLD-{i:04d}"], "source": "synthetic"}


def _scene():
    flat = [[0, 0], [30, 0], [30, 16], [0, 16]]
    house = [[60, 0], [70, 0], [70, 8], [60, 8]]
    road = {"id": "RD-1", "kind": "primary", "name": "Main Road", "width_m": 12, "path": [[-20, 25], [120, 25]],
            "elevation_m": 0.0, "is_bridge": False, "source": "osm", "width_tagged": True, "sidewalk": None, "is_sidewalk": False}
    encroacher = [[80, 15], [95, 15], [95, 24], [80, 24]]  # reaches into the footpath band and the carriageway (y 19..31)
    return {
        "version": 5, "key": "testscene0000001", "place": {"state_code": "DL", "locality": "Test", "city": "Delhi"},
        "terrain": {"extent": [-50, -50, 150, 50], "n": 2, "heights": [[0, 0], [0, 0]]},
        "buildings": [_building(1, flat, floors=6), _building(2, house, floors=1), _building(3, encroacher, floors=3)],
        "parcels": [_parcel(1, [[-2, -2], [32, -2], [32, 18], [-2, 18]]), _parcel(2, [[58, -2], [72, -2], [72, 10], [58, 10]]),
                    _parcel(3, [[78, 13], [97, 13], [97, 26], [78, 26]]),
                    {"id": "PCL-0009", "ulpin": "DL01ABCDEF0009", "footprint": [[100, -40], [140, -40], [140, -10], [100, -10]],
                     "area_m2": 1200, "building_ids": [], "source": "synthetic"}],
        "roads": [road], "railways": [], "subsurface": [], "construction_sites": [], "violations": [], "stats": {},
        "survey_polygon": {"lonlat": [], "local": []}, "origin": {"lon": 77.2, "lat": 28.6},
    }


@pytest.fixture(autouse=True)
def tmp_cache(tmp_path, monkeypatch):
    """Every test gets its own cache (scene files, the area ledger and the national INF ledger)."""
    monkeypatch.setattr(cache, "CACHE_ROOT", str(tmp_path))
    return tmp_path


def test_floor_plan_has_core_corridor_units_and_rooms():
    plan = floorplan.plan_floor([[0, 0], [30, 0], [30, 16], [0, 16]], "R", 7, 1)
    assert plan["core"] and plan["corridor"]
    assert len(plan["units"]) >= 2
    assert all(len(u["rooms"]) >= 3 for u in plan["units"])
    names = {r["name"] for u in plan["units"] for r in u["rooms"]}
    assert "Kitchen" in names and any(n.startswith("Bedroom") for n in names)


def test_forced_units_per_floor():
    assert len(floorplan.plan_floor([[0, 0], [30, 0], [30, 16], [0, 16]], "R", 7, 3, force_units=5)["units"]) == 5


def test_identity_follows_the_norms():
    scene = _scene()
    entries, counts = scene_ops.build_registry(scene)
    tower, house = scene["buildings"][0], scene["buildings"][1]
    assert tower["identity_kind"] == "STRATA" and house["identity_kind"] == "SINGLE_TITLE"
    house_rows = [e for e in entries if e["building_id"] == house["id"]]
    assert len(house_rows) == 1 and house_rows[0]["vprid"] is None and house_rows[0]["status"] == "NOT_REQUIRED_2D"
    ids = [e["vprid"] for e in entries if e["vprid"]]
    assert ids and len(ids) == len(set(ids)) == counts["reserved"] and all(norms.valid_unit_id(v) for v in ids)
    tower_ids = [e["vprid"] for e in entries if e["vprid"] and e["building_id"] == tower["id"]]
    assert tower_ids and all(v.startswith("DL01ABCDEF0001-BL01-L") for v in tower_ids)
    assert "DL01ABCDEF0001-BL01-L00-U001" in ids
    # common spaces are registered, never given a ULPIN
    assert any(c["id"] == "CSR-DL01ABCDEF0001-BL01-C001" for c in scene["common_spaces"])
    assert all(norms.CSR_RE.match(c["id"]) for c in scene["common_spaces"])


def test_uds_is_integer_ppm_summing_to_one_million():
    assert sum(norms.uds_ppm([85.4, 85.4, 85.4])) == 1_000_000
    scene = scene_ops.derive(_scene())["scene"]
    assert not scene["integrity"]["axiom6_uds_closure"]["failures"]
    detail = scene_ops.building_detail(scene, "BLD-0001")
    assert detail and detail["floors"][0]["units"]


def test_villa_with_basement_and_temple_stay_2d_public_building_is_inf_pub():
    s = _scene()
    s["buildings"][1].update(basement_levels=1, floors=2)  # plotted house with an integrated basement
    s["buildings"][2].update(usage="P", building_type="government", name="District Collectorate")
    s["buildings"].append(_building(4, [[0, 30], [12, 30], [12, 40], [0, 40]], floors=1, usage="P", building_type="temple"))
    entries, counts = scene_ops.build_registry(s)
    kinds = {b["id"]: b["identity_kind"] for b in s["buildings"]}
    assert kinds["BLD-0002"] == "SINGLE_TITLE" and kinds["BLD-0004"] == "SINGLE_TITLE"
    assert kinds["BLD-0003"] == "INF_PUB" and norms.INF_RE.match(s["buildings"][2]["inf_id"])
    assert s["buildings"][2]["inf_id"].startswith("INF-PUB-DL")


def test_ai_proposal_is_not_minted_until_verified():
    s = _scene()
    s["buildings"][0]["footprint_source"] = "ai:geoai"
    entries, _ = scene_ops.build_registry(s)
    assert all(e["vprid"] is None for e in entries if e["building_id"] == "BLD-0001")
    s["buildings"][0]["verified"] = True
    entries, _ = scene_ops.build_registry(s)
    assert any(e["vprid"] for e in entries if e["building_id"] == "BLD-0001")


def test_infrastructure_ids_clearances_and_easements():
    s = _scene()
    s["subsurface"] = [
        {"id": "MET-w77-0", "kind": "metro", "name": "Yellow Line", "source": "osm", "path": [[-10, 5], [110, 5]],
         "depth_m": 16, "radius_m": 3.1, "buffer_m": 6, "operator": "DMRC"},
        {"id": "UTL-GAS-0001", "kind": "gas", "name": "Gas main", "source": "synthetic", "path": [[-10, 22], [110, 22]],
         "depth_m": 1.5, "radius_m": 0.2, "buffer_m": 9, "operator": "IGL"},
    ]
    scene = scene_ops.derive(s)["scene"]
    metro, gas = scene["subsurface"]
    assert norms.INF_RE.match(metro["inf_id"]) and metro["inf_id"].startswith("INF-TUN-DL")
    assert metro["buffer_m"] == norms.TUNNEL_CLEARANCE_M and gas["buffer_m"] == 3.0
    assert norms.UTL_RE.match(gas["inf_id"]) and gas["inf_id"].startswith("INF-UTL-GAS-")
    assert "DL01ABCDEF0001" in metro["affected_ulpins"]  # recorded as an easement on every parcel it crosses
    p1 = next(p for p in scene["parcels"] if p["ulpin"] == "DL01ABCDEF0001")
    assert {"inf_id": metro["inf_id"], "type": "SUBSURFACE_EASEMENT"} in p1["encumbrances"]
    # the same real asset seen again keeps its ID
    again = scene_ops.derive(_scene() | {"subsurface": [dict(s["subsurface"][0])], "key": "otherarea0000002"})["scene"]
    assert again["subsurface"][0]["inf_id"] == metro["inf_id"]


def test_footpath_and_road_encroachment_detected():
    scene = scene_ops.derive(_scene())["scene"]
    types = {(v["building_id"], v["type"]) for v in scene["violations"]}
    assert ("BLD-0003", "FOOTPATH_ENCROACHMENT") in types
    assert ("BLD-0003", "ROAD_ENCROACHMENT") in types
    assert not any(b == "BLD-0001" for b, _ in types)  # the tower stands clear of the road
    assert all(v["geometry"] for v in scene["violations"] if v["type"].endswith("ENCROACHMENT"))


def _tower_ids(key, floor):
    return {e["vprid"] for e in cache.read_json(key, "registry.json")
            if e["vprid"] and e["floor"] == floor and e["building_id"] == "BLD-0001"}


def test_ids_are_never_reused_after_partition_and_undo():
    key = "testscene0000001"
    cache.write_json(key, "scene_base.json", _scene())
    scene_ops.rebuild(key)
    first = _tower_ids(key, 2)
    ground = _tower_ids(key, 0)
    scene_ops.add_edits(key, [{"op": "building.update", "id": "BLD-0001", "set": {"unit_overrides": {"2": 7}}}], "t@x")
    second = _tower_ids(key, 2)
    assert len(second) == 7 and not (first & second)  # partition: old IDs retired, fresh unit numbers minted
    led = norms.read_ledger(key)
    retired = [u for u in led["units"] if u["id"] in first]
    assert retired and all(u["status"] == "RETIRED" for u in retired)
    assert all(set(u["parents"]) == first for u in led["units"] if u["id"] in second)
    scene_ops.undo(key)
    third = _tower_ids(key, 2)
    assert len(third) == len(first) and not (third & (first | second))  # never reused, even after undo
    assert _tower_ids(key, 0) == ground  # unrelated floors kept their IDs throughout


def test_edit_cycle_recomputes_and_resets():
    key = "testscene0000001"
    cache.write_json(key, "scene_base.json", _scene())
    base = scene_ops.rebuild(key)
    s1 = scene_ops.add_edits(key, [{"op": "building.update", "id": "BLD-0001", "set": {"floors": 9}}], "t@x")
    tower = next(b for b in s1["buildings"] if b["id"] == "BLD-0001")
    assert tower["floors"] == 9 and tower["height_source"] == "edited:surveyor"
    assert any(v["building_id"] == "BLD-0001" and v["type"] == "UNAUTHORIZED_EXTRA_FLOORS" for v in s1["violations"])
    held = [e for e in cache.read_json(key, "registry.json") if e["building_id"] == "BLD-0001" and e["floor"] >= 6]
    assert held and all(e["vprid"] is None and e["status"] == "PENDING" for e in held)  # open failure: not minted
    s2 = scene_ops.add_edits(key, [{"op": "asset.add", "asset": {"kind": "metro", "path": [[0, 0], [100, 0]], "depth_m": 18}}], "t@x")
    assert s2["subsurface"][-1]["kind"] == "metro" and s2["subsurface"][-1]["depth_m"] == 18
    assert s2["subsurface"][-1]["inf_id"].startswith("INF-TUN-")
    s3 = scene_ops.undo(key)
    assert len(s3["subsurface"]) == len(base["subsurface"])
    s4 = scene_ops.reset(key)
    assert s4["stats"]["vprids_reserved"] == base["stats"]["vprids_reserved"] and s4["edits_count"] == 0
