# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Survey files: the reader catalogue, processing plans for a survey package, and inspection of an uploaded file.

``/formats`` and ``/plan`` describe the survey readers (pseudo-code, see app/ingest). ``/inspect`` really reads the
first bytes of a file the visitor attaches and reports what it contains (app/ingest/inspect.py). None of these
endpoints changes an area or mints identifiers: an area's 3D record is built from the records the server holds.
"""
import asyncio
import base64
import binascii
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.ingest import describe_all, plan_for_manifest
from app.ingest.inspect import SAMPLE_BYTES, inspect_sample
from app.models.models import User

router = APIRouter(prefix="/ingest", tags=["ingest"])
MAX_DATASETS = 50
SAMPLE_B64_MAX = (SAMPLE_BYTES + 2) // 3 * 4  # base64 length of the largest accepted sample
SignedIn = Annotated[User, Depends(get_current_user)]  # any role may read plans and inspect files


class PlanRequest(BaseModel):
    """The survey package manifest, as the web app sends it with POST /api/realgen/generate."""

    datasets: list[Any] = Field(default_factory=list)


class InspectRequest(BaseModel):
    """The start of a file the visitor attached: its name, full size, dataset slot and first bytes (base64)."""

    name: str = Field(min_length=1, max_length=255)
    size_bytes: int | None = Field(default=None, ge=0)
    slot: str | None = Field(default=None, max_length=40)
    sample_b64: str = Field(max_length=SAMPLE_B64_MAX)
    area_bbox: list[float] | None = Field(default=None, min_length=4, max_length=4)  # survey area [W, S, E, N]


@router.get("/formats")
async def formats(user: SignedIn) -> list[dict[str, Any]]:
    """Every survey reader: formats, outputs, accuracy class and its algorithm."""
    return describe_all()


@router.post("/plan")
async def plan(req: PlanRequest, user: SignedIn) -> list[dict[str, Any]]:
    """One processing plan per dataset (status PSEUDO_NOT_EXECUTED, or UNSUPPORTED). Nothing is parsed or minted."""
    return [p.to_dict() for p in plan_for_manifest(req.datasets[:MAX_DATASETS])]


@router.post("/inspect")
async def inspect_file(req: InspectRequest, user: SignedIn) -> dict[str, Any]:
    """Read the first bytes of an attached file and report its format, header facts and problems to fix."""
    try:
        sample = base64.b64decode(req.sample_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(422, "The file sample is not valid base64.") from exc
    if len(sample) > SAMPLE_BYTES:
        raise HTTPException(413, f"Send at most the first {SAMPLE_BYTES // 1024} KB of the file.")
    result = await asyncio.to_thread(inspect_sample, req.name, sample, req.size_bytes, req.slot, req.area_bbox)
    return result.to_dict()
