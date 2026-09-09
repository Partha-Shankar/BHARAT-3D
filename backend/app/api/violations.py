import os
import json
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.demo.engine import DemoViolationEngine
from app.demo.area_selector import DemoAreaSelector

router = APIRouter(prefix="/violations", tags=["violations"])

@router.get("")
async def get_violations(
    project_id: Optional[Any] = 1,
    area_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    area = area_id or "area_01"
    violations = DemoViolationEngine.get_violations_for_area(area)
    return violations

@router.get("/{id}")
async def get_violation(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    area = area_id or "area_01"
    violations = DemoViolationEngine.get_violations_for_area(area)
    for v in violations:
        if v.get("id") == id or v.get("violation_code") == id:
            return v
    if violations:
        return violations[0]
    raise HTTPException(404, "Violation not found")

@router.post("/{id}/notice")
async def issue_notice(id: str, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    area = area_id or "area_01"
    violations = DemoViolationEngine.get_violations_for_area(area)
    target = None
    for v in violations:
        if v.get("id") == id or v.get("violation_code") == id:
            target = v
            break
    if not target and violations:
        target = violations[0]

    return {
        "status": "NOTICE_GENERATED",
        "notice_number": f"MCD-NOT-2026-{id}",
        "violator": target.get("name") if target else "Commercial Owner",
        "violation_type": target.get("violation_type") if target else "UNAUTHORIZED_EXTRA_FLOORS",
        "penalty_amount": target.get("penalty_amount", 84000) if target else 84000,
        "hearing_date": "2026-09-24",
        "enforcement_order": "Demolition or Regularization hearing within 15 days."
    }

@router.get("/bylaws/analyze/{building_id}")
async def analyze_bylaws(building_id: str, area_id: Optional[str] = Query(None)):
    is_sharma = "07" in building_id or "Sharma" in building_id
    return {
        "building_id": building_id,
        "rules_evaluated": [
            {"rule": "Front Setback", "sanctioned": "6.0m", "measured": "3.8m" if is_sharma else "6.2m", "status": "FAIL" if is_sharma else "PASS"},
            {"rule": "Rear Setback", "sanctioned": "4.5m", "measured": "4.6m", "status": "PASS"},
            {"rule": "Side Setback Left", "sanctioned": "3.0m", "measured": "3.1m", "status": "PASS"},
            {"rule": "Side Setback Right", "sanctioned": "3.0m", "measured": "3.0m", "status": "PASS"},
            {"rule": "Maximum Permissible Height", "sanctioned": "15.0m", "measured": "21.2m" if is_sharma else "14.8m", "status": "FAIL" if is_sharma else "PASS"},
            {"rule": "Floor Area Ratio (FAR)", "sanctioned": "2.50", "measured": "3.85" if is_sharma else "2.40", "status": "FAIL" if is_sharma else "PASS"},
            {"rule": "Ground Coverage", "sanctioned": "40%", "measured": "42%", "status": "FAIL" if is_sharma else "PASS"},
            {"rule": "Footpath Encroachment", "sanctioned": "0.0 m²", "measured": "18.6 m²" if is_sharma else "0.0 m²", "status": "FAIL" if is_sharma else "PASS"}
        ],
        "overall_compliance": "NON_COMPLIANT" if is_sharma else "COMPLIANT"
    }
