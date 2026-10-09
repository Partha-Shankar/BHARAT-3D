"""Generate a 3D scene from the real geography inside a user-drawn polygon."""
import asyncio
import json
import logging
import os
import shutil
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from shapely.geometry import Polygon
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Project, User
from app.realgen import cache, fetch_osm, norms, pipeline, scene_ops, synth
from app.realgen.geo import LocalFrame, polygon_from_geojson, polygon_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/realgen", tags=["realgen"])

# In-process job registry (single worker). Scenes themselves persist on disk.
jobs: Dict[str, Dict[str, Any]] = {}
_tasks: set = set()


class GenerateRequest(BaseModel):
    polygon: Any
    project_id: Optional[Any] = None
    force: bool = False
    datasets: Optional[List[Dict[str, Any]]] = None  # survey package manifest from the ingestion step


class ExcavationRequest(BaseModel):
    polygon: Optional[Any] = None  # GeoJSON polygon in lon/lat
    polygon_local: Optional[list] = None  # [[x, y], ...] in scene metres (from the 3D viewer)
    depth_meters: float = 2.0


def _parse_project_id(pid: Any) -> Optional[int]:
    try:
        return int(str(pid).replace("proj-", "").replace("PROJ-", ""))
    except (TypeError, ValueError):
        return None


def _load_scene(key: str) -> Dict[str, Any]:
    scene = cache.read_json(key, "scene.json") if key.isalnum() else None
    if scene is None:
        raise HTTPException(404, "Scene not generated yet")
    if scene.get("version", 0) < pipeline.SCENE_VERSION and cache.read_json(key, "scene_base.json") is None:
        scene = _upgrade_legacy(key, scene)
    elif scene.get("plan_version") != scene_ops.PLAN_VERSION and cache.read_json(key, "scene_base.json") is not None:
        scene = scene_ops.rebuild(key)
    return scene


def _upgrade_legacy(key: str, scene: Dict[str, Any]) -> Dict[str, Any]:
    """Scenes generated before editing existed: adopt them as the base scene and derive registry/findings."""
    for b in scene["buildings"]:
        b.setdefault("sanction_status", "ON_RECORD")
        b.setdefault("permit_no", f"BP/{2008 + b['seed'] % 16}/{b['seed'] % 90000 + 10000}")
        b.setdefault("block_no", 1)
        b.setdefault("under_construction", False)
    scene.setdefault("construction_sites", [])
    for r in scene["roads"]:
        r.setdefault("width_tagged", False)
    scene["version"] = pipeline.SCENE_VERSION
    cache.write_json(key, "scene_base.json", scene)
    return scene_ops.rebuild(key)


