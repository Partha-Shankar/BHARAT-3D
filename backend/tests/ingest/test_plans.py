# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Plans are deterministic, ordered, never mint IDs, and say they were not executed."""
import json
import math
from typing import Any

import pytest

from app.ingest import PSEUDO_NOTE, STATUS_PSEUDO, IngestPlan, ProcessingStep
from app.ingest.base import clean_size, size_note
from app.ingest.dxf import DxfReader
from app.ingest.gnss import GnssReader
from app.ingest.ifc import IfcReader
from app.ingest.lidar import LidarReader

STEPS = {
    "lidar": ["read_header", "stream_points", "filter_classes", "reproject", "footprint_elevations",
              "height_and_floors", "confidence", "discrepancy_findings", "update_evidence"],
    "ifc": ["open_and_georeference", "storeys", "spaces", "match_building", "units_and_common_spaces", "carpet_area",
            "mark_pending"],
    "dxf": ["units_and_layers", "polygons_and_labels", "floors", "georeference", "snap_to_footprint", "carpet_area",
            "output_for_verification"],
    "gnss": ["read_control_points", "validate_datum", "precision_filter", "to_local_frame", "ground_control",
             "parcel_residuals"],
}
CASES = [(LidarReader(), {"slot": "lidar", "name": "block.laz", "format": "LAZ", "size_bytes": 290_914_379}, "A_SURVEY"),
         (IfcReader(), {"slot": "plans", "name": "tower.ifc", "format": "IFC", "size_bytes": 41_000_000}, "B_PLAN"),
         (DxfReader(), {"slot": "plans", "name": "floors.dxf", "format": "DXF", "size_bytes": 4_000_000}, "B_PLAN"),
         (GnssReader(), {"slot": "gnss", "name": "gcp.csv", "format": "CSV", "size_bytes": 2048}, "A_SURVEY")]
IDS = [c[0].name for c in CASES]


@pytest.mark.parametrize("reader, meta, accuracy", CASES, ids=IDS)
def test_plan_is_ordered_unexecuted_and_never_mints(reader, meta: dict, accuracy: str) -> None:
    plan = reader.plan(meta)
    assert [s.name for s in plan.steps] == STEPS[reader.name]
    assert all(isinstance(s, ProcessingStep) and s.input and s.output and s.detail for s in plan.steps)
    assert plan.reader == reader.name and plan.status == STATUS_PSEUDO and plan.will_mint_ids is False
    assert plan.accuracy_class == accuracy and plan.outputs == list(reader.outputs)
    assert plan.notes[0] == PSEUDO_NOTE
    assert plan.dataset == {"slot": meta["slot"], "title": None, "name": meta["name"], "size_bytes": meta["size_bytes"]}


@pytest.mark.parametrize("reader, meta, accuracy", CASES, ids=IDS)
def test_plan_is_deterministic_and_json_ready(reader, meta: dict, accuracy: str) -> None:
    a, b = reader.plan(dict(meta)).to_dict(), reader.plan(dict(meta)).to_dict()
    assert a == b
    assert json.loads(json.dumps(a)) == a


def _details(plan: IngestPlan) -> str:
    return " ".join(s.detail for s in plan.steps)


def test_lidar_plan_carries_the_algorithm() -> None:
    text = _details(LidarReader().plan({"format": "LAS"}))
    for phrase in ("refuse the file if the CRS is unknown", "class 2 (ground)", "class 6 (building)", "3 m ring",
                   "95th", "round((height - 0.6 m plinth) / floor_height)", "A_SURVEY", "> 1.5 m",
                   "No identifier is minted"):
        assert phrase in text, phrase


def test_ifc_plan_carries_the_algorithm() -> None:
    text = _details(IfcReader().plan({}))
    for phrase in ("IfcMapConversion", "IfcBuildingStorey", "NetFloorArea", "IoU >= 0.7", "floorplan.plan_floor",
                   "Common Space Registry", "RERA", "awaiting surveyor verification"):
        assert phrase in text, phrase


