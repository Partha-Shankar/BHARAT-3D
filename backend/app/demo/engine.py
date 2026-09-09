import asyncio
import json
import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Tuple, Dict, Any, List, Optional
from app.demo.area_selector import DemoAreaSelector

class ProcessingEngine(ABC):
    @abstractmethod
    async def simulate_processing(self, job_id: int, area_id: str) -> AsyncGenerator[Tuple[str, int, str], None]:
        pass

class DemoProcessingEngine(ProcessingEngine):
    STAGES = [
        ("Upload Validation", 3, "Validating file integrity & MIME headers"),
        ("File Integrity Verification", 2, "Computing SHA-256 geodetic digests"),
        ("Coordinate Reference Detection", 3, "Parsing CRS tie-points & CORS baseline"),
        ("CRS Normalization", 3, "Aligning EPSG:4326 to Metric UTM 43N"),
        ("GIS Parcel Alignment", 3, "Conforming 2D cadastral boundaries & ULPIN keys"),
        ("LiDAR Point Cloud Analysis", 5, "Filtering ground vs non-ground points (nDSM)"),
        ("Building Extraction", 4, "Segmenting 3D building envelopes & rooflines"),
        ("Building Height Estimation", 3, "Inferring 95th percentile ridge elevations"),
        ("Floor Segmentation", 4, "Stratifying vertical slabs at 3.25m intervals"),
        ("Vertical Unit Generation", 4, "Allocating 3D volumetric polyhedral spaces"),
        ("Infrastructure Extraction", 3, "Modeling flyovers, subterranean tunnels & utilities"),
        ("Topology Validation", 3, "Verifying 2-manifold closed watertight meshes"),
        ("Bylaw Analysis", 2, "Evaluating setbacks, max height & FAR compliance"),
        ("Ownership Linking", 1, "Binding revenue title deeds to 3D units"),
        ("Tax Linking", 1, "Associating municipal property tax rolls"),
        ("3D Scene Preparation", 1, "Optimizing 3D MapLibre/Three.js spatial assets")
    ]

    async def simulate_processing(self, job_id: int, area_id: str = "area_01") -> AsyncGenerator[Tuple[str, int, str], None]:
        total_time_seconds = 45.0
        elapsed = 0.0
        cumulative_pct = 0

        for idx, (stage_name, duration_sec, desc) in enumerate(self.STAGES, 1):
            progress_pct = int((idx / len(self.STAGES)) * 100)
            if idx == len(self.STAGES):
                progress_pct = 100
            
            # Non-blocking async sleep slice
            step_sleep = duration_sec
            await asyncio.sleep(min(step_sleep, 3.0)) # scaled for smooth responsive telemetry
            yield (stage_name, progress_pct, desc)

class Demo3DRegistryEngine:
    @staticmethod
    def generate_bulk_3d_ids(area_id: str) -> Dict[str, Any]:
        metrics = DemoAreaSelector.get_area_metrics(area_id)
        bld_count = metrics.get("buildings_detected", 18)
        flr_count = metrics.get("floors_inferred", 112)
        unit_count = metrics.get("vertical_units", 188)
        infra_count = metrics.get("infrastructure_assets", 7)
        total_generated = bld_count + flr_count + unit_count + infra_count

        return {
            "status": "SUCCESS",
            "message": f"Successfully generated {total_generated} 3D Property Identities (VPRIDs)",
            "summary": {
                "buildings_processed": bld_count,
                "floors_processed": flr_count,
                "units_processed": unit_count,
                "infrastructure_processed": infra_count,
                "total_vprids_allocated": total_generated
            },
            "registry_status": "ACTIVE_CERTIFIED",
            "certified_timestamp": "2026-09-09T12:00:00Z"
        }

    @staticmethod
    def archive_registry(area_id: str) -> Dict[str, Any]:
        return {
            "status": "ARCHIVED",
            "message": f"3D Cadastral Registry for {area_id} archived to version history snapshot.",
            "active_version": "v2.9-ARCHIVE"
        }

    @staticmethod
    def regenerate_registry(area_id: str) -> Dict[str, Any]:
        return {
            "status": "REGENERATED",
            "message": f"3D Cadastral Registry for {area_id} restored to certified active state.",
            "active_version": "v3.0-CERTIFIED"
        }

