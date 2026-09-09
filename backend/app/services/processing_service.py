import asyncio
from datetime import datetime
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.models import ProcessingJob, JobStatusEnum, Project, ProjectStatusEnum
from app.demo.engine import DemoProcessingEngine
from app.demo.area_selector import DemoAreaSelector
from app.core.database import AsyncSessionLocal

job_states = {}

async def start_processing_job(db: AsyncSession, project_id: int, dataset_id: int = 10, polygon_geojson: Optional[str] = None) -> int:
    # 1. Deterministically resolve area
    selected_area = DemoAreaSelector.select_area_for_job(f"job_{datetime.utcnow().timestamp()}", project_id, polygon_geojson)
    
    # 2. Update project record with selected_area_id
    await db.execute(
        update(Project)
        .where(Project.id == project_id)
        .values(
            status=ProjectStatusEnum.PROCESSING,
            selected_area_id=selected_area,
            dataset_version=f"v{selected_area.replace('area_', '')}.0"
        )
    )
    await db.commit()

    # 3. Create Job
    job = ProcessingJob(
        project_id=project_id,
        dataset_id=dataset_id,
        status=JobStatusEnum.QUEUED,
        started_at=datetime.utcnow()
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    job_states[job.id] = {
        "status": JobStatusEnum.RUNNING,
        "progress": 0,
        "stage": "Upload Validation",
        "selected_area_id": selected_area
    }

    # 4. Start background processing simulation
    asyncio.create_task(_run_demo_processing(job.id, project_id, selected_area))
    return job.id

async def get_job_status(db: AsyncSession, job_id: int) -> Optional[ProcessingJob]:
    result = await db.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
    return result.scalar_one_or_none()

async def _run_demo_processing(job_id: int, project_id: int, selected_area: str):
    engine = DemoProcessingEngine()
    async with AsyncSessionLocal() as db:
        await db.execute(update(ProcessingJob).where(ProcessingJob.id == job_id).values(status=JobStatusEnum.RUNNING))
        await db.commit()

        async for stage, progress, desc in engine.simulate_processing(job_id, selected_area):
            job_states[job_id] = {
                "status": JobStatusEnum.RUNNING,
                "progress": progress,
                "stage": stage,
                "description": desc,
                "selected_area_id": selected_area
            }
            await db.execute(
                update(ProcessingJob)
                .where(ProcessingJob.id == job_id)
                .values(progress=progress, current_stage=stage)
            )
            await db.commit()

        # Job complete
        await db.execute(
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .values(
                status=JobStatusEnum.COMPLETE,
                progress=100,
                current_stage="Complete",
                completed_at=datetime.utcnow()
            )
        )
        await db.execute(
            update(Project)
            .where(Project.id == project_id)
            .values(status=ProjectStatusEnum.REVIEW)
        )
        await db.commit()

        job_states[job_id] = {
            "status": JobStatusEnum.COMPLETE,
            "progress": 100,
            "stage": "Complete",
            "selected_area_id": selected_area
        }
