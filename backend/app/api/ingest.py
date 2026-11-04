# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Survey-file readers (pseudo-code): what each format would yield and how a survey package would be processed."""
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.ingest import describe_all, plan_for_manifest
from app.models.models import User

router = APIRouter(prefix="/ingest", tags=["ingest"])
MAX_DATASETS = 50
SignedIn = Annotated[User, Depends(get_current_user)]  # any role may read plans


class PlanRequest(BaseModel):
    """The survey package manifest, as the web app sends it with POST /api/realgen/generate."""

    datasets: list[Any] = Field(default_factory=list)


@router.get("/formats")
async def formats(user: SignedIn) -> list[dict[str, Any]]:
    """Every pseudo-code reader: formats, outputs, accuracy class and its algorithm."""
    return describe_all()


@router.post("/plan")
async def plan(req: PlanRequest, user: SignedIn) -> list[dict[str, Any]]:
    """One processing plan per dataset (status PSEUDO_NOT_EXECUTED, or UNSUPPORTED). Nothing is parsed or minted."""
    return [p.to_dict() for p in plan_for_manifest(req.datasets[:MAX_DATASETS])]
