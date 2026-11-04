# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Survey-file ingestion as pseudo-code (LiDAR LAS/LAZ, IFC, DXF, GNSS).

Shows how real uploads would be read and processed, as ordered steps returned as data. Nothing here parses survey
data or mints identifiers, and no geospatial library is imported (see docs/INGESTION_PSEUDOCODE.md).
"""
from app.ingest.base import (
    HEAD_BYTES,
    PSEUDO_NOTE,
    STATUS_PSEUDO,
    STATUS_UNSUPPORTED,
    IngestPlan,
    ProcessingStep,
    SurveyReader,
)
from app.ingest.registry import READERS, describe_all, detect_reader, plan_for_manifest

__all__ = ["HEAD_BYTES", "PSEUDO_NOTE", "READERS", "STATUS_PSEUDO", "STATUS_UNSUPPORTED", "IngestPlan",
           "ProcessingStep", "SurveyReader", "describe_all", "detect_reader", "plan_for_manifest"]
