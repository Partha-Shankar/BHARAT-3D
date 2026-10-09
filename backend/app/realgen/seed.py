"""Bundled demo areas: copied into the area cache at startup when missing.

Hosts with an ephemeral disk (Render free) lose generated areas on every restart; the bundled ones come back
automatically, already derived, so they open instantly (including AI-detected buildings computed offline).
"""
import logging
import os
import shutil

from app.realgen import cache

logger = logging.getLogger(__name__)
SEED_ROOT = os.path.abspath(os.environ.get("REALGEN_SEED_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "seed")))


def install_seeds() -> int:
    if not os.path.isdir(SEED_ROOT):
        return 0
    os.makedirs(cache.CACHE_ROOT, exist_ok=True)
    n = 0
    for name in sorted(os.listdir(SEED_ROOT)):
        src = os.path.join(SEED_ROOT, name)
        dst = os.path.join(cache.CACHE_ROOT, name)
        if not os.path.isdir(src):
            continue
        if name == "_registry":  # national INF ledger: only when this host has none yet
            os.makedirs(dst, exist_ok=True)
            for f in os.listdir(src):
                if not os.path.exists(os.path.join(dst, f)):
                    shutil.copy2(os.path.join(src, f), os.path.join(dst, f))
            continue
        if os.path.exists(os.path.join(dst, "scene.json")):
            continue
        shutil.copytree(src, dst, dirs_exist_ok=True)
        n += 1
    if n:
        logger.info("Installed %d bundled demo area(s) from %s", n, SEED_ROOT)
    return n
