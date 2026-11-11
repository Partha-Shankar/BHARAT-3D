# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Survey projects: the record a survey area is attached to. Every route needs sign-in; changes need an editor."""
import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_editor
from app.models.models import Project, User
from app.realgen.geo import polygon_from_geojson, polygon_key
from app.schemas.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])
Db = Annotated[AsyncSession, Depends(get_db)]
SignedIn = Annotated[User, Depends(get_current_user)]
Editor = Annotated[User, Depends(require_editor)]


class AreaRequest(BaseModel):
    polygon_geojson: Any


def parse_project_id(pid: Any) -> int:
    try:
        return int(str(pid).replace("proj-", "").replace("PROJ-", ""))
    except (TypeError, ValueError):
        raise HTTPException(404, "Project not found") from None


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: Db, user: SignedIn):
    return (await db.execute(select(Project))).scalars().all()


@router.post("", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, db: Db, user: Editor):
    proj = Project(**req.model_dump(), created_by=user.id)
    db.add(proj)
    await db.commit()
    await db.refresh(proj)
    return proj


@router.get("/{id}", response_model=ProjectResponse)
async def get_project(id: str, db: Db, user: SignedIn):
    proj = (await db.execute(select(Project).where(Project.id == parse_project_id(id)))).scalar_one_or_none()
    if proj is None:
        raise HTTPException(404, "Project not found")
    return proj


@router.post("/{id}/area")
async def set_project_area(id: str, req: AreaRequest, db: Db, user: Editor):
    """Record the drawn survey polygon on the project (the 3D scene itself comes from /api/realgen/generate)."""
    try:
        poly = polygon_from_geojson(req.polygon_geojson)
    except Exception as exc:  # noqa: BLE001 - any unreadable shape is the caller's error
        raise HTTPException(422, f"Invalid polygon: {exc}") from None
    pid = parse_project_id(id)
    proj = (await db.execute(select(Project).where(Project.id == pid))).scalar_one_or_none()
    if proj is None:
        proj = Project(id=pid, name="Central Urban Zone - Ward 16 Survey", created_by=user.id)
        db.add(proj)
    proj.survey_polygon = json.dumps(req.polygon_geojson)
    key = polygon_key(poly)
    proj.selected_area_id = f"gen:{key}"
    await db.commit()
    c = poly.centroid
    return {"status": "SUCCESS", "project_id": pid, "selected_area_id": proj.selected_area_id, "scene_key": key,
            "center": [round(c.x, 6), round(c.y, 6)]}
