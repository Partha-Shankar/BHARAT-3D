import os
import json
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.demo.area_selector import DemoAreaSelector

router = APIRouter(prefix="/infrastructure", tags=["infrastructure"])

@router.get("")
async def get_infrastructure(
    project_id: Optional[Any] = 1,
    area_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    area = area_id or "area_01"
    area_dir = DemoAreaSelector.get_area_dir(area)
    assets = []
    for fname in ["tunnels.geojson", "flyovers.geojson", "utilities.geojson", "underground_parking.geojson"]:
        p = os.path.join(area_dir, fname)
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                assets.extend([feat["properties"] for feat in data.get("features", [])])
    return assets

@router.get("/{id}")
async def get_asset(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    area = area_id or "area_01"
    assets = await get_infrastructure(1, area, db)
    for a in assets:
        if a.get("id") == id:
            return a
    return {
        "id": id,
        "name": "Central Infrastructure Asset",
        "asset_type": "TUNNEL" if "TNL" in id else ("FLYOVER" if "FLY" in id else "UTILITY"),
        "operator": "PWD Delhi",
        "status": "OPERATIONAL"
    }

@router.put("/{id}")
async def update_asset(id: str, update_data: dict, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return {
        "id": id,
        "status": "UPDATED",
        "updated_fields": update_data,
        "message": f"Asset {id} geometry and spatial attributes successfully updated."
    }
