# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""CAD floor plans (AutoCAD DXF, ASCII or binary): pseudo-code reader."""
from __future__ import annotations

import re
from typing import Any

from app.ingest.base import (
    IngestPlan,
    ProcessingStep,
    PseudoReader,
    clean_size,
    size_note,
)

BINARY_DXF = b"AutoCAD Binary DXF\r\n\x1a\x00"
# Group code 0 followed by SECTION, near the start (optionally after 999 comment groups).
ASCII_DXF = re.compile(rb"\A(?:\s*999\s*\r?\n[^\r\n]*\r?\n)*\s*0\s*\r?\n\s*SECTION\s*(\r?\n|\Z)")
GEOREF_RMS_M = 0.2
LAYERS = ("WALL", "ROOM", "UNIT", "TEXT")


class DxfReader(PseudoReader):
    """DXF floor plans -> unit polygons with unit numbers, georeferenced by surveyor control points.
    Pseudo-code, not executed.

    # In production: ezdxf. Not imported in this prototype.
    def read_dxf(paths, building, control_points):
        for path in paths:                             # one file (or one layout) per floor
            doc = open_dxf(path)
            scale = INSUNITS_TO_METRES[doc.header["$INSUNITS"]]   # mm, cm, m, inch, foot ...
            msp = doc.modelspace()
            rooms = [poly(e) * scale for e in msp.query("LWPOLYLINE[layer=='ROOM' | layer=='UNIT']") if e.closed]
            walls = [poly(e) * scale for e in msp.query("LWPOLYLINE[layer=='WALL']")]
            labels = [(e.text, e.insert * scale) for e in msp.query("TEXT MTEXT")]
            for room in rooms:
                room.unit_no = next((t for t, p in labels if room.contains(p)), None)   # "804", "G-02" ...
            floor = floor_of(path, doc.layouts)        # from the file name, the layout name or a title block
            if len(control_points) < 2:
                refuse("At least two surveyor control points are needed to georeference a CAD plan")
            t = similarity_transform(cad=[c.cad_xy for c in control_points], world=[c.local_xy for c in control_points])
            if t.rms >= GEOREF_RMS_M:
                refuse(f"Georeference residual {t.rms:.2f} m exceeds 0.2 m")
            units = [snap_to(building.footprint, t.apply(r)) for r in rooms]
            for u in units:
                u.carpet_m2 = rera_carpet_area(u)
            building.pending_plans[floor] = units      # unit polygons for surveyor verification; no ID minted
    """

    name = "dxf"
    formats = ("DXF",)
    outputs = ("Unit polygons per floor with unit numbers", "Wall lines", "Carpet area per unit",
               "Georeference residual (RMS) report")
    accuracy_class = "B_PLAN"
    feeds = "Floor plans and unit polygons, pending surveyor verification"

    def sniff(self, head: bytes, filename: str) -> bool:
        return head.startswith(BINARY_DXF) or ASCII_DXF.match(head[:1024]) is not None

    def plan(self, meta: dict[str, Any]) -> IngestPlan:
        # Steps mirror the pseudo-code in the class docstring, in order.
        steps = [
            ProcessingStep("units_and_layers", "DXF header + layer table", "drawing unit, layers",
                           f"Read $INSUNITS for the drawing unit; read the layers ({', '.join(LAYERS)})."),
            ProcessingStep("polygons_and_labels", "closed LWPOLYLINEs, TEXT/MTEXT", "room/unit polygons + numbers",
                           "Closed LWPOLYLINEs become polygons; a TEXT or MTEXT inside a polygon is its unit number."),
            ProcessingStep("floors", "files / layouts", "one plan per floor",
                           "One file or one layout per floor, named by floor."),
            ProcessingStep("georeference", ">= 2 surveyor control points (GNSS)", "similarity transform",
                           f"Fit scale, rotation and translation; refuse if the RMS residual is >= {GEOREF_RMS_M} m."),
            ProcessingStep("snap_to_footprint", "transformed polygons + surveyed footprint", "snapped polygons",
                           "Snap outer edges to the building footprint within tolerance."),
            ProcessingStep("carpet_area", "unit polygons", "carpet area per unit",
                           "Carpet area per RERA from the snapped polygon less wall thickness."),
            ProcessingStep("output_for_verification", "unit polygons", "pending floor plans",
                           "Unit polygons go to surveyor verification. No identifier is minted."),
        ]
        return self._plan(meta, "DXF", steps, [size_note(clean_size(meta.get("size_bytes")), 10 * 1024 * 1024,
                                                         "batches of 10 MB")])
