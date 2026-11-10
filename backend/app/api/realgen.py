"""Generate a 3D scene from the real geography inside a user-drawn polygon."""
import asyncio
import json
import logging
import os
import shutil
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from shapely.geometry import Polygon, box
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.database import get_db
from app.core.deps import get_current_user
from app.ingest import plan_for_manifest
from app.models.models import Project, User
from app.realgen import cache, fetch_osm, norms, pipeline, progress, scene_ops, store, synth
from app.realgen.geo import LocalFrame, polygon_from_geojson, polygon_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/realgen", tags=["realgen"])

# In-process job registry (single worker). Scenes themselves persist on disk.
jobs: Dict[str, Dict[str, Any]] = {}
_tasks: set = set()
_jobs_lock = threading.Lock()

GEN_ATTEMPTS = 2  # a generation whose map download fails is retried once, after RETRY_PAUSE_S
RETRY_PAUSE_S = 8
JOB_LOG_MAX = 120

# Area pre-check (POST /realgen/preflight). Building counts are OSM buildings touching the drawn polygon, which is
# close to the number of buildings in the generated scene.
PREFLIGHT_WAIT_S = 20.0
DENSE_WARN_BUILDINGS = 450
DENSE_BLOCK_BUILDINGS = 900


class GenerateRequest(BaseModel):
    polygon: Any
    project_id: Optional[Any] = None
    force: bool = False
    datasets: Optional[List[Dict[str, Any]]] = None  # survey package manifest from the ingestion step


class PreflightRequest(BaseModel):
    polygon: Any


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
    if key.isalnum() and not cache.exists(key, "scene.json"):
        store.restore_area(key)  # after a restart the area may only be in R2
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
        datasets = [{k: d.get(k) for k in keep} for d in req.datasets[:20] if isinstance(d, dict)]
        cache.write_json(key, "ingest.json", {"at": time.time(), "by": user.email, "datasets": datasets})
        _write_ingest_plan(key, datasets)

    running = next((j for j in jobs.values() if j["key"] == key and j["status"] == "RUNNING"), None)
    if running and not req.force:
        return {"job_id": running["id"], "key": key, "status": running["status"]}

    job_id = uuid.uuid4().hex[:12]
    job = {"id": job_id, "key": key, "status": "RUNNING", "stage_index": 0, "stage": "Queued", "detail": "",
           "stages": pipeline.STAGES, "progress": 0, "area_m2": round(area_m2), "started_at": time.time(),
           "error": None, "stats": None, "stage_progress": 0.0, "stage_started_s": 0.0, "attempt": 1,
           "log": [], "error_kind": None, "error_detail": None}
    jobs[job_id] = job
    _job_log(job, "Generation queued", "stage")

    def on_progress(i: int, stage: str, detail: str):
        if i == job["stage_index"] and stage == job["stage"]:  # a sub-step of the running stage
            on_note(detail, None)
            return
        job.update(stage_index=i, stage=stage, detail=detail, stage_progress=0.0,
                   stage_started_s=round(time.time() - job["started_at"], 1),
                   progress=min(99, int(i / len(pipeline.STAGES) * 100)))
        _job_log(job, f"{stage} · {detail}" if detail else stage, "stage")

    def on_note(message: str, fraction: Optional[float]):
        """Live detail from a long step (map servers, tile downloads). Counters only update the detail line."""
        if not message:
            return
        job["detail"] = message
        if fraction is not None:
            job["stage_progress"] = round(fraction, 3)
        else:
            _job_log(job, message, "note")

    async def run():
        token = progress.use(on_note)
        try:
            for attempt in range(1, GEN_ATTEMPTS + 1):
                try:
                    scene = await asyncio.to_thread(pipeline.generate, req.polygon, on_progress, req.force)
                    break
                except fetch_osm.SourceUnavailable as exc:
                    if attempt == GEN_ATTEMPTS:
                        raise
                    logger.warning("Map download failed for %s (attempt %s): %s", key, attempt, exc.detail)
                    job["attempt"] = attempt + 1
                    job["detail"] = f"Map servers are busy. Trying again in {RETRY_PAUSE_S} s…"
                    _job_log(job, f"The map servers did not answer. Trying again in {RETRY_PAUSE_S} s "
                                  f"(attempt {attempt + 1} of {GEN_ATTEMPTS}).", "retry")
                    await asyncio.sleep(RETRY_PAUSE_S)
            job.update(status="COMPLETE", progress=100, stage="Complete", stats=scene["stats"],
                       place=scene["place"], summary=scene["summary"])
            _job_log(job, "3D world ready", "done")
        except fetch_osm.SourceUnavailable as exc:
            logger.warning("Generation failed for %s: no map source answered: %s", key, exc.detail)
            job.update(status="FAILED", error=str(exc), error_kind="busy", error_detail=exc.detail)
            _job_log(job, "Stopped: the map servers did not answer", "error")
        except pipeline.AreaError as exc:
            job.update(status="FAILED", error=str(exc), error_kind="area")
            _job_log(job, f"Stopped: {exc}", "error")
        except Exception as exc:
            logger.exception("Generation failed for %s", key)
            job.update(status="FAILED", error=str(exc), error_kind="internal")
            _job_log(job, "Stopped by an unexpected error", "error")
        finally:
            progress.reset(token)

    task = asyncio.create_task(run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "key": key, "status": "RUNNING"}


