"""Height estimation for untagged buildings with a pretrained monocular depth model (no training).

Depth Anything V2 gives *relative* depth for the satellite mosaic. Roofs read closer than the ground
around them, so roof-minus-surroundings depth is a height proxy. It is turned into metres per scene by a
linear fit against buildings whose height OSM already records. If that fit is weak, nothing is changed.
"""
import logging
import os
import threading
from typing import Any, Dict, List

import numpy as np
from PIL import Image, ImageDraw

from app.realgen.fuse import FLOOR_HEIGHT_M
from app.realgen.imagery import local_to_px

logger = logging.getLogger(__name__)

MODEL_ID = os.environ.get("DEPTH_MODEL_ID", "depth-anything/Depth-Anything-V2-Small-hf")
MIN_CALIBRATION = 8
MIN_R2 = 0.35
_pipe = None
_lock = threading.Lock()


def available() -> bool:
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
        return os.environ.get("REALGEN_DISABLE_ML", "").lower() not in {"1", "true", "yes"}
    except Exception:
        return False


def _get_pipeline():
    global _pipe
    with _lock:
        if _pipe is None:
            from transformers import pipeline

            _pipe = pipeline("depth-estimation", model=MODEL_ID, device=-1)
        return _pipe


def depth_map(rgb: np.ndarray, max_side: int = 1024) -> np.ndarray:
    img = Image.fromarray(rgb)
    scale = min(1.0, max_side / max(img.size))
    if scale < 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.BILINEAR)
    out = _get_pipeline()(img)
    pred = out["predicted_depth"]
    arr = pred.squeeze().detach().cpu().numpy().astype(np.float32)
    # Resize to the (possibly downscaled) image size, then normalise to 0..1.
    resized = np.asarray(Image.fromarray(arr, mode="F").resize(img.size, Image.BILINEAR))
    lo, hi = np.percentile(resized, 1), np.percentile(resized, 99)
    return np.clip((resized - lo) / max(hi - lo, 1e-6), 0, 1)


def _mask(shape_hw, polygon_px) -> np.ndarray:
    m = Image.new("L", (shape_hw[1], shape_hw[0]), 0)
    if len(polygon_px) >= 3:
        ImageDraw.Draw(m).polygon(polygon_px, fill=1)
    return np.asarray(m, dtype=bool)


def roof_relief(depth: np.ndarray, geom, extent_local) -> float | None:
    """Median depth on the roof minus median depth in a 4-10 m ring around it."""
    h, w = depth.shape

    def to_px(g):
        return [local_to_px(x, y, extent_local, w, h) for x, y in g.exterior.coords]

    ring = geom.buffer(10).difference(geom.buffer(4))
    if ring.is_empty or ring.geom_type != "Polygon":
        ring = geom.buffer(10).difference(geom.buffer(4)).convex_hull.difference(geom.buffer(4))
    if ring.is_empty or ring.geom_type != "Polygon":
        return None
    roof = depth[_mask((h, w), to_px(geom))]
    ring_mask = _mask((h, w), to_px(ring)) & ~_mask((h, w), to_px(geom.buffer(4)))
    around = depth[ring_mask]
    if roof.size < 4 or around.size < 4:
        return None
    return float(np.median(roof) - np.median(around))


def estimate_heights(buildings: List[Dict[str, Any]], rgb: np.ndarray, extent_local) -> Dict[str, Any]:
    """Updates buildings in place; returns a report for the scene stats."""
    report: Dict[str, Any] = {"model": MODEL_ID, "applied": False}
    if not available():
        report["reason"] = "torch/transformers not installed"
        return report
    try:
        depth = depth_map(rgb)
    except Exception as exc:
        logger.exception("Depth model failed")
        report["reason"] = f"model error: {exc}"
        return report

    for b in buildings:
        b["_relief"] = roof_relief(depth, b["geom"], extent_local)

    known = [b for b in buildings if b["height_source"].startswith("osm") and b["_relief"] is not None]
    report["calibration_buildings"] = len(known)
    if len(known) < MIN_CALIBRATION:
        report["reason"] = f"only {len(known)} buildings with surveyed heights to calibrate (need {MIN_CALIBRATION})"
        return report

    x = np.array([b["_relief"] for b in known])
    y = np.array([b["height"] for b in known])
    slope, intercept = np.polyfit(x, y, 1)
    pred = slope * x + intercept
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2)) or 1.0
    r2 = 1 - ss_res / ss_tot
    report.update({"r2": round(r2, 3), "mae_m": round(float(np.mean(np.abs(y - pred))), 2),
                   "slope": round(float(slope), 3), "intercept": round(float(intercept), 3)})
    # The sign of relief vs height depends on how the model reads overhead shadows; only fit quality matters.
    if r2 < MIN_R2:
        report["reason"] = f"calibration too weak (R²={r2:.2f}); kept typology estimates"
        return report

    cap = max(float(y.max()) * 1.3, 15.0)
    changed = 0
    for b in buildings:
        if b["height_source"].startswith("estimated") and b["_relief"] is not None:
            h = float(np.clip(slope * b["_relief"] + intercept, FLOOR_HEIGHT_M, cap))
            b["height"] = round(b["min_height"] + h, 2)
            b["floors"] = max(1, round(h / FLOOR_HEIGHT_M))
            b["height_source"] = "ml:depth-anything-v2"
            changed += 1
    report.update({"applied": True, "buildings_estimated": changed})
    return report