@router.post("/generate")
async def generate(req: GenerateRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        poly = polygon_from_geojson(req.polygon)
        area_m2 = pipeline.validate_area(poly)
    except pipeline.AreaError as exc:
        raise HTTPException(422, str(exc))
    except Exception as exc:
        raise HTTPException(422, f"Invalid polygon: {exc}")
    key = polygon_key(poly)
    if cache.read_json(key, "scene_base.json") is None:  # new areas must be in India
        reason = await asyncio.to_thread(fetch_osm.india_check, poly)
        if reason:
            raise HTTPException(422, reason)

    pid = _parse_project_id(req.project_id)
    if pid is not None:
        proj = (await db.execute(select(Project).where(Project.id == pid))).scalar_one_or_none()
        if proj is not None:
            proj.survey_polygon = json.dumps(req.polygon)
            proj.selected_area_id = f"gen:{key}"
            await db.commit()

    if req.datasets:
        keep = ("slot", "title", "name", "size_bytes", "format", "checks", "sample")
        cache.write_json(key, "ingest.json", {
            "at": time.time(), "by": user.email,
            "datasets": [{k: d.get(k) for k in keep} for d in req.datasets[:20] if isinstance(d, dict)],
        })

    running = next((j for j in jobs.values() if j["key"] == key and j["status"] == "RUNNING"), None)
    if running and not req.force:
        return {"job_id": running["id"], "key": key, "status": running["status"]}

    job_id = uuid.uuid4().hex[:12]
    job = {"id": job_id, "key": key, "status": "RUNNING", "stage_index": 0, "stage": "Queued", "detail": "",
           "stages": pipeline.STAGES, "progress": 0, "area_m2": round(area_m2), "started_at": time.time(),
           "error": None, "stats": None}
    jobs[job_id] = job

    def on_progress(i: int, stage: str, detail: str):
        job.update(stage_index=i, stage=stage, detail=detail,
                   progress=min(99, int(i / len(pipeline.STAGES) * 100)))

    async def run():
        try:
            scene = await asyncio.to_thread(pipeline.generate, req.polygon, on_progress, req.force)
            job.update(status="COMPLETE", progress=100, stage="Complete", stats=scene["stats"],
                       place=scene["place"], summary=scene["summary"])
        except Exception as exc:
            logger.exception("Generation failed for %s", key)
            job.update(status="FAILED", error=str(exc))

    task = asyncio.create_task(run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "key": key, "status": "RUNNING"}


@router.get("/jobs/{job_id}")
async def job_status(job_id: str, user: User = Depends(get_current_user)):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return {**job, "elapsed_s": round(time.time() - job["started_at"], 1)}


@router.get("/scenes/{key}")
async def get_scene(key: str, user: User = Depends(get_current_user)):
    return _load_scene(key)


@router.get("/scenes/{key}/{name}.jpg")
async def get_texture(key: str, name: str):
    # Public so the WebGL texture loader can fetch it without an auth header; it is only satellite imagery.
    if not key.isalnum() or name not in {"texture", "context"} or not cache.exists(key, f"{name}.jpg"):
        raise HTTPException(404, "Texture not found")
    path = cache.file_path(key, f"{name}.jpg")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/scenes/{key}/buildings/{building_id}")
async def get_building(key: str, building_id: str, user: User = Depends(get_current_user)):
    detail = scene_ops.building_detail(_load_scene(key), building_id)
    if detail is None:
        raise HTTPException(404, "Building not found")
    return detail


EDITOR_ROLES = {"SURVEYOR", "ADMIN"}


def _require_editor(user: User):
    role = getattr(user.role, "value", user.role)
    if role not in EDITOR_ROLES:
        raise HTTPException(403, "Only surveyors and admins can change or delete generated areas")


@router.get("/scenes")
async def list_scenes(user: User = Depends(get_current_user)):
    """Every generated area on this server, newest first."""
    out = []
    if os.path.isdir(cache.CACHE_ROOT):
        for key in os.listdir(cache.CACHE_ROOT):
            if not key.isalnum():
                continue
            meta = cache.read_json(key, "meta.json")
            if meta is None:
                scene = cache.read_json(key, "scene.json")
                if scene is None:
                    continue
                scene_ops.write_meta(key, scene)
                meta = cache.read_json(key, "meta.json")
            if meta.get("vprids_reserved") is None:  # legacy scene: upgrade so the register shows real counts
                try:
                    _load_scene(key)
                    meta = cache.read_json(key, "meta.json") or meta
                except Exception:
                    logger.exception("Could not upgrade %s", key)
            ingest = cache.read_json(key, "ingest.json")
            out.append({**meta, "datasets": len(ingest["datasets"]) if ingest else 0})
    return sorted(out, key=lambda m: m.get("updated_at", 0), reverse=True)


def _area_keys() -> List[str]:
    if not os.path.isdir(cache.CACHE_ROOT):
        return []
    return [k for k in os.listdir(cache.CACHE_ROOT) if k.isalnum() and cache.exists(k, "scene.json")]


def _place_label(place: Dict[str, Any]) -> str:
    return ", ".join(p for p in (place.get("locality"), place.get("city")) if p) or "Survey area"


@router.get("/findings")
async def all_findings(key: Optional[str] = None, user: User = Depends(get_current_user)):
    """Compliance findings across every generated area (or one area), with the building they concern."""
    out = []
    for k in [key] if key else _area_keys():
        try:
            scene = _load_scene(k)
        except HTTPException:
            continue
        names = {b["id"]: b for b in scene["buildings"]}
        for v in scene.get("violations", []):
            b = names.get(v.get("building_id"))
            out.append({**{f: v.get(f) for f in ("id", "type", "severity", "building_id", "sanctioned", "observed", "excess",
                                                  "floors_flagged", "measurement_confidence", "basis", "location")},
                        "key": k, "place": _place_label(scene["place"]), "building_name": b["name"] if b else None,
                        "ulpin": b.get("ulpin") if b else None, "floors": b["floors"] if b else None})
    rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    return sorted(out, key=lambda f: (rank.get(f["severity"], 9), f["place"], f["id"]))


@router.get("/registry")
async def registry_all(q: str = "", limit: int = 50, status: str = "", user: User = Depends(get_current_user)):
    """Search reserved 3D ULPINs across every generated area (VPRID, ULPIN, building id or name)."""
    ql = q.strip().lower()
    hits, total, by_status = [], 0, {}
    for k in _area_keys():
        meta = cache.read_json(k, "meta.json") or {}
        entries = cache.read_json(k, "registry.json") or []
        total += len(entries)
        for st, n in _count_status(entries).items():
            by_status[st] = by_status.get(st, 0) + n
        place = _place_label(meta.get("place", {}))
        hits += [{**e, "key": k, "place": place} for e in entries if _registry_match(e, ql, status)]
    return {"total": total, "matches": len(hits), "by_status": by_status, "items": hits[: max(1, min(limit, 500))]}


@router.get("/activity")
async def activity(key: Optional[str] = None, limit: int = 200, user: User = Depends(get_current_user)):
    """Append-only history: area generation, survey packages ingested, and every surveyor edit."""
    events = []
    for k in [key] if key else _area_keys():
        meta = cache.read_json(k, "meta.json")
        if not meta:
            continue
        place = _place_label(meta.get("place", {}))
        events.append({"key": k, "place": place, "at": meta.get("created_at"), "kind": "generated", "by": None,
                       "detail": {"buildings": meta.get("buildings"), "vprids": meta.get("vprids_reserved"),
                                  "findings": meta.get("violations"), "area_m2": meta.get("area_m2")}})
        ingest = cache.read_json(k, "ingest.json")
        if ingest:
            events.append({"key": k, "place": place, "at": ingest.get("at"), "kind": "ingested", "by": ingest.get("by"),
                           "detail": {"datasets": ingest.get("datasets", [])}})
        for e in cache.read_json(k, "edits.json") or []:
            events.append({"key": k, "place": place, "at": e.get("at"), "kind": "edit", "by": e.get("by"),
                           "seq": e.get("seq"), "detail": e.get("op")})
        # 3D ULPIN lifecycle (mint / retire / demolish / version / certify), grouped per rebuild
        groups: Dict[tuple, Dict[str, Any]] = {}
        for ev in norms.read_ledger(k).get("events", []):
            g = groups.setdefault((round(ev["at"], 3), ev["kind"]), {"count": 0, "sample": [], "reason": ev.get("reason")})
            g["count"] += 1
            if len(g["sample"]) < 4:
                g["sample"].append(ev["id"])
        for (at, kind), g in groups.items():
            events.append({"key": k, "place": place, "at": at, "kind": "lifecycle", "by": None,
                           "detail": {"event": kind, **g}})
    events.sort(key=lambda e: e.get("at") or 0, reverse=True)
    return events[: max(1, min(limit, 1000))]


@router.delete("/scenes/{key}")
async def delete_scene(key: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    _require_editor(user)
    if not key.isalnum() or not os.path.isdir(os.path.join(cache.CACHE_ROOT, key)):
        raise HTTPException(404, "Scene not found")
    if any(j["key"] == key and j["status"] == "RUNNING" for j in jobs.values()):
        raise HTTPException(409, "Generation for this area is still running")
    shutil.rmtree(os.path.join(cache.CACHE_ROOT, key))
    for proj in (await db.execute(select(Project).where(Project.selected_area_id == f"gen:{key}"))).scalars():
        proj.selected_area_id = None
    await db.commit()
    return {"status": "DELETED", "key": key}


class EditRequest(BaseModel):
    ops: list


@router.get("/scenes/{key}/edits")
async def list_edits(key: str, user: User = Depends(get_current_user)):
    _load_scene(key)
    return cache.read_json(key, "edits.json") or []


@router.post("/scenes/{key}/edits")
async def add_edits(key: str, req: EditRequest, user: User = Depends(get_current_user)):
    _require_editor(user)
    _load_scene(key)
    if not req.ops:
        raise HTTPException(422, "No edits")
    try:
        scene = await asyncio.to_thread(scene_ops.add_edits, key, req.ops, user.email)
    except FileNotFoundError:
        raise HTTPException(409, "Regenerate this area once to enable editing (base scene missing)")
    return scene


@router.post("/scenes/{key}/edits/undo")
async def undo_edit(key: str, user: User = Depends(get_current_user)):
    _require_editor(user)
    return await asyncio.to_thread(scene_ops.undo, key)


@router.delete("/scenes/{key}/edits")
async def reset_edits(key: str, user: User = Depends(get_current_user)):
    _require_editor(user)
    return await asyncio.to_thread(scene_ops.reset, key)


@router.get("/scenes/{key}/registry")
async def registry(key: str, q: str = "", limit: int = 50, status: str = "", user: User = Depends(get_current_user)):
    """Reserved 3D ULPINs (VPRIDs). Search by VPRID, ULPIN, building id or name; optionally filter by status."""
    _load_scene(key)
    entries = cache.read_json(key, "registry.json") or []
    hits = [e for e in entries if _registry_match(e, q.strip().lower(), status)]
    return {"total": len(entries), "matches": len(hits), "by_status": _count_status(entries),
            "items": hits[: max(1, min(limit, 500))]}


def _registry_match(e: Dict[str, Any], ql: str, status: str) -> bool:
    if status and e["status"] != status:
        return False
    return not ql or ql in (e["vprid"] or "").lower() or ql in e["ulpin"].lower() or ql == e["building_id"].lower()         or ql in e["building_name"].lower()


def _count_status(entries: List[Dict[str, Any]]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for e in entries:
        out[e["status"]] = out.get(e["status"], 0) + 1
    return out


@router.get("/scenes/{key}/lineage")
async def lineage(key: str, q: str = "", status: str = "", limit: int = 200, user: User = Depends(get_current_user)):
    """Every 3D ULPIN ever minted in this area, including retired and demolished ones, with parents (Section 6)."""
    _load_scene(key)
    led = norms.read_ledger(key)
    ql = q.strip().upper()
    units = [u for u in led["units"] if (not ql or ql in u["id"]) and (not status or u["status"] == status)]
    by_status: Dict[str, int] = {}
    for u in led["units"]:
        by_status[u["status"]] = by_status.get(u["status"], 0) + 1
    units.sort(key=lambda u: (u.get("retired_at") or u["minted_at"]), reverse=True)
    return {"total": len(led["units"]), "by_status": by_status, "items": units[: max(1, min(limit, 1000))]}


@router.get("/scenes/{key}/resolve/{query}")
async def resolve(key: str, query: str, user: User = Depends(get_current_user)):
    """Find what an identifier points to: a VPRID, a ULPIN, or a building id."""
    scene = _load_scene(key)
    entries = cache.read_json(key, "registry.json") or []
    ql = query.strip().lower()
    e = next((x for x in entries if (x["vprid"] or "").lower() == ql), None)
    if e:
        return {"kind": "unit", **e}
    b = next((x for x in scene["buildings"] if x["id"].lower() == ql or (x.get("ulpin") or "").lower() == ql), None)
    if b:
        return {"kind": "building", "building_id": b["id"], "ulpin": b["ulpin"]}
    raise HTTPException(404, f"No VPRID, ULPIN or building matches {query}")


@router.post("/scenes/{key}/excavation")
async def excavation(key: str, req: ExcavationRequest, user: User = Depends(get_current_user)):
    scene = _load_scene(key)
    if req.polygon_local:
        trench = Polygon(req.polygon_local)
    elif req.polygon:
        frame = LocalFrame(lon0=scene["origin"]["lon"], lat0=scene["origin"]["lat"])
        trench = frame.to_local(polygon_from_geojson(req.polygon))
    else:
        raise HTTPException(422, "Provide polygon (lon/lat) or polygon_local (metres)")
    if not isinstance(trench, Polygon) or trench.area <= 0 or not 0 < req.depth_meters <= 40:
        raise HTTPException(422, "Trench must be a polygon")
    result = synth.excavation_check(trench, req.depth_meters, scene["subsurface"])
    result["trench_area_m2"] = round(trench.area, 1)
    return result
