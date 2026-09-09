import os
import json
import hashlib
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
import aiofiles

from app.core.database import get_db
from app.core.config import get_settings
from app.schemas.schemas import ProjectResponse, ProjectCreate, DatasetResponse, RegistryStatsResponse
from app.models.models import Project, Dataset
from app.services.processing_service import start_processing_job
from app.services.spatial_service import (
    get_project_3d_data,
    get_project_map_data,
    get_registry_stats,
    generate_3d_property_ids,
    archive_3d_registry_snapshot,
    finalize_project
)
from app.demo.area_selector import DemoAreaSelector

router = APIRouter(prefix="/projects", tags=["projects"])
settings = get_settings()

class AreaRequest(BaseModel):
    polygon_geojson: Any

def parse_project_id(pid: Any) -> int:
    try:
        return int(str(pid).replace("proj-", "").replace("PROJ-", ""))
    except Exception:
        return 1

@router.get("", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Project))
    return res.scalars().all()

@router.post("", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db)):
    proj = Project(**req.model_dump(), created_by=1)
    db.add(proj)
    await db.commit()
    await db.refresh(proj)
    return proj

@router.get("/{id}", response_model=ProjectResponse)
async def get_project(id: str, db: AsyncSession = Depends(get_db)):
    pid = parse_project_id(id)
    res = await db.execute(select(Project).where(Project.id == pid))
    proj = res.scalar_one_or_none()
    if not proj:
        proj = Project(
            id=pid,
            name="Central Urban Zone - Ward 16 Survey",
            ward_number="Ward 16",
            zone_name="Central Urban Zone",
            selected_area_id="area_01",
            dataset_version="v3.0",
            created_by=1
        )
        db.add(proj)
        await db.commit()
        await db.refresh(proj)
    return proj

@router.post("/{id}/area")
async def set_project_area(id: str, req: AreaRequest, db: AsyncSession = Depends(get_db)):
    pid = parse_project_id(id)
    res = await db.execute(select(Project).where(Project.id == pid))
    proj = res.scalar_one_or_none()
    if not proj:
        proj = Project(id=pid, name="Central Urban Zone - Ward 16 Survey", created_by=1)
        db.add(proj)

    polygon_str = json.dumps(req.polygon_geojson) if isinstance(req.polygon_geojson, dict) else str(req.polygon_geojson)
    proj.survey_polygon = polygon_str
    
    # Resolve polygon to one of 10 prepared areas
    resolved_area = DemoAreaSelector.select_area_for_job("job_init", pid, polygon_str)
    proj.selected_area_id = resolved_area
    proj.dataset_version = f"v{resolved_area.replace('area_', '')}.0"

    await db.commit()
    await db.refresh(proj)
    
    metadata = DemoAreaSelector.get_area_metadata(resolved_area)
    return {
        "status": "SUCCESS",
        "project_id": pid,
        "selected_area_id": resolved_area,
        "area_name": metadata.get("area_name", "Central Urban Zone"),
        "ward": metadata.get("ward_number", "Ward 16"),
        "center": metadata.get("center", [77.2090, 28.6280])
    }

@router.get("/{id}/datasets", response_model=List[DatasetResponse])
async def get_datasets(id: str, db: AsyncSession = Depends(get_db)):
    pid = parse_project_id(id)
    res = await db.execute(select(Dataset).where(Dataset.project_id == pid))
    return res.scalars().all()

@router.post("/{id}/datasets", response_model=DatasetResponse)
async def upload_dataset(id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    pid = parse_project_id(id)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)

    sha256_hash = hashlib.sha256()
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024 * 1024):
            await out_file.write(content)
            sha256_hash.update(content)

    dataset = Dataset(
        project_id=pid,
        name=file.filename,
        version="1.0",
        status="VALIDATED",
        source_types='["LiDAR", "Drone", "GIS", "CAD", "GNSS", "Ownership", "Tax"]',
        metadata_json=f'{{"hash": "{sha256_hash.hexdigest()}", "crs": "EPSG:4326"}}'
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return dataset

@router.post("/{id}/process")
async def process_project(id: str, dataset_id: int = 10, db: AsyncSession = Depends(get_db)):
    pid = parse_project_id(id)
    res = await db.execute(select(Project).where(Project.id == pid))
    proj = res.scalar_one_or_none()
    poly = proj.survey_polygon if proj else None
    
    job_id = await start_processing_job(db, pid, dataset_id, poly)
    return {"job_id": job_id, "status": "QUEUED"}

@router.get("/{id}/map")
async def get_map_layers(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_project_map_data(db, id, area_id)

@router.get("/{id}/3d")
async def get_3d(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_project_3d_data(db, id, area_id)

@router.get("/{id}/registry")
async def registry_stats(id: str, db: AsyncSession = Depends(get_db)):
    return await get_registry_stats(db, id)

@router.post("/{id}/generate-3d-ids")
async def generate_3d_ids(id: str, db: AsyncSession = Depends(get_db)):
    return await generate_3d_property_ids(db, id)

@router.post("/{id}/archive-3d-registry")
async def archive_3d_registry(id: str, db: AsyncSession = Depends(get_db)):
    return await archive_3d_registry_snapshot(db, id)

@router.post("/{id}/finalize")
async def finalize_proj(id: str, db: AsyncSession = Depends(get_db)):
    return await finalize_project(db, id)
