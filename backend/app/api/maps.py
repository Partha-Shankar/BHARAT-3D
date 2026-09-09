from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.spatial_service import get_project_3d_data

router = APIRouter(prefix="/maps", tags=["maps"])

@router.get("/{dataset_id}")
async def get_map_data(dataset_id: int, db: AsyncSession = Depends(get_db)):
    return await get_project_3d_data(db, dataset_id)
