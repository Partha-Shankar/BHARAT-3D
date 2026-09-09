from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import InfrastructureAsset

async def analyze_excavation(db: AsyncSession, polygon_geojson: str, depth: float, project_id: int):
    conflicts = []
    res = await db.execute(select(InfrastructureAsset).where(InfrastructureAsset.project_id == project_id))
    assets = res.scalars().all()
    
    for asset in assets:
        if asset.depth_meters is not None and asset.depth_meters < depth:
            conflicts.append({
                "asset_id": asset.asset_id,
                "name": asset.name,
                "asset_type": asset.asset_type,
                "conflict_type": "DEPTH_INTERSECTION",
                "severity": "HIGH",
                "depth_meters": asset.depth_meters
            })
    
    return {
        "project_id": project_id,
        "is_safe": len(conflicts) == 0,
        "max_safe_depth": depth - 1.0 if conflicts else depth + 10.0,
        "conflicts": conflicts
    }
