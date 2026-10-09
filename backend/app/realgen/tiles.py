"""Fetch and stitch XYZ raster tiles (Web Mercator) into a numpy mosaic cropped to a lon/lat box."""
import io
import logging
import math
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Tuple

import httpx
import numpy as np
from PIL import Image

from app.realgen.fetch_osm import USER_AGENT

logger = logging.getLogger(__name__)
TILE = 256


def lonlat_to_global_px(lon: float, lat: float, z: int) -> Tuple[float, float]:
    n = 2 ** z * TILE
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(max(min(lat, 85.0511), -85.0511))
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def mosaic(
    url_for: Callable[[int, int, int], str],
    bbox: Tuple[float, float, float, float],
    z: int,
    mode: str = "RGB",
) -> np.ndarray:
    """Return the mosaic cropped exactly to bbox (minlon, minlat, maxlon, maxlat)."""
    minlon, minlat, maxlon, maxlat = bbox
    x0, y0 = lonlat_to_global_px(minlon, maxlat, z)
    x1, y1 = lonlat_to_global_px(maxlon, minlat, z)
    tx0, ty0, tx1, ty1 = int(x0 // TILE), int(y0 // TILE), int(x1 // TILE), int(y1 // TILE)
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    channels = 3 if mode == "RGB" else 4
    canvas = np.zeros((rows * TILE, cols * TILE, channels), dtype=np.uint8)

    def fetch(tx: int, ty: int):
        try:
            with httpx.Client(timeout=30, headers={"User-Agent": USER_AGENT}) as client:
                resp = client.get(url_for(z, tx, ty))
            if resp.status_code == 200:
                img = Image.open(io.BytesIO(resp.content)).convert(mode)
                return tx, ty, np.asarray(img)
            logger.warning("Tile %s/%s/%s -> HTTP %s", z, tx, ty, resp.status_code)
        except Exception as exc:
            logger.warning("Tile %s/%s/%s failed: %s", z, tx, ty, exc)
        return tx, ty, None

    jobs = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for tx, ty, arr in pool.map(lambda j: fetch(*j), jobs):
            if arr is not None and arr.shape[0] == TILE and arr.shape[1] == TILE:
                r, c = ty - ty0, tx - tx0
                canvas[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE] = arr

    ox, oy = tx0 * TILE, ty0 * TILE
    return canvas[int(y0 - oy):int(math.ceil(y1 - oy)), int(x0 - ox):int(math.ceil(x1 - ox))]
