"""Satellite mosaic from Esri World Imagery, used as the ground texture and as model input."""
from typing import Any, Dict, Tuple

import numpy as np
from PIL import Image

from app.realgen.tiles import lonlat_to_global_px, mosaic

ESRI_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community"
MAX_PX = 2048


def choose_zoom(bbox: Tuple[float, float, float, float]) -> int:
    for z in (19, 18, 17, 16):
        x0, y0 = lonlat_to_global_px(bbox[0], bbox[3], z)
        x1, y1 = lonlat_to_global_px(bbox[2], bbox[1], z)
        if max(x1 - x0, y1 - y0) <= MAX_PX:
            return z
    return 16


def placeholder_fraction(rgb: np.ndarray) -> float:
    """Share of the mosaic covered by Esri's flat grey "Map data not yet available" tiles (RGB ~204)."""
    a = rgb.astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return float(((abs(r - g) < 6) & (abs(g - b) < 6) & (r >= 196) & (r <= 212)).mean())


def fetch_imagery(bbox: Tuple[float, float, float, float], out_path: str) -> Dict[str, Any]:
    """Highest zoom that fits MAX_PX and actually has imagery; rural tiles often stop at z17 or below."""
    z = choose_zoom(bbox)
    while True:
        rgb = mosaic(lambda zz, x, y: ESRI_URL.format(z=zz, x=x, y=y), bbox, z)
        if z <= 14 or placeholder_fraction(rgb) < 0.25:
            break
        z -= 1
    Image.fromarray(rgb).save(out_path, "JPEG", quality=85)
    return {"zoom": z, "width": int(rgb.shape[1]), "height": int(rgb.shape[0]), "attribution": ATTRIBUTION, "array": rgb}


def local_to_px(x: float, y: float, extent_local, width: int, height: int) -> Tuple[float, float]:
    minx, miny, maxx, maxy = extent_local
    return (x - minx) / (maxx - minx) * width, (maxy - y) / (maxy - miny) * height
