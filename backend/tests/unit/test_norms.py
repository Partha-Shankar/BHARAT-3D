# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Behaviour-locking tests for app.realgen.norms: they assert what the 3D ULPIN norms do today.

If one of these fails after a change, the identifier rules changed: that must be a deliberate decision.
"""
import itertools
import random
from typing import Any

import pytest

from app.realgen import cache, norms

BASE = "KA232C3EMBDLHY"  # 14-character base ULPIN


# --------------------------------------------------------------------------- valid_unit_id
@pytest.mark.parametrize("uid", [
    f"{BASE}-BL01-L08-U804",            # ordinary flat
    f"{BASE}-BL01-L00-U001",            # ground floor
    f"{BASE}-BL01-S01-U001",            # basement level
    f"{BASE}-BL01-S03-U0301",           # deeper basement, 4-digit unit
    f"{BASE}-BL01-RF-UFLR",             # roof, whole-floor unit
    f"{BASE}-BL01-RF-U900",             # roof unit with a number
    f"{BASE}-BL01-L04-UFLR",            # whole-floor unit
    f"{BASE}-BL01-L12-U1204",           # 4-digit unit number
    f"{BASE}-BL123-L02-U201",           # 3-digit block number
    "INF-PUB-DL01-0007-BL01-L00-U001",  # public building anchor
    "INF-PRK-MH12-0420-BL02-S02-U0001",  # public parking anchor
    "INF-AIR-KA03-0001-BL01-L01-UFLR",  # air-rights anchor
    "INF-MAR-TN07-0099-BL01-L00-U010",  # market anchor
])
def test_valid_unit_id_accepts(uid: str) -> None:
    assert norms.valid_unit_id(uid)


@pytest.mark.parametrize("uid", [
    f"{BASE}-BL00-L08-U804",               # BL00 is reserved for parcel-level common space
    f"{BASE}-BL1-L08-U804",                # block needs 2-3 digits
    f"{BASE}-BL1234-L08-U804",             # ... not 4
    f"{BASE}-BL01-L8-U804",                # level needs 2 digits
    f"{BASE}-BL01-B01-U001",               # basements are S, not B
    f"{BASE}-BL01-L08-U80",                # unit needs 3-4 digits
    f"{BASE}-BL01-L08-U80412",             # ... not 5
    f"{BASE}-BL01-L08",                    # missing unit
    f"{BASE.lower()}-BL01-L08-U804",       # base ULPIN is upper case
    f"{BASE[:13]}-BL01-L08-U804",          # 13-character base
    f"IN-DL-{BASE}-BL01-L08-U804",         # no country prefix
    f"{BASE}-BL01-L08-U804-R",             # no usage suffix
    "INF-TUN-DL01-0001-BL01-L00-U001",     # tunnels are not unit anchors
    "INF-UTL-GAS-DL01-000001-BL01-L00-U001",  # utilities are not unit anchors
    "",
])
def test_valid_unit_id_rejects(uid: str) -> None:
    assert not norms.valid_unit_id(uid)


def test_infrastructure_and_common_space_patterns() -> None:
    assert norms.INF_RE.match("INF-TUN-DL01-0012") and norms.INF_RE.match("INF-FLY-MH12-0001")
    assert not norms.INF_RE.match("INF-UTL-DL01-0012")
    assert norms.UTL_RE.match("INF-UTL-GAS-DL01-003410") and not norms.UTL_RE.match("INF-UTL-GAS-DL01-0034")
    assert norms.CSR_RE.match(f"CSR-{BASE}-BL01-C004") and not norms.CSR_RE.match(f"CSR-{BASE}-BL01-U004")


# --------------------------------------------------------------------------- level_code
@pytest.mark.parametrize("floor, code", [(-3, "S03"), (-1, "S01"), (0, "L00"), (1, "L01"), (8, "L08"), (12, "L12"),
                                         (105, "L105")])
def test_level_code(floor: int, code: str) -> None:
    assert norms.level_code(floor) == code


# --------------------------------------------------------------------------- uds_ppm
def test_uds_empty_and_single() -> None:
    assert norms.uds_ppm([]) == []
    assert norms.uds_ppm([42.5]) == [1_000_000]


def test_uds_equal_weights_differ_by_at_most_one() -> None:
    shares = norms.uds_ppm([1.0, 1.0, 1.0])
    assert shares == [333_334, 333_333, 333_333]


def test_uds_property_sum_and_sign_over_random_positive_weights() -> None:
    rng = random.Random(2026)
    for _ in range(400):
        weights = [rng.uniform(0.01, 900.0) for _ in range(rng.randint(1, 80))]
        shares = norms.uds_ppm(weights)
        assert len(shares) == len(weights)
        assert sum(shares) == 1_000_000
        assert all(s >= 0 for s in shares)
        assert shares == norms.uds_ppm(list(weights))  # deterministic


def test_uds_larger_weight_never_gets_a_smaller_share() -> None:
    rng = random.Random(7)
    for _ in range(100):
        weights = [rng.uniform(1, 100) for _ in range(rng.randint(2, 30))]
        shares = norms.uds_ppm(weights)
        order = sorted(range(len(weights)), key=lambda i: weights[i])
        assert all(shares[a] <= shares[b] for a, b in itertools.pairwise(order))


def test_uds_all_zero_weights_locked_as_today() -> None:
    """Locks today's edge case: all-zero weights do NOT sum to 1,000,000 (each unit gets 1). Unit areas are always
    positive in practice; changing this is a norms decision (see the follow-ups in the final report)."""
    assert norms.uds_ppm([0.0]) == [1]
    assert norms.uds_ppm([0.0, 0.0, 0.0]) == [1, 1, 1]


# --------------------------------------------------------------------------- classify
def _b(**kw: Any) -> dict[str, Any]:
    b = {"usage": "R", "floors": 6, "area_m2": 600.0, "building_type": "apartments", "name": "Test Residency",
         "footprint_source": "osm"}
    b.update(kw)
    return b


@pytest.mark.parametrize("building, units_ground, kind", [
    (_b(footprint_source="ai:segment"), 4, "PROPOSAL"),                       # unverified AI footprint
    (_b(footprint_source="ai:segment", verified=True), 4, "STRATA"),          # verified AI footprint is normal
    (_b(), 4, "STRATA"),                                                      # multi-unit building
    (_b(tenure="single"), 4, "SINGLE_TITLE"),                                 # surveyor override
    (_b(tenure="strata", floors=1, area_m2=80), 1, "STRATA"),                 # surveyor override
    (_b(tenure="public"), 4, "INF_PUB"),                                      # surveyor override
    (_b(building_type="government"), 4, "INF_PUB"),                           # public building type
    (_b(usage="P", name="Municipal Corporation Office"), 2, "INF_PUB"),       # public name on a public use
    (_b(usage="P", name="St. Test School"), 2, "SINGLE_TITLE"),               # private institution
    (_b(building_type="temple", usage="P"), 1, "SINGLE_TITLE"),               # religious sanctuary
    (_b(usage="I", floors=2), 1, "SINGLE_TITLE"),                             # single-occupier factory
    (_b(usage="I", floors=2), 2, "STRATA"),                                   # multi-occupier industrial
    (_b(floors=2, area_m2=120), 1, "SINGLE_TITLE"),                           # plotted house
    (_b(floors=3, area_m2=250), 1, "SINGLE_TITLE"),                           # limits are inclusive
    (_b(floors=4, area_m2=120), 1, "STRATA"),                                 # too tall for 2D-sufficiency
    (_b(floors=2, area_m2=251), 1, "STRATA"),                                 # too large for 2D-sufficiency
])
def test_classify(building: dict[str, Any], units_ground: int, kind: str) -> None:
    got, reason = norms.classify(building, units_ground)
    assert got == kind
    assert isinstance(reason, str) and reason


def test_ai_proposal_wins_over_surveyor_tenure() -> None:
    assert norms.classify(_b(footprint_source="ai:x", tenure="strata"), 4)[0] == "PROPOSAL"


# --------------------------------------------------------------------------- UnitLedger
def _units(*indexes: int) -> list[dict[str, Any]]:
    return [{"index": i, "polygon": [[0, 0], [5 + i, 0], [5 + i, 4], [0, 4]]} for i in indexes]


def _mint(led: norms.UnitLedger, floor: int, indexes: list[int], whole: bool = False,
          parents: list[str] | None = None, anchor: str = BASE, bl: int = 1) -> list[dict[str, Any]]:
    return led.mint(anchor, bl, "osm:w1", "BLD-0001", floor, _units(*indexes), whole, "PROVISIONAL", "R", parents)


def test_ledger_mints_well_formed_ids_and_events() -> None:
    led = norms.UnitLedger("")
    recs = _mint(led, 2, [1, 2])
    assert [r["id"] for r in recs] == [f"{BASE}-BL01-L02-U201", f"{BASE}-BL01-L02-U202"]
    assert all(norms.valid_unit_id(r["id"]) and r["status"] == "PROVISIONAL" and r["version"] == 1 for r in recs)
    assert [e["kind"] for e in led.data["events"]] == ["MINT", "MINT"]
    assert led.active_on("osm:w1", 2) == recs


def test_ledger_retired_numbers_are_never_reused() -> None:
    led = norms.UnitLedger("")
    first = _mint(led, 3, [1])[0]
    led.retire(first, "RETIRED", "partition")
    again = _mint(led, 3, [1])[0]
    assert first["status"] == "RETIRED" and first["retire_reason"] == "partition"
    assert again["id"] == f"{BASE}-BL01-L03-U302" and again["id"] != first["id"]
    assert led.active_on("osm:w1", 3) == [again]
    assert [e["kind"] for e in led.data["events"]] == ["MINT", "RETIRE", "MINT"]


def test_ledger_records_lineage_parents() -> None:
    led = norms.UnitLedger("")
    parent = _mint(led, 1, [1])[0]
    led.retire(parent, "RETIRED", "split")
    children = _mint(led, 1, [1, 2], parents=[parent["id"]])
    assert all(c["parents"] == [parent["id"]] for c in children)
    assert led.data["events"][-1]["parents"] == [parent["id"]]
    assert led.data["events"][-1]["reason"] == "minted from partition / merger"


def test_ledger_whole_floor_uses_uflr_once() -> None:
    led = norms.UnitLedger("")
    assert _mint(led, 4, [1], whole=True)[0]["id"].endswith("-L04-UFLR")
    assert _mint(led, 4, [1], whole=True)[0]["id"].endswith("-L04-U401")


@pytest.mark.parametrize("anchor, bl", [("NOT-AN-ANCHOR", 1), (BASE, 0)])
def test_ledger_refuses_malformed_ids(anchor: str, bl: int) -> None:
    with pytest.raises(ValueError, match="reused or is malformed"):
        _mint(norms.UnitLedger(""), 1, [1], anchor=anchor, bl=bl)


def test_ledger_building_numbers_are_sequential_and_stable() -> None:
    led = norms.UnitLedger("")
    assert [led.building_no(BASE, k) for k in ("a", "b", "a", "c")] == [1, 2, 1, 3]
    assert led.building_no("INF-PUB-DL01-0001", "a") == 1  # per anchor


def test_ledger_close_retires_or_demolishes_unseen_units() -> None:
    led = norms.UnitLedger("")
    kept, gone = _mint(led, 1, [1, 2])
    led.seen.add(kept["id"])
    led.close(live_buildings={"osm:w1"})
    assert kept["status"] == "PROVISIONAL" and gone["status"] == "RETIRED"
    other = norms.UnitLedger("")
    rec = _mint(other, 1, [1])[0]
    other.close(live_buildings=set())
    assert rec["status"] == "HISTORICAL_DEMOLISHED"


def test_ledger_save_and_read_round_trip(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(cache, "CACHE_ROOT", str(tmp_path))
    led = norms.UnitLedger("area0001")
    ids = [r["id"] for r in _mint(led, 0, [1, 2])]
    led.save()
    again = norms.UnitLedger("area0001")
    assert [u["id"] for u in again.data["units"]] == ids
    assert norms.read_ledger("missing0001") == {"anchors": {}, "units": [], "events": []}


# --------------------------------------------------------------------------- integrity axioms
def _bld(i: int, fp: list[list[float]], height: float = 12.0, min_height: float = 0.0, basements: int = 0,
         parcel: str | None = None) -> dict[str, Any]:
    return {"id": f"BLD-{i:04d}", "footprint": fp, "height": height, "min_height": min_height, "base_z": 0.0,
            "basement_levels": basements, "parcel_id": parcel or f"PCL-{i:04d}"}


def _parcel(i: int, fp: list[list[float]]) -> dict[str, Any]:
    return {"id": f"PCL-{i:04d}", "footprint": fp}


SQ = [[0, 0], [10, 0], [10, 10], [0, 10]]
BIG = [[-1, -1], [11, -1], [11, 11], [-1, 11]]


def _scene(buildings: list[dict[str, Any]], parcels: list[dict[str, Any]], subsurface=(), roads=()) -> dict[str, Any]:
    return {"buildings": buildings, "parcels": parcels, "subsurface": list(subsurface), "roads": list(roads),
            "railways": []}


def _failures(report: dict[str, Any]) -> dict[str, list[str]]:
    return {k: v["failures"] for k, v in report.items()}


def test_integrity_clean_scene() -> None:
    report, fails = norms.integrity(_scene([_bld(1, SQ)], [_parcel(1, BIG)]))
    assert set(report) == {"axiom1_closed_solid", "axiom2_disjoint", "axiom5_footprint_in_parcel", "axiom3_asset_conflict"}
    assert all(not f for f in _failures(report).values())
    assert fails == {}


def test_integrity_axiom1_zero_height_solid() -> None:
    report, _ = norms.integrity(_scene([_bld(1, SQ, height=0.0)], [_parcel(1, BIG)]))
    assert report["axiom1_closed_solid"]["failures"] == ["BLD-0001"]


def test_integrity_axiom2_overlapping_volumes() -> None:
    other = [[5, 5], [15, 5], [15, 15], [5, 15]]
    report, fails = norms.integrity(_scene([_bld(1, SQ), _bld(2, other)], [_parcel(1, BIG), _parcel(2, [[4, 4], [16, 4], [16, 16], [4, 16]])]))
    assert len(report["axiom2_disjoint"]["failures"]) == 1
    assert any(m.startswith("Axiom 2") for m in fails["BLD-0001"]) and any(m.startswith("Axiom 2") for m in fails["BLD-0002"])


def test_integrity_axiom2_ignores_vertically_disjoint_envelopes() -> None:
    upper = _bld(2, SQ, height=30.0, min_height=20.0, parcel="PCL-0001")  # an air-rights band above BLD-0001
    report, _ = norms.integrity(_scene([_bld(1, SQ, height=12.0), upper], [_parcel(1, BIG)]))
    assert report["axiom2_disjoint"]["failures"] == []


def test_integrity_axiom5_footprint_outside_parcel() -> None:
    report, fails = norms.integrity(_scene([_bld(1, SQ)], [_parcel(1, [[0, 0], [5, 0], [5, 5], [0, 5]])]))
    assert report["axiom5_footprint_in_parcel"]["failures"] == ["BLD-0001"]
    assert fails["BLD-0001"] == ["Axiom 5: footprint not covered by its 2D parcel"]


def test_integrity_axiom3_basement_reaches_tunnel_envelope() -> None:
    metro = {"id": "MET-w9-0", "inf_id": "INF-TUN-DL01-0001", "kind": "metro", "path": [[-20, 5], [30, 5]],
             "depth_m": 6.0, "radius_m": 3.0, "buffer_m": 5.0}
    report, fails = norms.integrity(_scene([_bld(1, SQ, basements=2)], [_parcel(1, BIG)], subsurface=[metro]))
    assert report["axiom3_asset_conflict"]["failures"] == ["INF-TUN-DL01-0001 × BLD-0001 basement"]
    assert fails["BLD-0001"] == ["Axiom 3: basement reaches the envelope of INF-TUN-DL01-0001"]


def test_integrity_axiom3_building_rises_into_elevated_deck() -> None:
    flyover = {"id": "RD-w5-0", "inf_id": "INF-FLY-DL01-0001", "path": [[-20, 5], [30, 5]], "elevation_m": 8.0,
               "width_m": 10.0}
    report, fails = norms.integrity(_scene([_bld(1, SQ, height=20.0)], [_parcel(1, BIG)], roads=[flyover]))
    assert report["axiom3_asset_conflict"]["failures"] == ["INF-FLY-DL01-0001 × BLD-0001"]
    assert fails["BLD-0001"] == ["Axiom 3: rises into the deck envelope of INF-FLY-DL01-0001"]