class DemoViolationEngine:
    @staticmethod
    def get_violations_for_area(area_id: str) -> List[Dict[str, Any]]:
        area_dir = DemoAreaSelector.get_area_dir(area_id)
        v_path = os.path.join(area_dir, "violations.geojson")
        if os.path.exists(v_path):
            with open(v_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

class DemoExcavationEngine:
    @staticmethod
    def analyze_excavation_risk(area_id: str, depth_meters: float, polygon_coords: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Subterranean 3D clash detection against utilities, parking, road tunnels, and metro tunnels.
        """
        clashes = []
        risk_level = "LOW_RISK"
        
        # Standard subterranean layers in the area:
        # Telecom: 1.4m
        # Water: 1.8m
        # Power: 2.2m
        # Subsurface Parking: 6.0m
        # Road Tunnel: 8.5m
        # Metro Tunnel: 14.2m
        
        if depth_meters >= 1.4:
            clashes.append({
                "asset_id": "UTL-TEL-01",
                "asset_name": "BSNL 96-Core High-Speed Optical Fiber Trunk",
                "asset_type": "TELECOM",
                "depth_meters": 1.4,
                "vertical_clearance_meters": round(abs(depth_meters - 1.4), 2),
                "clash_severity": "CRITICAL_STRIKE_RISK" if depth_meters >= 1.4 else "NEAR_PROXIMITY"
            })
            risk_level = "HIGH_RISK"

        if depth_meters >= 1.8:
            clashes.append({
                "asset_id": "UTL-WTR-01",
                "asset_name": "Municipal 400mm Ductile Iron Water Trunk Main",
                "asset_type": "WATER",
                "depth_meters": 1.8,
                "vertical_clearance_meters": round(abs(depth_meters - 1.8), 2),
                "clash_severity": "CRITICAL_STRIKE_RISK"
            })
            risk_level = "CRITICAL_RISK"

        if depth_meters >= 2.2:
            clashes.append({
                "asset_id": "UTL-PWR-01",
                "asset_name": "BSES Rajdhani 11kV Underground Power Feeder",
                "asset_type": "ELECTRICITY",
                "depth_meters": 2.2,
                "vertical_clearance_meters": round(abs(depth_meters - 2.2), 2),
                "clash_severity": "HIGH_VOLTAGE_HAZARD"
            })
            risk_level = "CRITICAL_RISK"

        if depth_meters >= 6.0:
            clashes.append({
                "asset_id": "PKG-01",
                "asset_name": "2-Level Basement Commercial Parking Slab",
                "asset_type": "UNDERGROUND_PARKING",
                "depth_meters": 6.0,
                "vertical_clearance_meters": round(abs(depth_meters - 6.0), 2),
                "clash_severity": "STRUCTURAL_COLLISION"
            })
            risk_level = "CRITICAL_RISK"

        if depth_meters >= 8.5:
            clashes.append({
                "asset_id": "TNL-01",
                "asset_name": "Central Subsurface Road Tunnel",
                "asset_type": "TUNNEL",
                "depth_meters": 8.5,
                "vertical_clearance_meters": round(abs(depth_meters - 8.5), 2),
                "clash_severity": "STRUCTURAL_COLLISION"
            })
            risk_level = "CRITICAL_RISK"

        if depth_meters >= 14.2:
            clashes.append({
                "asset_id": "TNL-02",
                "asset_name": "Yellow Line Metro Rail Transit Tunnel",
                "asset_type": "TUNNEL",
                "depth_meters": 14.2,
                "vertical_clearance_meters": round(abs(depth_meters - 14.2), 2),
                "clash_severity": "CRITICAL_TRANSIT_IMPACT"
            })
            risk_level = "CRITICAL_RISK"

        recommendation = "Clearance Verification Required before issuing Excavation Permit." if risk_level in ["HIGH_RISK", "CRITICAL_RISK"] else "Safe for manual surface excavation with standard precautions."

        return {
            "status": "ANALYSIS_COMPLETE",
            "excavation_depth_meters": depth_meters,
            "overall_risk_level": risk_level,
            "clashes_detected_count": len(clashes),
            "clashes": clashes,
            "recommendation": recommendation,
            "digital_noc_eligible": True if risk_level == "LOW_RISK" else False
        }
