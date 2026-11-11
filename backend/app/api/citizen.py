from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict, List, Optional
from app.core import access
from app.core.database import get_db
from app.core.deps import get_current_user, role_of
from app.models.models import User

router = APIRouter(prefix="/citizen", tags=["citizen"])


def _owns(user: User, record: Dict[str, Any]) -> bool:
    """A citizen account owns a record when the record's owner is the account holder (demo: by name)."""
    return role_of(user) == "CITIZEN" and (user.full_name or "").startswith(record["owner_name"])


@router.get("/my-properties")
async def my_properties(response: Response, area_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    """The signed-in owner's own records, in full (access policy exception); anyone else gets an empty list."""
    response.headers[access.VIEW_HEADER] = access.FULL
    return [r for r in _DEMO_PROPERTIES if _owns(user, r)]


_DEMO_PROPERTIES: List[Dict[str, Any]] = [
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
async def get_property_by_id(identifier: str, response: Response, area_id: Optional[str] = Query(None),
                             user: User = Depends(get_current_user)):
    # Lookup by identifier: sign-in required; citizens get the public (masked) view, other roles theirs.
    view = access.view_of(user)
    response.headers[access.VIEW_HEADER] = view
    return access.redact_citizen_property({
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
    }, view)
