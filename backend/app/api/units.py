import os
import json
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.demo.area_selector import DemoAreaSelector

router = APIRouter(prefix="/units", tags=["units"])

@router.get("/{id}")
async def get_unit(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    area = area_id or "area_01"
    area_dir = DemoAreaSelector.get_area_dir(area)
    u_path = os.path.join(area_dir, "units.geojson")
    if os.path.exists(u_path):
        with open(u_path, "r", encoding="utf-8") as f:
            units = json.load(f)
            for u in units:
                if u.get("id") == id or u.get("vprid") == id or id in u.get("vprid", ""):
                    return u
    # Default fallback for Flat 804
    return {
        "id": f"UNT-{id}",
        "vprid": id,
        "unit_number": "Flat 804",
        "property_type": "RESIDENTIAL",
        "carpet_area_sqm": 94.5,
        "built_up_area_sqm": 115.2,
        "area_sqm": 115.2,
        "volume_cum": 345.6,
        "owner_name": "Priya Mehta",
        "masked_id": "ID-XXXX-8921",
        "tenant_name": "Rohan Gupta",
        "lease_status": "ACTIVE",
        "annual_tax": 18400,
        "payment_status": "PAID",
        "compliance_status": "COMPLIANT",
        "title_deed": "DEED-DL-2024-0981"
    }

@router.get("/{id}/ownership")
async def get_ownership(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    unit = await get_unit(id, area_id, db)
    return {
        "unit_vprid": unit.get("vprid", id),
        "owner_name": unit.get("owner_name", "Priya Mehta"),
        "masked_id": unit.get("masked_id", "ID-XXXX-8921"),
        "ownership_type": "FREEHOLD",
        "share_percentage": 100.0,
        "title_deed": unit.get("title_deed", "DEED-DL-2024-0981"),
        "effective_date": "2024-04-15"
    }

@router.get("/{id}/tax")
async def get_tax(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    unit = await get_unit(id, area_id, db)
    return {
        "unit_vprid": unit.get("vprid", id),
        "financial_year": "2026-27",
        "usage_type": unit.get("property_type", "RESIDENTIAL"),
        "assessed_value": unit.get("annual_tax", 18400) * 10,
        "annual_tax": unit.get("annual_tax", 18400),
        "amount_paid": unit.get("annual_tax", 18400) if unit.get("payment_status") == "PAID" else 0,
        "amount_due": 0 if unit.get("payment_status") == "PAID" else unit.get("annual_tax", 18400),
        "payment_status": unit.get("payment_status", "PAID")
    }

@router.get("/{id}/lease")
async def get_lease(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    unit = await get_unit(id, area_id, db)
    return {
        "unit_vprid": unit.get("vprid", id),
        "tenant_name": unit.get("tenant_name", "Rohan Gupta"),
        "lease_start": "2025-01-01",
        "lease_end": "2026-12-31",
        "monthly_rent": 38000.0,
        "status": unit.get("lease_status", "ACTIVE")
    }

@router.post("/floors/{floor_id}/split")
async def split_floor(floor_id: str, splits: int = 4, db: AsyncSession = Depends(get_db)):
    return [
        {"id": f"UNT-NEW-{floor_id}-U01", "unit_number": "Unit 01", "area_sqm": 85.0},
        {"id": f"UNT-NEW-{floor_id}-U02", "unit_number": "Unit 02", "area_sqm": 85.0},
        {"id": f"UNT-NEW-{floor_id}-U03", "unit_number": "Unit 03", "area_sqm": 85.0},
        {"id": f"UNT-NEW-{floor_id}-U04", "unit_number": "Unit 04", "area_sqm": 85.0},
    ]
