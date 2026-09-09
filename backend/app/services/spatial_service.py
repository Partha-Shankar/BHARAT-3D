import os
import json
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.models import Building, Parcel, VerticalUnit, Project, ProjectStatusEnum
from app.demo.area_selector import DemoAreaSelector
from app.demo.engine import Demo3DRegistryEngine

DATA_AREAS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/demo/areas"))

def resolve_area_id_from_project(project: Optional[Project]) -> str:
    if project and hasattr(project, "selected_area_id") and project.selected_area_id:
        return project.selected_area_id
    if project and hasattr(project, "dataset_version") and project.dataset_version:
        try:
            d_num = int(str(project.dataset_version).replace("v", "").split(".")[0])
            return f"area_{d_num:02d}"
        except Exception:
            pass
    return "area_01"

async def get_project_3d_data(db: AsyncSession, project_id: Any, area_override: Optional[str] = None) -> Dict[str, Any]:
    area_id = area_override
    if not area_id:
        try:
            pid = int(str(project_id).replace("proj-", "").replace("PROJ-", ""))
            res = await db.execute(select(Project).where(Project.id == pid))
            project = res.scalar_one_or_none()
            area_id = resolve_area_id_from_project(project)
        except Exception:
            area_id = "area_01"

    area_dir = DemoAreaSelector.get_area_dir(area_id)
    scene_file = os.path.join(area_dir, "3d_data.json")
    if os.path.exists(scene_file):
        with open(scene_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Fallback to 3d/3d_data.json
    scene_file_sub = os.path.join(area_dir, "3d", "3d_data.json")
    if os.path.exists(scene_file_sub):
        with open(scene_file_sub, "r", encoding="utf-8") as f:
            return json.load(f)

    return {"type": "FeatureCollection", "features": []}

async def get_project_map_data(db: AsyncSession, project_id: Any, area_override: Optional[str] = None) -> Dict[str, Any]:
    area_id = area_override or "area_01"
    area_dir = DemoAreaSelector.get_area_dir(area_id)

    layers = {}
    for filename in ["parcels.geojson", "roads.geojson", "footpaths.geojson", "buildings.geojson", "floors.geojson", "units.geojson", "mall.geojson", "railway.geojson", "metro.geojson", "flyovers.geojson", "tunnels.geojson", "underground_parking.geojson", "utilities.geojson", "violations.geojson"]:
        fpath = os.path.join(area_dir, filename)
        key = filename.replace(".geojson", "")
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                layers[key] = json.load(f)

    metrics = DemoAreaSelector.get_area_metrics(area_id)
    metadata = DemoAreaSelector.get_area_metadata(area_id)

    return {
        "area_id": area_id,
        "metadata": metadata,
        "metrics": metrics,
        "layers": layers
    }

async def get_registry_stats(db: AsyncSession, project_id: Any) -> Dict[str, Any]:
    try:
        pid = int(str(project_id).replace("proj-", "").replace("PROJ-", ""))
        res = await db.execute(select(Project).where(Project.id == pid))
        project = res.scalar_one_or_none()
        area_id = resolve_area_id_from_project(project)
    except Exception:
        area_id = "area_01"

    metrics = DemoAreaSelector.get_area_metrics(area_id)
    return {
        "total_parcels": metrics.get("parcels_count", 41),
        "total_buildings": metrics.get("buildings_detected", 18),
        "total_floors": metrics.get("floors_inferred", 112),
        "total_units": metrics.get("vertical_units", 188),
        "infrastructure_assets": metrics.get("infrastructure_assets", 7),
        "violations_count": metrics.get("violations_detected", 4),
        "analysis_confidence": metrics.get("analysis_confidence", 0.948),
        "topology_score": metrics.get("topology_score", 0.987),
        "total_tax_collected": 18450000.0,
        "compliance_score": 96.8
    }

async def generate_3d_property_ids(db: AsyncSession, project_id: Any) -> Dict[str, Any]:
    try:
        pid = int(str(project_id).replace("proj-", "").replace("PROJ-", ""))
        res = await db.execute(select(Project).where(Project.id == pid))
        project = res.scalar_one_or_none()
        area_id = resolve_area_id_from_project(project)
    except Exception:
        area_id = "area_01"

    return Demo3DRegistryEngine.generate_bulk_3d_ids(area_id)

async def archive_3d_registry_snapshot(db: AsyncSession, project_id: Any) -> Dict[str, Any]:
    try:
        pid = int(str(project_id).replace("proj-", "").replace("PROJ-", ""))
        res = await db.execute(select(Project).where(Project.id == pid))
        project = res.scalar_one_or_none()
        area_id = resolve_area_id_from_project(project)
    except Exception:
        area_id = "area_01"

    return Demo3DRegistryEngine.archive_registry(area_id)

async def finalize_project(db: AsyncSession, project_id: Any) -> Dict[str, Any]:
    try:
        pid = int(str(project_id).replace("proj-", "").replace("PROJ-", ""))
        res = await db.execute(select(Project).where(Project.id == pid))
        project = res.scalar_one_or_none()
        if project:
            project.status = ProjectStatusEnum.PUBLISHED
            await db.commit()
            await db.refresh(project)
            return {
                "id": project.id,
                "name": project.name,
                "status": "PUBLISHED",
                "selected_area_id": project.selected_area_id,
                "dataset_version": project.dataset_version
            }
    except Exception:
        pass

    return {
        "id": 1,
        "name": "Central Urban Zone - Ward 16 Survey",
        "status": "PUBLISHED",
        "selected_area_id": "area_01",
        "dataset_version": "v3.0"
    }
