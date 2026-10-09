"""Building footprints detected in the satellite image where OpenStreetMap has none (pretrained models, no training).

A. GeoAI building model (giswqs/geoai `building_footprints_usa.pth`, a torchvision Mask R-CNN). It was trained on
   ~0.6 m aerial imagery of mostly larger US houses, so it is run at three pixel sizes (0.6, 0.4 and 0.3 m) to make
   smaller Indian roofs look like what it learned. In tests this raised recall from about 50 % to 80 % (Kerala village)
   and from 42 % to 60 % (Pune) against mapped OSM buildings.
B. Text-prompted segmentation: GroundingDINO finds "house / building / roof" boxes and SAM traces each outline. It adds
   roofs that A missed.

Detections overlapping a mapped OSM building are dropped (the mapped one wins). Every result is a *proposal*: under
the 3D ULPIN norms no ULPIN is minted from AI output until a surveyor verifies the footprint.
"""
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from shapely.geometry import Polygon
from shapely.strtree import STRtree

logger = logging.getLogger(__name__)

A_REPO, A_FILE = "giswqs/geoai", "building_footprints_usa.pth"
B_DETECTOR = os.environ.get("AI_BUILDINGS_DETECTOR", "IDEA-Research/grounding-dino-tiny")
B_SEGMENTER = os.environ.get("AI_BUILDINGS_SEGMENTER", "facebook/sam-vit-base")
A_SCALES = (0.6, 0.4, 0.3)  # metres per pixel the image is resampled to for model A
A_MIN_SCORE = 0.5
B_PROMPT = "house. building. roof."
B_MIN_SCORE = 0.33
B_TILE_M = 190.0  # ground metres per GroundingDINO tile (zoomed to 640 px)
MIN_AREA_M2, MAX_AREA_M2 = 15.0, 6000.0
MIN_RECT_RATIO = 0.55  # area / minimum rotated rectangle: rejects trees, shadows and road slivers

_models: Dict[str, Any] = {}


def available() -> Tuple[bool, str]:
    if os.environ.get("REALGEN_DISABLE_ML", "").lower() in {"1", "true", "yes"}:
        return False, "disabled (REALGEN_DISABLE_ML)"
    if os.environ.get("REALGEN_DISABLE_AI_BUILDINGS", "").lower() in {"1", "true", "yes"}:
        return False, "disabled (REALGEN_DISABLE_AI_BUILDINGS)"
    try:
        import cv2  # noqa: F401
        import torch  # noqa: F401
        import torchvision  # noqa: F401
        import transformers  # noqa: F401
    except Exception as exc:
        return False, f"not installed ({exc.__class__.__name__}): pip install -r requirements-ml.txt"
    return True, "ok"


def _load():
    if _models:
        return _models
    import torch
    import torchvision
    from huggingface_hub import hf_hub_download
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor, SamModel, SamProcessor

    torch.set_grad_enabled(False)
    m = torchvision.models.detection.maskrcnn_resnet50_fpn(weights=None, weights_backbone=None, num_classes=2)
    m.load_state_dict(torch.load(hf_hub_download(A_REPO, A_FILE), map_location="cpu"))
    _models["a"] = m.eval()
    _models["gd_proc"] = AutoProcessor.from_pretrained(B_DETECTOR)
    _models["gd"] = AutoModelForZeroShotObjectDetection.from_pretrained(B_DETECTOR).eval()
    _models["sam_proc"] = SamProcessor.from_pretrained(B_SEGMENTER)
    _models["sam"] = SamModel.from_pretrained(B_SEGMENTER).eval()
    return _models


def _tiles(w: int, h: int, size: int, overlap: int):
    step = max(size - overlap, 1)
    xs = list(range(0, max(w - size, 0) + 1, step)) or [0]
    ys = list(range(0, max(h - size, 0) + 1, step)) or [0]
    if xs[-1] + size < w:
        xs.append(max(w - size, 0))
    if ys[-1] + size < h:
        ys.append(max(h - size, 0))
    return [(x, y) for y in ys for x in xs]


def _mask_polys(mask: np.ndarray, ox: float, oy: float, scale: float) -> List[Polygon]:
    import cv2

    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cs:
        if len(c) < 3:
            continue
        g = Polygon([((p[0][0] + ox) * scale, (p[0][1] + oy) * scale) for p in c]).buffer(0)
        if g.geom_type == "MultiPolygon":
            g = max(g.geoms, key=lambda x: x.area)
        if not g.is_empty:
            out.append(g)
    return out


def _nms(dets: List[Tuple[Polygon, float, str]], thr: float = 0.3):
    keep: List[Tuple[Polygon, float, str]] = []
    for g, s, m in sorted([d for d in dets if d[0].area > 0], key=lambda d: -d[1]):
        if all(g.intersection(k).area / min(g.area, k.area) < thr for k, _, _ in keep if g.intersects(k)):
            keep.append((g, s, m))
    return keep


