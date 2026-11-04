# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""LiDAR point clouds (ASPRS LAS / LAZ): pseudo-code reader."""
from __future__ import annotations

from typing import Any

from app.ingest.base import (
    IngestPlan,
    ProcessingStep,
    PseudoReader,
    clean_size,
    extension,
    size_note,
)

LAS_MAGIC = b"LASF"
PLINTH_M = 0.6  # plinth above ground before the first storey (as in the existing typology model)
DISCREPANCY_M = 1.5  # |LiDAR height - current height| above this raises a finding
POINT_RECORD_BYTES = 34  # typical LAS 1.4 point format 6 record
LAZ_RATIO = 7  # typical LAZ compression ratio, for the size estimate only


class LidarReader(PseudoReader):
    """LiDAR (LAS / LAZ) -> measured building heights and floor counts. Pseudo-code, not executed.

    # In production: laspy (LAS) with lazrs (LAZ), or PDAL; pyproj for the CRS. Not imported in this prototype.
    def read_lidar(path, scene):
        hdr = las_header(path)                         # version, point_format, scale, offset, point_count
        crs = hdr.crs_from_vlr()                       # OGC WKT VLR (LAS 1.4) or GeoTIFF keys (LAS 1.2)
        if crs is None:
            refuse("CRS unknown: a point cloud without a coordinate system cannot be placed")
        frame = scene.local_frame                      # azimuthal-equidistant metres around the survey polygon
        ground, building = SpatialIndex(), SpatialIndex()
        for chunk in stream_points(path, chunk_size=1_000_000):    # never load the whole cloud
            chunk = chunk[(chunk.classification == 2) | (chunk.classification == 6)]  # ASPRS ground, building
            xy = frame.to_local(reproject(chunk.xyz, crs, "EPSG:4326"))
            ground.add(xy[chunk.classification == 2])
            building.add(xy[chunk.classification == 6])
        for b in scene.buildings:                      # footprints from the cadastre / OSM / AI, already in metres
            ring = b.footprint.buffer(3.0) - b.footprint
            ground_z = median(ground.z_within(ring))
            roof_z = percentile(building.z_within(b.footprint), 95)
            height = roof_z - ground_z
            floors = round((height - PLINTH_M) / b.floor_height)
            density = building.count_within(b.footprint) / b.footprint.area
            confidence = score(density, spread=building.iqr_within(b.footprint))
            b.evidence["lidar"] = Evidence(height, floors, density, confidence, accuracy_class="A_SURVEY")
            if abs(height - b.height) > DISCREPANCY_M:
                findings.add("HEIGHT_DISCREPANCY", b.id, observed=height, recorded=b.height)
        # Evidence only: no identifier is minted here. The integrity axioms and surveyor verification still gate
        # minting in the norms pipeline.
    """

    name = "lidar"
    formats = ("LAS", "LAZ")
    outputs = ("Ground and roof elevation per footprint", "Measured height and floor count per building",
               "Point density and confidence per building", "Height-discrepancy findings (> 1.5 m)")
    accuracy_class = "A_SURVEY"
    feeds = "Building heights and floor counts (evidence for the surveyor; never IDs)"

    def sniff(self, head: bytes, filename: str) -> bool:
        return head[:4] == LAS_MAGIC

    def detect_format(self, head: bytes, filename: str) -> str:
        return "LAZ" if extension(filename) == "LAZ" else "LAS"

    def plan(self, meta: dict[str, Any]) -> IngestPlan:
        fmt = "LAZ" if str(meta.get("format") or extension(meta.get("name") or "")).upper() == "LAZ" else "LAS"
        size = clean_size(meta.get("size_bytes"))
        steps = [
            ProcessingStep("read_header", f"{fmt} public header block and VLRs",
                           "version, point format, scale/offset, point count, CRS",
                           "Read the header and the CRS from the WKT or GeoTIFF VLR; refuse the file if the CRS is "
                           "unknown."),
            ProcessingStep("stream_points", "point records", "chunks of 1,000,000 points",
                           "Stream the cloud in chunks (LAZ decompressed on the fly); never load it whole."),
            ProcessingStep("filter_classes", "point chunks", "ground and building points",
                           "Keep ASPRS class 2 (ground) and class 6 (building); drop everything else."),
            ProcessingStep("reproject", "points in the file CRS", "points in the scene LocalFrame (metres)",
                           "Transform to WGS 84, then to the scene's local azimuthal-equidistant frame."),
            ProcessingStep("footprint_elevations", "building footprints + classified points", "ground_z, roof_z",
                           "ground_z = median of class-2 points in a 3 m ring around the footprint; roof_z = 95th "
                           "percentile of class-6 points inside the footprint."),
            ProcessingStep("height_and_floors", "ground_z, roof_z, floor height", "height, floors",
                           f"height = roof_z - ground_z; floors = round((height - {PLINTH_M} m plinth) / "
                           "floor_height)."),
            ProcessingStep("confidence", "point density and spread per footprint", "confidence, accuracy class",
                           "Points per m² and roof-height spread give a confidence score; accuracy class A_SURVEY."),
            ProcessingStep("discrepancy_findings", "measured vs current height", "HEIGHT_DISCREPANCY findings",
                           f"Raise a finding where |measured - current| > {DISCREPANCY_M} m."),
            ProcessingStep("update_evidence", "measurements", "height evidence on each building",
                           "Update evidence only. No identifier is minted: the integrity axioms and surveyor "
                           "verification still gate minting."),
        ]
        chunk_bytes = 1_000_000 * POINT_RECORD_BYTES // (LAZ_RATIO if fmt == "LAZ" else 1)
        return self._plan(meta, fmt, steps, [size_note(size, chunk_bytes, "chunks of 1M points")])
