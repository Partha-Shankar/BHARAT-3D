from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.models.models import AuditEvent
from app.schemas.schemas import AuditEventResponse

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("", response_model=List[AuditEventResponse])
async def get_audit_events(project_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AuditEvent).where(AuditEvent.project_id == project_id))
    return res.scalars().all()
