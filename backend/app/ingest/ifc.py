# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""BIM models (IFC2x3 / IFC4, STEP physical file): pseudo-code reader."""
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

STEP_MAGIC = b"ISO-10303-21"
SCHEMA_RE = re.compile(rb"FILE_SCHEMA\s*\(\s*\(\s*'(IFC[0-9A-Z_]*)'", re.IGNORECASE)
MATCH_IOU = 0.7


class IfcReader(PseudoReader):
    """IFC (BIM) -> storeys, unit polygons and common spaces. Pseudo-code, not executed.

    # In production: ifcopenshell (geometry + quantity sets). Not imported in this prototype.
    def read_ifc(path, scene):
        model = open_ifc(path)                         # IFC2x3 or IFC4
        geo = model.by_type("IfcMapConversion") or site_reference(model.by_type("IfcSite"))
        if geo is None:
            refuse("No georeference (IfcMapConversion / IfcSite RefLatitude, RefLongitude)")
        to_local = compose(geo.to_wgs84, scene.local_frame.to_local)
        for storey in model.by_type("IfcBuildingStorey"):
            level = Level(elevation=storey.Elevation)  # metres, after the project's length unit
            for space in storey.spaces():              # IfcRelAggregates / IfcRelContainedInSpatialStructure
                polygon = to_local(footprint_of(space.representation))
                net_area = quantity(space, "Qto_SpaceBaseQuantities", "NetFloorArea")
                level.spaces.append(Space(space.LongName, space.ObjectType, polygon, net_area))
        building = best_match(scene.buildings, model_footprint, min_iou=MATCH_IOU)
        if building is None:
            refuse("Model footprint does not match any surveyed building (IoU < 0.7)")
        for level in levels:
            units = [s for s in level.spaces if s.use in ("DWELLING", "SHOP", "OFFICE")]
            commons = [s for s in level.spaces if s.use in ("STAIR", "LIFT", "CORRIDOR", "LOBBY")]
            building.plan[level] = UnitPlan(units)    # replaces the synthetic floorplan.plan_floor split
            common_space_registry.add(building, commons)   # CSR entries: never a 3D ULPIN
            for u in units:
                u.carpet_m2 = rera_carpet_area(u.net_area)  # excludes external walls, services, balconies
        building.plan_status = "PLAN_DERIVED_AWAITING_SURVEYOR_VERIFICATION"   # no identifier is minted here
    """

    name = "ifc"
    formats = ("IFC",)
    outputs = ("Storey elevations", "Unit polygons per storey (replace the synthetic floor-plan split)",
               "Common Space Registry entries (stairs, lifts, corridors)", "RERA carpet area per unit")
    accuracy_class = "B_PLAN"
    feeds = "Floor plans and unit polygons, marked plan-derived until a surveyor verifies them"

    def sniff(self, head: bytes, filename: str) -> bool:
        # A STEP physical file; IFC rather than another STEP schema (CAD parts use the same container).
        body = head.lstrip(b"\xef\xbb\xbf \t\r\n")
        return body.startswith(STEP_MAGIC) and (extension(filename) == "IFC" or SCHEMA_RE.search(head) is not None)

    def detect_format(self, head: bytes, filename: str) -> str:
        m = SCHEMA_RE.search(head)
        return m.group(1).decode("ascii").upper() if m else "IFC"

    def plan(self, meta: dict[str, Any]) -> IngestPlan:
        # Steps mirror the pseudo-code in the class docstring, in order.
        fmt = str(meta.get("format") or "IFC").upper()
        steps = [
            ProcessingStep("open_and_georeference", "IFC2x3 / IFC4 model", "model + transform to the LocalFrame",
                           "Read IfcMapConversion (IFC4) or the IfcSite reference point (IFC2x3); refuse the model "
                           "if it has no georeference."),
            ProcessingStep("storeys", "IfcBuildingStorey", "storey elevations",
                           "One level per IfcBuildingStorey, from its Elevation in project length units."),
            ProcessingStep("spaces", "IfcSpace per storey", "space boundary polygons + net floor area",
                           "Boundary from the space representation; NetFloorArea from Qto_SpaceBaseQuantities."),
            ProcessingStep("match_building", "model footprint + surveyed footprints", "matched building",
                           f"Match by footprint IoU >= {MATCH_IOU}; refuse if nothing matches."),
            ProcessingStep("units_and_common_spaces", "spaces by use", "unit polygons + CSR entries",
                           "Dwelling / shop / office spaces become unit polygons that replace the synthetic "
                           "floorplan.plan_floor split; stairs, lifts and corridors go to the Common Space Registry."),
            ProcessingStep("carpet_area", "net floor area", "carpet area per unit (RERA)",
                           "Carpet area per RERA from the net area (excluding external walls, services and "
                           "balconies)."),
            ProcessingStep("mark_pending", "derived units", "plan status",
                           "Mark as plan-derived, awaiting surveyor verification. No identifier is minted."),
        ]
        return self._plan(meta, fmt, steps, [size_note(clean_size(meta.get("size_bytes")), 50 * 1024 * 1024,
                                                       "batches of 50 MB")])
