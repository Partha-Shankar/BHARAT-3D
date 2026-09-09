import os
import json
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Building, Floor
from app.demo.area_selector import DemoAreaSelector

router = APIRouter(prefix="/buildings", tags=["buildings"])

@router.get("")
async def get_buildings(
    project_id: Optional[Any] = 1,
    area_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    area = area_id or "area_01"
    area_dir = DemoAreaSelector.get_area_dir(area)
    b_path = os.path.join(area_dir, "buildings.geojson")
    if os.path.exists(b_path):
        with open(b_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [feat["properties"] for feat in data.get("features", [])]
    return []

@router.get("/{id}")
async def get_building(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    area = area_id or "area_01"
    area_dir = DemoAreaSelector.get_area_dir(area)
    b_path = os.path.join(area_dir, "buildings.geojson")
    if os.path.exists(b_path):
        with open(b_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for feat in data.get("features", []):
                p = feat["properties"]
                if p.get("id") == id or p.get("building_code") == id or id in p.get("id", ""):
                    return p
    return {
        "id": id,
        "name": "Aarav Heights Tower",
        "building_type": "RESIDENTIAL",
        "total_floors": 12,
        "height_meters": 39.0,
        "footprint_area_sqm": 912.0,
        "ulpin": "IN-01-0008"
    }

@router.get("/{id}/floors")
async def get_floors(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    area = area_id or "area_01"
    area_dir = DemoAreaSelector.get_area_dir(area)
    f_path = os.path.join(area_dir, "floors.geojson")
    if os.path.exists(f_path):
        with open(f_path, "r", encoding="utf-8") as f:
            floors = json.load(f)
            matching = [flr for flr in floors if flr.get("building_id") == id or id in flr.get("building_id", "")]
            if matching:
                return matching
            return floors[:12]
    return []

@router.post("/{id}/floors")
async def add_floor(id: str, floor_payload: dict, db: AsyncSession = Depends(get_db)):
    return {
        "id": f"FLR-{id}-F13",
        "building_id": id,
        "floor_number": 13,
        "floor_label": "Floor 13",
        "height": 42.25,
        "base_height": 39.0,
        "status": "ADDED"
    }
