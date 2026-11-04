# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""GNSS observations and control points (RINEX, NMEA, control-point CSV): pseudo-code reader."""
from __future__ import annotations

import re
from typing import Any

from app.ingest.base import (
    IngestPlan,
    ProcessingStep,
    PseudoReader,
    clean_size,
    extension,
    size_note,
)

RINEX_LABEL = b"RINEX VERSION / TYPE"
NMEA_GGA = re.compile(rb"^\$(GP|GN)GGA,", re.MULTILINE)
_COLS = {"lat": {"lat", "latitude"}, "lon": {"lon", "lng", "long", "longitude"},
         "h": {"h", "height", "ellh", "ellipsoidal_height", "alt", "altitude", "elev", "elevation"}}
RINEX_EXT = re.compile(r"^(RNX|OBS|CRX|\d{2}[OD])$")
NMEA_EXT = {"NMEA", "NMA", "GGA"}
MAX_HDOP = 2.0
MAX_SIGMA_M = 0.10
PARCEL_RESIDUAL_M = 0.3


def _csv_header_kind(head: bytes) -> bool:
    """True if the first line is a CSV header with latitude, longitude and height columns."""
    first = head.split(b"\n", 1)[0].decode("utf-8", "ignore").lstrip("﻿").strip().lower()
    cols = {c.strip().strip('"') for c in re.split(r"[,;\t]", first)}
    return all(cols & names for names in _COLS.values())


class GnssReader(PseudoReader):
    """GNSS (RINEX observations, NMEA streams, control-point CSV) -> ground control in the LocalFrame.
    Pseudo-code, not executed.

    # In production: georinex for RINEX, an RTKLIB / CORS post-processing service, pyproj. Not imported here.
    def read_gnss(path, scene):
        if is_rinex(path):
            job = plan_ppk(path, base=nearest_cors(scene.origin))   # PPK against CORS: planned, not run
            points = job.solution()                     # after the job completes
        elif is_nmea(path):
            points = []
            for gga in nmea_sentences(path, "GGA"):    # $GPGGA / $GNGGA
                fix = Fix(gga.lat, gga.lon, gga.alt + gga.geoid_sep, quality=gga.fix_quality,
                          hdop=gga.hdop, satellites=gga.num_sats)  # quality 4 = RTK fixed, 5 = RTK float
                points.append(fix)
        else:                                          # control-point CSV
            points = [ControlPoint(r.id, r.lat, r.lon, r.h, r.sigma) for r in csv_rows(path)]
        datum = points.datum                           # WGS 84 or an ITRF realisation, with epoch
        if datum not in ("WGS84", "ITRF2014", "ITRF2020"):
            refuse(f"Unsupported datum {datum}")
        cadastral = [p for p in points if (p.hdop or 0) <= MAX_HDOP and (p.sigma or 0) <= MAX_SIGMA_M]
        rejected = set(points) - set(cadastral)        # reported, not used for cadastral work
        local = [scene.local_frame.to_local(p) for p in cadastral]
        georeference_dxf_and_ifc(control_points=local)  # >= 2 points; similarity transform with RMS check
        for corner in scene.parcel_corners_near(local):
            residual = distance(corner, nearest(local, corner))
            if residual > PARCEL_RESIDUAL_M:
                findings.add("PARCEL_CORNER_RESIDUAL", corner.parcel_id, residual=residual)
    """

    name = "gnss"
    formats = ("RINEX", "NMEA", "GNSS_CSV")
    outputs = ("Ground control points in the LocalFrame with precision", "Rejected points (HDOP > 2 or σ > 0.10 m)",
               "Residuals against parcel corners (findings above 0.3 m)", "PPK / CORS job plan for RINEX")
    accuracy_class = "A_SURVEY"
    feeds = "Ground control for DXF / IFC georeferencing and parcel-corner checks"

    def sniff(self, head: bytes, filename: str) -> bool:
        return RINEX_LABEL in head[:4096] or NMEA_GGA.search(head) is not None or _csv_header_kind(head)

    def detect_format(self, head: bytes, filename: str) -> str:
        if RINEX_LABEL in head:
            return "RINEX"
        if NMEA_GGA.search(head):
            return "NMEA"
        return "GNSS_CSV"

    @staticmethod
    def format_for(fmt: str, name: str) -> str | None:
        """Manifest dispatch (no bytes available): the GNSS kind for a format / file name, or None."""
        for label in (str(fmt or "").upper(), extension(name or "")):
            if label == "RINEX" or RINEX_EXT.match(label):
                return "RINEX"
            if label in NMEA_EXT:
                return "NMEA"
        return None

    def plan(self, meta: dict[str, Any]) -> IngestPlan:
        # Steps mirror the pseudo-code in the class docstring, in order; the first step depends on the input kind.
        fmt = str(meta.get("format") or "").upper()
        kind = fmt if fmt in self.formats else (self.format_for(fmt, meta.get("name") or "") or "GNSS_CSV")
        first = {
            "RINEX": ProcessingStep("plan_ppk_job", "RINEX observation file", "PPK / CORS job definition",
                                    "Plan a post-processed kinematic solution against the nearest CORS base; the job "
                                    "is planned, not run, in this prototype."),
            "NMEA": ProcessingStep("parse_gga", "$GPGGA / $GNGGA sentences", "fixes with quality, HDOP, satellites",
                                   "Read fix quality (4 = RTK fixed, 5 = RTK float), HDOP and satellites in use."),
            "GNSS_CSV": ProcessingStep("read_control_points", "CSV rows", "id, lat, lon, h, σ per point",
                                       "Columns id, lat, lon, h and σ (one-sigma precision in metres)."),
        }[kind]
        steps = [
            first,
            ProcessingStep("validate_datum", "points + declared datum", "accepted datum",
                           "Accept WGS 84 or an ITRF realisation (with epoch); refuse anything else."),
            ProcessingStep("precision_filter", "points", "cadastral-grade points + rejected list",
                           f"Reject points with HDOP > {MAX_HDOP} or σ > {MAX_SIGMA_M:.2f} m for cadastral use."),
            ProcessingStep("to_local_frame", "accepted points (WGS 84)", "points in the scene LocalFrame",
                           "Transform to the scene's local metric frame."),
            ProcessingStep("ground_control", "local points", "control for DXF / IFC georeferencing",
                           "Use as ground control (at least two) for the DXF / IFC similarity transforms."),
            ProcessingStep("parcel_residuals", "local points + parcel corners", "residual report + findings",
                           f"Residual to the nearest parcel corner; report a finding above {PARCEL_RESIDUAL_M} m."),
        ]
        return self._plan(meta, kind, steps, [size_note(clean_size(meta.get("size_bytes")), 1024 * 1024,
                                                        "blocks of 1 MB")])
