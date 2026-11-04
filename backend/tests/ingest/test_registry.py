# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Manifest dispatch (format + extension + slot) and the UNSUPPORTED fallback; no heavy libraries imported."""
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from app.ingest import (
    STATUS_PSEUDO,
    STATUS_UNSUPPORTED,
    describe_all,
    plan_for_manifest,
)
from tests.conftest import SEED_DIR, SEED_KEY

BACKEND = Path(__file__).resolve().parents[2]
HEAVY = ("laspy", "pdal", "ifcopenshell", "ezdxf", "pyproj", "georinex")


def _seed_manifest() -> list[dict[str, Any]]:
    with open(SEED_DIR / SEED_KEY / "ingest.json", encoding="utf-8") as f:
        return json.load(f)["datasets"]


def test_seed_manifest_plans() -> None:
    plans = plan_for_manifest(_seed_manifest())
    got = [(p.dataset["slot"], p.format, p.reader, p.status) for p in plans]
    assert got == [("ortho", "TIF", "none", STATUS_UNSUPPORTED), ("lidar", "LAZ", "lidar", STATUS_PSEUDO),
                   ("cadastre", "GEOJSON", "none", STATUS_UNSUPPORTED), ("sanctions", "XLSX", "none", STATUS_UNSUPPORTED),
                   ("plans", "DXF", "dxf", STATUS_PSEUDO), ("utilities", "GEOJSON", "none", STATUS_UNSUPPORTED)]
    assert all(p.will_mint_ids is False for p in plans)
    assert [p.to_dict() for p in plans] == [p.to_dict() for p in plan_for_manifest(_seed_manifest())]  # deterministic


@pytest.mark.parametrize("item, reader, fmt", [
    ({"name": "scan.laz"}, "lidar", "LAZ"),
    ({"format": "las", "name": "scan"}, "lidar", "LAS"),
    ({"slot": "plans", "name": "tower.ifc", "format": "IFC"}, "ifc", "IFC"),
    ({"slot": "utilities", "name": "network.dxf", "format": "DXF"}, "dxf", "DXF"),
    ({"name": "base.24o"}, "gnss", "RINEX"),
    ({"name": "base.rnx", "format": "RNX"}, "gnss", "RINEX"),
    ({"name": "rover.nmea", "format": "NMEA"}, "gnss", "NMEA"),
    ({"slot": "gnss", "name": "points.csv", "format": "CSV"}, "gnss", "GNSS_CSV"),
    ({"slot": "survey", "name": "gcp_control_points.csv", "format": "CSV"}, "gnss", "GNSS_CSV"),
])
def test_dispatch(item: dict, reader: str, fmt: str) -> None:
    (plan,) = plan_for_manifest([item])
    assert (plan.reader, plan.format, plan.status) == (reader, fmt, STATUS_PSEUDO)


@pytest.mark.parametrize("item, fmt, hint", [
    ({"slot": "sanctions", "name": "register.csv", "format": "CSV"}, "CSV", "reconstructed from open geodata"),
    ({"slot": "plans", "name": "tower.dwg", "format": "DWG"}, "DWG", "convert it to DXF first"),
    ({"slot": "plans", "name": "scan.pdf", "format": "PDF"}, "PDF", "digitising"),
    ({"slot": "ortho", "name": "ortho.tif", "format": "TIF"}, "TIF", "reconstructed from open geodata"),
    ({"name": "mystery"}, "UNKNOWN", "reconstructed from open geodata"),
    ({}, "UNKNOWN", "reconstructed from open geodata"),
    ({"format": None, "name": None, "size_bytes": "huge"}, "UNKNOWN", "reconstructed from open geodata"),
])
def test_unsupported(item: dict, fmt: str, hint: str) -> None:
    (plan,) = plan_for_manifest([item])
    assert (plan.reader, plan.format, plan.status, plan.steps, plan.accuracy_class) == (
        "none", fmt, STATUS_UNSUPPORTED, [], None)
    assert hint in plan.notes[0] and plan.will_mint_ids is False


def test_malformed_manifests_never_raise() -> None:
    plans = plan_for_manifest([None, 3, "x", ["nested"], {"format": 12}])  # type: ignore[list-item]
    assert [p.status for p in plans] == [STATUS_UNSUPPORTED] * 5
    assert plans[0].notes == ["Manifest item is not an object; skipped."]
    assert plan_for_manifest("not a list") == []  # type: ignore[arg-type]
    assert plan_for_manifest([]) == []


def test_describe_all_lists_every_reader() -> None:
    assert [d["reader"] for d in describe_all()] == ["lidar", "ifc", "dxf", "gnss"]
    assert json.loads(json.dumps(describe_all())) == describe_all()


@pytest.mark.slow
def test_importing_app_ingest_loads_no_heavy_library() -> None:
    code = ("import sys, app.ingest, app.ingest.registry; "
            f"print([m for m in {HEAVY!r} if m in sys.modules or any(k.startswith(m + '.') for k in sys.modules)])")
    out = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, capture_output=True, text=True, timeout=120,
                         check=False)
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "[]"


def test_ingest_sources_never_import_heavy_libraries() -> None:
    for path in (BACKEND / "app" / "ingest").glob("*.py"):
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith(("import ", "from ")):
                assert not any(h in stripped for h in HEAVY), f"{path.name}: {stripped}"
