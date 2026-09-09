from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Any
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter(prefix="/citizen", tags=["citizen"])

class TaxPaymentRequest(BaseModel):
    unit_vprid: str
    amount: float
    payment_method: Optional[str] = "UPI_BHIM"

@router.get("/my-properties")
async def my_properties(area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return [
        {
            "id": "UNT-VPR-BLD0101-F08-U04",
            "vprid": "VPR-BLD0101-F08-U04",
            "unit_number": "Flat 804",
            "building_name": "Aarav Heights Condominium",
            "floor_number": 8,
            "property_type": "RESIDENTIAL",
            "carpet_area_sqm": 94.5,
            "built_up_area_sqm": 115.2,
            "volume_cum": 345.6,
            "owner_name": "Priya Mehta",
            "masked_id": "ID-XXXX-8921",
            "tenant_name": "Rohan Gupta",
            "occupancy_status": "LEASED",
            "annual_tax": 18400,
            "payment_status": "PAID",
            "compliance_status": "COMPLIANT",
            "title_deed": "DEED-DL-2024-0981",
            "ulpin": "IN-01-0008",
            "ward_id": "Ward 16",
            "z_min": 237.75,
            "z_max": 241.0
        }
    ]

@router.get("/property/{identifier}")
async def get_property_by_id(identifier: str, area_id: Optional[str] = Query(None)):
    return {
        "vprid": identifier,
        "unit_number": "Flat 804",
        "building_name": "Aarav Heights Condominium",
        "floor_number": 8,
        "property_type": "RESIDENTIAL",
        "carpet_area_sqm": 94.5,
        "built_up_area_sqm": 115.2,
        "volume_cum": 345.6,
        "owner_name": "Priya Mehta",
        "masked_id": "ID-XXXX-8921",
        "tenant_name": "Rohan Gupta",
        "annual_tax": 18400,
        "payment_status": "PAID",
        "compliance_status": "COMPLIANT",
        "title_deed": "DEED-DL-2024-0981",
        "ulpin": "IN-01-0008"
    }

@router.post("/pay-tax")
async def pay_tax(req: TaxPaymentRequest):
    return {
        "status": "SUCCESS",
        "transaction_id": f"TXN-TAX-2026-{int(req.amount * 10)}",
        "unit_vprid": req.unit_vprid,
        "amount_paid": req.amount,
        "payment_status": "PAID",
        "receipt_number": f"MCD-RCPT-2026-8812",
        "timestamp": "2026-09-09T14:30:00Z"
    }