def _write_ingest_plan(key: str, datasets: List[Dict[str, Any]]) -> None:
    """Pseudo-code processing plan for the survey package (app/ingest), next to ingest.json. Best effort:
    generation never fails because of it."""
    try:
        cache.write_json(key, "ingest_plan.json", [p.to_dict() for p in plan_for_manifest(datasets)])
    except Exception:
        logger.exception("Could not write the ingest plan for %s; generation continues", key)


def _job_log(job: Dict[str, Any], message: str, kind: str) -> None:
    """Append to the job's live activity log (shown on the generation page); repeated lines are skipped."""
    with _jobs_lock:
        log = job["log"]
        if log and log[-1]["msg"] == message:
            return
        log.append({"t": round(time.time() - job["started_at"], 1), "msg": message, "kind": kind})
        if len(log) > JOB_LOG_MAX:
            del log[1:len(log) - JOB_LOG_MAX + 1]  # keep the first line


@router.get("/jobs/{job_id}")
async def job_status(job_id: str, user: User = Depends(get_current_user)):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    with _jobs_lock:
        snapshot = {**job, "log": list(job["log"])}
    return {**snapshot, "elapsed_s": round(time.time() - job["started_at"], 1)}


def _fetch_box(poly: Polygon) -> Polygon:
    """The box the generation downloads OpenStreetMap data for (pipeline.generate: bounds +/- MARGIN_DEG), so the
    pre-check's download is reused by the generation."""
    m = pipeline.MARGIN_DEG
    minx, miny, maxx, maxy = poly.bounds
    return Polygon(box(minx - m, miny - m, maxx + m, maxy + m).exterior.coords)


def estimate_seconds(buildings: int) -> int:
    """Rough generation time on the free backend: fixed downloads plus per-building work."""
    return int(45 + 0.3 * buildings)


def _duration_text(seconds: int) -> str:
    return "about a minute" if seconds < 90 else f"about {round(seconds / 60)} minutes"


def _verdict(level: str, reason: str, message: str, **extra: Any) -> Dict[str, Any]:
    return {"level": level, "reason": reason, "message": message, **extra}


