import os
import json
import hashlib
from typing import Dict, Any, Optional

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/demo/areas"))

AREA_METADATA = {
    "area_01": {"name": "Central Heights", "ward": "Ward 16", "center": [77.2090, 28.6280], "parcels": 41, "buildings": 18, "floors": 112, "units": 188, "violations": 4},
    "area_02": {"name": "Metro District", "ward": "Ward 22", "center": [77.2180, 28.6340], "parcels": 42, "buildings": 18, "floors": 118, "units": 208, "violations": 4},
    "area_03": {"name": "Civic Square", "ward": "Ward 08", "center": [77.2250, 28.6220], "parcels": 43, "buildings": 18, "floors": 118, "units": 208, "violations": 4},
    "area_04": {"name": "Transit Quarter", "ward": "Ward 31", "center": [77.2020, 28.6410], "parcels": 44, "buildings": 18, "floors": 106, "units": 174, "violations": 4},
    "area_05": {"name": "Urban Heights", "ward": "Ward 14", "center": [77.2140, 28.6180], "parcels": 45, "buildings": 18, "floors": 114, "units": 190, "violations": 4},
    "area_06": {"name": "Central Market Zone", "ward": "Ward 19", "center": [77.2310, 28.6300], "parcels": 46, "buildings": 18, "floors": 124, "units": 220, "violations": 4},
    "area_07": {"name": "Civic Transit Zone", "ward": "Ward 05", "center": [77.1950, 28.6250], "parcels": 47, "buildings": 18, "floors": 116, "units": 198, "violations": 4},
    "area_08": {"name": "Integrated Urban Zone", "ward": "Ward 27", "center": [77.2060, 28.6500], "parcels": 40, "buildings": 18, "floors": 110, "units": 186, "violations": 4},
    "area_09": {"name": "Vertical City District", "ward": "Ward 11", "center": [77.2220, 28.6450], "parcels": 41, "buildings": 18, "floors": 108, "units": 184, "violations": 4},
    "area_10": {"name": "Central Urban Core", "ward": "Ward 01", "center": [77.2100, 28.6320], "parcels": 42, "buildings": 18, "floors": 108, "units": 182, "violations": 4}
}

class DemoAreaSelector:
    """
    Selects and resolves survey boundary polygons / upload packages to one of the 10 prepared small urban areas.
    The selection is deterministic per job/project/polygon, ensuring reproducible and seamless demos.
    """
    @staticmethod
    def select_area_for_job(job_id: Any, project_id: Any = 1, polygon_geojson: Optional[str] = None) -> str:
        if polygon_geojson:
            seed_str = f"{project_id}_{polygon_geojson}_{job_id}"
        else:
            seed_str = f"{project_id}_{job_id}"
            
        hash_val = int(hashlib.md5(seed_str.encode("utf-8")).hexdigest(), 16)
        area_num = (hash_val % 10) + 1
        return f"area_{area_num:02d}"

    @staticmethod
    def get_area_dir(area_id: str) -> str:
        target_dir = os.path.join(BASE_DIR, area_id)
        if not os.path.exists(target_dir):
            target_dir = os.path.join(BASE_DIR, "area_01")
        return target_dir

    @staticmethod
    def get_area_metadata(area_id: str) -> Dict[str, Any]:
        meta_file = os.path.join(DemoAreaSelector.get_area_dir(area_id), "metadata.json")
        if os.path.exists(meta_file):
            with open(meta_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return AREA_METADATA.get(area_id, AREA_METADATA["area_01"])

    @staticmethod
    def get_area_metrics(area_id: str) -> Dict[str, Any]:
        metrics_file = os.path.join(DemoAreaSelector.get_area_dir(area_id), "metrics.json")
        if os.path.exists(metrics_file):
            with open(metrics_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return AREA_METADATA.get(area_id, AREA_METADATA["area_01"])
