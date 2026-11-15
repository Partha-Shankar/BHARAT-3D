"""Keep the free Render instance from falling asleep.

Render's free plan stops an instance after 15 minutes without inbound requests. Waking it again is unreliable for
this site: requests that arrive through the website's Cloudflare proxy get an instant 502 from Render and often do
not start the instance (measured 2026-11-15: no start for 25+ minutes, while one direct request started it in 24 s).
So once running, the instance requests its own public address every 10 minutes, which counts as inbound traffic.

One free service running all month uses at most 744 of the account's 750 free instance hours. Runs only on Render
(it sets RENDER and RENDER_EXTERNAL_URL); set KEEP_AWAKE=0 to turn it off.
"""
from __future__ import annotations

import logging
import os
import threading
import time

import httpx

logger = logging.getLogger(__name__)

INTERVAL_S = 600  # well inside Render's 15-minute idle limit
_started = False
_lock = threading.Lock()


def target() -> str | None:
    """The public health URL to request, or None when this is not a Render instance or it is turned off."""
    if os.environ.get("KEEP_AWAKE", "1").strip().lower() in ("0", "false", "no", "off"):
        return None
    if os.environ.get("RENDER", "").lower() != "true":
        return None
    base = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
    return f"{base}/health" if base.startswith("https://") else None


def ping(url: str, client: httpx.Client | None = None) -> int | None:
    """One request to our own public address. Returns the status, or None when it failed (never raises)."""
    try:
        if client is not None:
            return client.get(url).status_code
        with httpx.Client(timeout=httpx.Timeout(60.0, connect=15.0), headers={"User-Agent": "bharat3d-keepawake"}) as c:
            return c.get(url).status_code
    except Exception as exc:  # network trouble: try again next round
        logger.warning("Keep-awake request failed: %s", exc)
        return None


def _loop(url: str, stop: threading.Event) -> None:
    while not stop.wait(INTERVAL_S):
        t0 = time.monotonic()
        status = ping(url)
        if status == 200:
            logger.info("Keep-awake: 200 in %.2f s", time.monotonic() - t0)  # proof in the logs that it runs
        elif status is not None:
            logger.warning("Keep-awake request answered %s", status)


def start(stop: threading.Event | None = None) -> bool:
    """Start the background loop once per process. Returns True if it is running."""
    global _started
    url = target()
    if url is None:
        return False
    with _lock:
        if _started:
            return True
        _started = True
    threading.Thread(target=_loop, args=(url, stop or threading.Event()), name="keep-awake", daemon=True).start()
    logger.info("Keep-awake: requesting %s every %d s", url, INTERVAL_S)
    return True