@router.post("/preflight")
async def preflight(req: PreflightRequest, user: User = Depends(get_current_user)):
    """Check a drawn area before the survey continues: size limits, India, already generated, and how dense it is.

    ``level``: ``ok`` (go ahead), ``warn`` (large: it works but is slow; the user decides), ``block`` (cannot be
    generated: draw again) or ``busy`` (the map servers are not answering: check again shortly). It also starts the
    area's OpenStreetMap download, which the generation then reuses.
    """
    try:
        poly = polygon_from_geojson(req.polygon)
    except Exception as exc:
        return _verdict("block", "invalid", f"This shape cannot be used as a survey area ({exc}).")
    try:
        area_m2 = pipeline.validate_area(poly)
    except pipeline.AreaError as exc:
        return _verdict("block", "size", str(exc))
    key = polygon_key(poly)
    base = {"key": key, "area_m2": round(area_m2)}
    if cache.exists(key, "scene.json"):
        return _verdict("ok", "exists", "This exact area has been generated before, so it will open instantly.",
                        cached=True, **base)
    reason = await asyncio.to_thread(fetch_osm.india_check, poly)
    if reason:
        return _verdict("block", "outside_india", reason, **base)

    raw = cache.read_json(key, "osm_raw.json")
    if raw is None:
        pending = fetch_osm.start_fetch(_fetch_box(poly))
        try:
            raw = await asyncio.to_thread(pending.result, PREFLIGHT_WAIT_S)
        except TimeoutError:
            return _verdict("ok", "pending", "The map data is still downloading. It carries on in the background "
                            "while you attach the survey package.", **base)
        except fetch_osm.SourceUnavailable as exc:
            return _verdict("busy", "osm_unavailable", str(exc), detail=exc.detail, **base)
        except Exception:
            logger.exception("Area pre-check could not read the map data for %s", key)
            return _verdict("ok", "unchecked", "The area could not be measured in advance; generation will try "
                            "again.", **base)

    feats = await asyncio.to_thread(fetch_osm.parse_elements, raw)
    buildings = sum(1 for b in feats["buildings"] if b["geom"].intersects(poly))
    roads = sum(1 for r in feats["roads"] if r["geom"].intersects(poly))
    eta = estimate_seconds(buildings)
    counts = {"buildings": buildings, "roads": roads, "eta_s": eta, **base}
    if buildings > DENSE_BLOCK_BUILDINGS:
        share = max(10, int(DENSE_BLOCK_BUILDINGS * 0.8 / buildings * 100) // 5 * 5)
        return _verdict("block", "too_dense", f"This area is too dense to generate in one go: {buildings:,} "
                        f"buildings (the limit is {DENSE_BLOCK_BUILDINGS:,}). Draw a smaller area, about {share}% of "
                        f"this one, or split it into parts.", **counts)
    if buildings >= DENSE_WARN_BUILDINGS:
        return _verdict("warn", "dense", f"This is a dense area: {buildings:,} buildings and {roads:,} road "
                        f"segments. It can be generated, but it will take {_duration_text(eta)}. A smaller area is "
                        f"faster.", **counts)
    if buildings == 0:
        message = ("No buildings are mapped here in OpenStreetMap, so the 3D model will show mostly open land "
                   f"and roads. It should be ready in {_duration_text(eta)}.")
    else:
        message = (f"{buildings:,} buildings and {roads:,} road segments found. The 3D model should be ready in "
                   f"{_duration_text(eta)}.")
    return _verdict("ok", "measured", message, **counts)


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
async def get_building(key: str, building_id: str, response: Response, user: User = Depends(get_current_user)):
    detail = scene_ops.building_detail(_load_scene(key), building_id)
    if detail is None:
        raise HTTPException(404, "Building not found")
    view = access.view_of(user)
    response.headers[access.VIEW_HEADER] = view
    return access.redact_building_detail(detail, view)  # surveyor/admin: the same object, untouched


async def _editor_labels(db: AsyncSession, emails: set) -> Dict[str, str]:
    """E-mail -> role label for the given editors. Unknown e-mails are left out (the redactor labels them
    generically); a failed lookup never fails the request."""
    if not emails:
        return {}
    try:
        rows = (await db.execute(select(User.email, User.role).where(User.email.in_(sorted(emails))))).all()
    except Exception:
        logger.exception("Editor role lookup failed; serving generic editor labels")
        return {}
    return {email: access.role_label(role) for email, role in rows}


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
async def activity(response: Response, key: Optional[str] = None, limit: int = 200,
                   user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Append-only history: area generation, survey packages ingested, and every surveyor edit."""
    events = _activity_events(key, limit)
    view = access.view_of(user)
    response.headers[access.VIEW_HEADER] = view
    if view == access.FULL:
        return events
    return access.redact_activity(events, view, await _editor_labels(db, access.editor_emails(events)))


def _activity_events(key: Optional[str], limit: int) -> List[Dict[str, Any]]:
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
    store.delete_area(key)
    for proj in (await db.execute(select(Project).where(Project.selected_area_id == f"gen:{key}"))).scalars():
        proj.selected_area_id = None
    await db.commit()
    return {"status": "DELETED", "key": key}


class EditRequest(BaseModel):
    ops: list


@router.get("/scenes/{key}/edits")
async def list_edits(key: str, response: Response, user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    _load_scene(key)
    edits = cache.read_json(key, "edits.json") or []
    view = access.view_of(user)
    response.headers[access.VIEW_HEADER] = view
    if view == access.FULL:
        return edits
    return access.redact_edits(edits, view, await _editor_labels(db, access.editor_emails(edits)))


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


@router.get("/scenes/{key}/ingest-plan")
async def ingest_plan(key: str, user: User = Depends(get_current_user)):
    """How the survey package attached to this area would be processed (pseudo-code readers; nothing executed).
    [] when no package was attached. Areas generated before plans existed get one derived from their stored manifest
    on the fly (nothing is written)."""
    _load_scene(key)
    stored = cache.read_json(key, "ingest_plan.json")
    if stored is not None:
        return stored
    ingest = cache.read_json(key, "ingest.json") or {}
    try:
        return [p.to_dict() for p in plan_for_manifest(ingest.get("datasets") or [])]
    except Exception:
        logger.exception("Could not derive the ingest plan for %s", key)
        return []


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