def _run_a(img: np.ndarray, gsd: float) -> List[Tuple[Polygon, float, str]]:
    import cv2
    import torch

    model = _load()["a"]
    dets = []
    for target in A_SCALES:
        f = gsd / target
        small = cv2.resize(img, (max(1, int(img.shape[1] * f)), max(1, int(img.shape[0] * f))),
                           interpolation=cv2.INTER_AREA if f < 1 else cv2.INTER_CUBIC)
        h, w = small.shape[:2]
        for x, y in _tiles(w, h, 512, 96):
            t = torch.from_numpy(np.ascontiguousarray(small[y:y + 512, x:x + 512])).permute(2, 0, 1).float() / 255.0
            r = model([t])[0]
            for s, m in zip(r["scores"].tolist(), r["masks"][:, 0].numpy()):
                if s >= A_MIN_SCORE:
                    dets += [(g, s, "geoai") for g in _mask_polys(m > 0.5, x, y, 1 / f)]
    return _nms(dets)


def _run_b(img: np.ndarray, gsd: float) -> List[Tuple[Polygon, float, str]]:
    import cv2
    from PIL import Image

    ms = _load()
    h, w = img.shape[:2]
    size = max(160, int(B_TILE_M / gsd))
    dets = []
    for x, y in _tiles(w, h, size, size // 7):
        crop = img[y:y + size, x:x + size]
        z = 640 / max(crop.shape[:2])
        tile = Image.fromarray(cv2.resize(crop, (int(crop.shape[1] * z), int(crop.shape[0] * z)), interpolation=cv2.INTER_CUBIC))
        tw, th = tile.size
        inp = ms["gd_proc"](images=tile, text=B_PROMPT, return_tensors="pt")
        res = ms["gd_proc"].post_process_grounded_object_detection(ms["gd"](**inp), inp.input_ids, threshold=B_MIN_SCORE,
                                                                   text_threshold=0.2, target_sizes=[(th, tw)])[0]
        keep = [(b, s) for b, s in zip(res["boxes"].tolist(), res["scores"].tolist())
                if (b[2] - b[0]) * (b[3] - b[1]) < 0.35 * tw * th]  # whole-tile boxes are "the town", not a building
        if not keep:
            continue
        sin = ms["sam_proc"](images=tile, input_boxes=[[b for b, _ in keep]], return_tensors="pt")
        sout = ms["sam"](pixel_values=sin["pixel_values"], input_boxes=sin["input_boxes"], multimask_output=False)
        masks = ms["sam_proc"].post_process_masks(sout.pred_masks, sin["original_sizes"], sin["reshaped_input_sizes"])[0]
        for m, (_, s) in zip(masks[:, 0].numpy(), keep):
            dets += [(g, s, "groundingdino-sam") for g in _mask_polys(m, x * z, y * z, 1 / z)]
    return _nms(dets)


def detect(rgb: np.ndarray, extent_local, survey_local: Polygon, mapped: List[Polygon],
           progress=None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Footprints (scene-local metres) for buildings visible in the image but missing from OSM, plus a report."""
    ok, why = available()
    report: Dict[str, Any] = {"models": [f"{A_REPO}/{A_FILE}", B_DETECTOR, B_SEGMENTER], "applied": False}
    if not ok:
        report["reason"] = why
        return [], report
    t0 = time.time()
    H, W = rgb.shape[:2]
    minx, miny, maxx, maxy = extent_local
    gsd = (maxx - minx) / W
    to_local = lambda g: Polygon([(minx + px * gsd, maxy - py * (maxy - miny) / H) for px, py in g.exterior.coords])  # noqa: E731
    try:
        a = [(to_local(g), s, m) for g, s, m in _run_a(rgb, gsd)]
        if progress:
            progress(f"GeoAI: {len(a)} roofs; GroundingDINO + SAM next")
        b = [(to_local(g), s, m) for g, s, m in _run_b(rgb, gsd)]
    except Exception as exc:
        logger.exception("AI building detection failed")
        report["reason"] = f"model error: {exc}"
        return [], report

    def plausible(g: Polygon) -> bool:
        return (survey_local.contains(g.representative_point()) and MIN_AREA_M2 <= g.area <= MAX_AREA_M2
                and g.area / max(g.minimum_rotated_rectangle.area, 1e-6) >= MIN_RECT_RATIO)

    a = [(g.simplify(0.4), s, m) for g, s, m in a if plausible(g)]
    b = [(g.simplify(0.4), s, m) for g, s, m in b if plausible(g)]
    tree_a = STRtree([g for g, _, _ in a]) if a else None
    fused = list(a) + [d for d in b if tree_a is None or all(
        d[0].intersection(a[i][0]).area / d[0].area < 0.3 for i in tree_a.query(d[0]))]
    # OSM wins: drop anything that overlaps a mapped building
    tree_m = STRtree(mapped) if mapped else None
    out = []
    for g, s, m in fused:
        if tree_m is not None and any(g.intersection(mapped[i]).area / min(g.area, mapped[i].area) >= 0.2 for i in tree_m.query(g)):
            continue
        rect = g.minimum_rotated_rectangle  # roofs are rectilinear: regularise when the fit is close
        if g.area / max(rect.area, 1e-6) > 0.85:
            g = rect
        out.append({"geom": g, "score": round(float(s), 3), "method": m})
    report.update({"applied": True, "geoai": len(a), "groundingdino_sam_added": len(fused) - len(a), "added": len(out),
                   "dropped_overlapping_osm": len(fused) - len(out), "gsd_m": round(gsd, 2), "seconds": round(time.time() - t0, 1)})
    return out, report
