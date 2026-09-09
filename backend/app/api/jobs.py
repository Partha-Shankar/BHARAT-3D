from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.schemas import ProcessingJobResponse
from app.services.processing_service import get_job_status, job_states

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/{job_id}", response_model=ProcessingJobResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await get_job_status(db, job_id)
    if not job:
        raise HTTPException(404)
    
    mem_state = job_states.get(job_id)
    if mem_state and job.status != "COMPLETE":
        job.progress = mem_state["progress"]
        job.current_stage = mem_state["stage"]
        job.status = mem_state["status"]
        
    return job
