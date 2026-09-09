from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Any
from pydantic import BaseModel
from app.core.database import get_db
from app.demo.engine import DemoExcavationEngine

router = APIRouter(prefix="/excavation", tags=["excavation"])

class ExcavationCheckRequest(BaseModel):
    project_id: Optional[Any] = 1
    area_id: Optional[str] = "area_01"
    depth_meters: float = 2.0
    polygon_geojson: Optional[Any] = None

class PermitRequest(BaseModel):
    project_id: Optional[Any] = 1
    area_id: Optional[str] = "area_01"
    applicant_name: Optional[str] = "Delhi Jal Board"
    purpose: Optional[str] = "Pipeline Trenching"
    depth_meters: float = 2.0

@router.post("/analyze")
@router.post("/check-clash")
async def check_clash(req: ExcavationCheckRequest, db: AsyncSession = Depends(get_db)):
    area = req.area_id or "area_01"
    return DemoExcavationEngine.analyze_excavation_risk(area, req.depth_meters)

@router.post("/apply-permit")
async def apply_permit(req: PermitRequest, db: AsyncSession = Depends(get_db)):
    area = req.area_id or "area_01"
    analysis = DemoExcavationEngine.analyze_excavation_risk(area, req.depth_meters)
    return {
        "permit_id": f"NOC-EXC-2026-{int(req.depth_meters * 100)}",
        "status": "APPROVED_WITH_CONDITIONS" if analysis["overall_risk_level"] != "LOW_RISK" else "APPROVED",
        "applicant": req.applicant_name,
        "purpose": req.purpose,
        "depth_approved_meters": req.depth_meters,
        "analysis": analysis,
        "digital_signature": "SHA256:8f9a...e4b1 (Certified by MCD Geospatial Clearance Authority)"
    }
