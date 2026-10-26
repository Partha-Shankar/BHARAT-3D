"""Durable storage for generated areas in Cloudflare R2, through the web app's Pages Function.

Free hosts (Render, Hugging Face Spaces) wipe their disk on restart. After every change to an area (generation,
edit, undo, reset, re-derivation) its files are copied to R2; deletion removes them. On startup, and whenever an
unknown area is requested, missing areas are restored from R2. Uploads go through `STORE_URL` (the Pages Function
`/api/__store`, which holds the R2 binding) with a shared `STORE_TOKEN`; no R2 credentials live on the server.
Disabled when either variable is unset (local development).
"""
import hashlib
import logging
import os
import threading
from typing import Dict, List, Optional

import httpx

from app.realgen import cache

logger = logging.getLogger(__name__)
STORE_URL = os.environ.get("STORE_URL", "").rstrip("/")
STORE_TOKEN = os.environ.get("STORE_TOKEN", "")
AREA_FILES = ("scene_base.json", "scene.json", "registry.json", "meta.json", "ids.json", "edits.json", "ingest.json",
              "osm_raw.json", "texture.jpg", "context.jpg")
_sent: Dict[str, str] = {}  # path -> sha1 of what R2 already holds (skips re-uploading unchanged imagery)
_lock = threading.Lock()


def enabled() -> bool:
    return bool(STORE_URL and STORE_TOKEN)


def _client() -> httpx.Client:
    return httpx.Client(timeout=60, headers={"X-Store-Token": STORE_TOKEN})


def _digest(path: str) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def push_area(key: str) -> int:
    """Copy an area's changed files (and the national INF ledger) to R2. Returns the number uploaded."""
    if not enabled() or not key.isalnum():
        return 0
    n = 0
    files = [(key, f) for f in AREA_FILES] + [("_registry", "inf_ledger.json")]
    with _lock, _client() as c:
        for folder, name in files:
            path = os.path.join(cache.CACHE_ROOT, folder, name)
            if not os.path.exists(path):
                continue
            d = _digest(path)
            if _sent.get(f"{folder}/{name}") == d:
                continue
            with open(path, "rb") as fh:
                r = c.put(f"{STORE_URL}/{folder}/{name}", content=fh.read())
            if r.status_code >= 300:
                logger.warning("store push %s/%s failed: %s", folder, name, r.status_code)
                continue
            _sent[f"{folder}/{name}"] = d
            n += 1
    return n


def delete_area(key: str) -> None:
    if not enabled() or not key.isalnum():
        return
    with _lock, _client() as c:
        r = c.delete(f"{STORE_URL}/{key}")
        if r.status_code >= 300:
            logger.warning("store delete %s failed: %s", key, r.status_code)
    for k in [k for k in _sent if k.startswith(f"{key}/")]:
        _sent.pop(k, None)


def list_remote() -> Dict[str, List[str]]:
    """{"areas": keys held in R2, "deleted": keys deleted by a surveyor (bundled copies must not come back)}."""
    if not enabled():
        return {"areas": [], "deleted": []}
    with _client() as c:
        r = c.get(STORE_URL)
        r.raise_for_status()
        d = r.json()
        return {"areas": [k for k in d.get("areas", []) if k.isalnum() or k == "_registry"],
                "deleted": [k for k in d.get("deleted", []) if k.isalnum()]}


def restore_area(key: str, client: Optional[httpx.Client] = None) -> bool:
    """Download an area from R2 if it is not on this disk. Returns True if it is available afterwards."""
    if key != "_registry" and os.path.exists(os.path.join(cache.CACHE_ROOT, key, "scene.json")):
        return True
    if not enabled() or not (key.isalnum() or key == "_registry"):
        return False
    own = client is None
    c = client or _client()
    got = 0
    try:
        names = AREA_FILES if key != "_registry" else ("inf_ledger.json",)
        for name in names:
            r = c.get(f"{STORE_URL}/{key}/{name}")
            if r.status_code != 200:
                continue
            os.makedirs(os.path.join(cache.CACHE_ROOT, key), exist_ok=True)
            path = os.path.join(cache.CACHE_ROOT, key, name)
            with open(path + ".tmp", "wb") as f:
                f.write(r.content)
            os.replace(path + ".tmp", path)
            _sent[f"{key}/{name}"] = hashlib.sha1(r.content).hexdigest()
            got += 1
    finally:
        if own:
            c.close()
    return got > 0 and (key == "_registry" or os.path.exists(os.path.join(cache.CACHE_ROOT, key, "scene.json")))


def startup() -> Dict[str, List[str]]:
    """Before the bundled seeds are installed: restore the national INF ledger (R2 is always the latest copy) and
    report which areas R2 holds or has deleted, so the seeds never overwrite them."""
    if not enabled():
        return {"areas": [], "deleted": []}
    try:
        remote = list_remote()
        if "_registry" in remote["areas"]:
            restore_area("_registry")
        return remote
    except Exception:
        logger.exception("Reading the area store failed; continuing with local data")
        return {"areas": [], "deleted": []}


def restore_all(keys: List[str]) -> int:
    """Restore the given areas from R2 when this disk lacks them (run in the background at startup)."""
    n = 0
    try:
        with _client() as c:
            for key in keys:
                if key != "_registry" and restore_area(key, c):
                    n += 1
        logger.info("Restored %d area(s) from R2", n)
    except Exception:
        logger.exception("Restoring areas from R2 failed")
    return n


def push_in_background(key: str) -> None:
    threading.Thread(target=lambda: _safe(push_area, key), daemon=True).start()


def _safe(fn, *a):
    try:
        fn(*a)
    except Exception:
        logger.exception("store %s failed", fn.__name__)