def test_dxf_plan_carries_the_algorithm() -> None:
    text = _details(DxfReader().plan({}))
    for phrase in ("$INSUNITS", "WALL, ROOM, UNIT, TEXT", "LWPOLYLINE", "TEXT or MTEXT", "One file or one layout",
                   "RMS residual is >= 0.2 m", "footprint", "Carpet area", "verification"):
        assert phrase in text, phrase


@pytest.mark.parametrize("meta, first", [({"format": "RINEX"}, "plan_ppk_job"), ({"name": "base.24o"}, "plan_ppk_job"),
                                         ({"format": "NMEA"}, "parse_gga"), ({"name": "rover.nma"}, "parse_gga"),
                                         ({"format": "CSV"}, "read_control_points"), ({}, "read_control_points")])
def test_gnss_first_step_depends_on_the_input(meta: dict, first: str) -> None:
    plan = GnssReader().plan(meta)
    assert plan.steps[0].name == first and [s.name for s in plan.steps[1:]] == STEPS["gnss"][1:]
    text = _details(plan)
    for phrase in ("WGS 84", "ITRF", "HDOP > 2.0", "σ > 0.10 m", "at least two", "above 0.3 m"):
        assert phrase in text, phrase


def test_gnss_nmea_step_reads_fix_quality() -> None:
    assert "4 = RTK fixed" in GnssReader().plan({"format": "NMEA"}).steps[0].detail
    assert "planned, not run" in GnssReader().plan({"format": "RINEX"}).steps[0].detail


def test_lidar_format_from_meta() -> None:
    r = LidarReader()
    assert r.plan({"format": "laz"}).format == "LAZ" and r.plan({"name": "x.LAZ"}).format == "LAZ"
    assert r.plan({"format": "LAS"}).format == "LAS" and r.plan({}).format == "LAS"
    assert r.plan({"format": "LAZ", "size_bytes": 33_999_994}).notes[-1].endswith("about 7 chunks of 1M points.")
    assert r.plan({"format": "LAS", "size_bytes": 34_000_000}).notes[-1].endswith("about 1 chunks of 1M points.")


def test_will_mint_ids_cannot_be_true() -> None:
    with pytest.raises(ValueError, match="never mint"):
        IngestPlan(format="LAS", reader="lidar", steps=[], outputs=[], accuracy_class=None, will_mint_ids=True)


@pytest.mark.parametrize("value, expected", [(0, 0), (5, 5), (10 ** 18, 10 ** 18), (12.9, 12), (-1, None), (-0.5, None),
                                             (math.nan, None), (math.inf, None), (True, None), ("123", None),
                                             (None, None), ([1], None)])
def test_clean_size(value: Any, expected: Any) -> None:
    assert clean_size(value) == expected


@pytest.mark.parametrize("size", [10 ** 18, 10 ** 30, 0, None, -5, "big", math.inf])
@pytest.mark.parametrize("reader, meta, accuracy", CASES, ids=IDS)
def test_plans_survive_any_declared_size(reader, meta: dict, accuracy: str, size: Any) -> None:
    plan = reader.plan({**meta, "size_bytes": size})
    assert plan.steps and plan.will_mint_ids is False
    assert plan.notes[-1].startswith("Declared size")


def test_size_note() -> None:
    assert size_note(None, 10, "blocks") == "Declared size unknown; the reader would stream the file without loading it whole."
    assert size_note(0, 10, "blocks") == "Declared size 0 bytes: streamed as about 1 blocks."
    assert size_note(25, 10, "blocks") == "Declared size 25 bytes: streamed as about 3 blocks."
    assert size_note(25, 0, "blocks") == "Declared size 25 bytes: streamed as about 25 blocks."


@pytest.mark.parametrize("reader", [c[0] for c in CASES], ids=IDS)
def test_describe(reader) -> None:
    d = reader.describe()
    assert d["reader"] == reader.name and d["formats"] == list(reader.formats) and d["will_mint_ids"] is False
    assert d["status"] == STATUS_PSEUDO and d["accuracy"] and d["feeds"]
    assert "def read_" in d["pseudocode"] and "Not imported" in d["pseudocode"]
    json.dumps(d)
