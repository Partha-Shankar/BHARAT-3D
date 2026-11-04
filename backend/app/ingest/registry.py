# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Reader registry: recognise a survey file and plan a whole survey package.

``detect_reader`` works on real bytes (first few KB + file name). ``plan_for_manifest`` works on the manifest the web
app already sends with ``POST /api/realgen/generate`` (``slot, title, name, size_bytes, format, checks, sample``),
which carries no bytes, so it dispatches on the declared format, the file extension and the slot. Anything without a
reader gets an ``UNSUPPORTED`` plan; nothing here raises on bad input.
"""
from __future__ import annotations

import re
from typing import Any

from app.ingest.base import (
    STATUS_UNSUPPORTED,
    IngestPlan,
    SurveyReader,
    dataset_ref,
    extension,
)
from app.ingest.dxf import DxfReader
from app.ingest.gnss import GnssReader
from app.ingest.ifc import IfcReader
from app.ingest.lidar import LidarReader

LIDAR, IFC, DXF, GNSS = LidarReader(), IfcReader(), DxfReader(), GnssReader()
READERS: tuple[SurveyReader, ...] = (LIDAR, IFC, DXF, GNSS)
GNSS_HINT = re.compile(r"gnss|gcp|control|rinex|nmea|rtk", re.IGNORECASE)
# What happens today to a dataset without a survey reader (the UNSUPPORTED plan's note).
TODAY = ("the file is listed in the survey record and this layer is reconstructed from open geodata "
         "(OpenStreetMap, satellite imagery) and deterministic synthesis")
ADVICE = {"DWG": "convert it to DXF first (DWG is a closed format)", "PDF": "scanned plans need digitising to DXF first"}


def describe_all() -> list[dict[str, Any]]:
    """``describe()`` of every reader (GET /api/ingest/formats)."""
    return [r.describe() for r in READERS]


def detect_reader(head: bytes, filename: str) -> SurveyReader | None:
    """The reader whose sniffer accepts these first bytes (and file name), or None."""
    if not isinstance(head, (bytes, bytearray)):
        return None
    head, filename = bytes(head), str(filename or "")
    return next((r for r in READERS if r.sniff(head, filename)), None)


def unsupported_plan(meta: dict[str, Any], reason: str = "") -> IngestPlan:
    """A plan that says no reader exists for this dataset (never an exception)."""
    fmt = str(meta.get("format") or extension(str(meta.get("name") or "")) or "UNKNOWN").upper()
    note = reason or f"No survey reader for {fmt} in this prototype; {ADVICE.get(fmt, TODAY)}."
    return IngestPlan(format=fmt, reader="none", steps=[], outputs=[], accuracy_class=None,
                      status=STATUS_UNSUPPORTED, notes=[note], dataset=dataset_ref(meta))


def reader_for_manifest_item(meta: dict[str, Any]) -> SurveyReader | None:
    """Dispatch a manifest item (no bytes) on declared format, extension and slot."""
    name = str(meta.get("name") or "")
    labels = {str(meta.get("format") or "").upper(), extension(name)} - {""}
    if labels & {"LAS", "LAZ"}:
        return LIDAR
    if "IFC" in labels:
        return IFC
    if "DXF" in labels:
        return DXF
    if any(GnssReader.format_for(label, name) for label in labels):
        return GNSS
    if "CSV" in labels and (GNSS_HINT.search(str(meta.get("slot") or "")) or GNSS_HINT.search(name)):
        return GNSS  # a control-point CSV; other CSVs (e.g. the sanction register) are not survey readings
    return None


def plan_for_manifest(datasets: list[dict[str, Any]]) -> list[IngestPlan]:
    """One plan per manifest item, in order. Malformed items get an UNSUPPORTED plan."""
    plans: list[IngestPlan] = []
    for item in datasets if isinstance(datasets, list) else []:
        if not isinstance(item, dict):
            plans.append(unsupported_plan({}, "Manifest item is not an object; skipped."))
            continue
        reader = reader_for_manifest_item(item)
        plans.append(reader.plan(item) if reader else unsupported_plan(item))
    return plans
