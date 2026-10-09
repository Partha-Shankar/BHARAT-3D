"""Ground elevation from AWS Terrain Tiles (Terrarium encoding, free, no key)."""
from typing import Any, Dict, Tuple

import numpy as np

from app.realgen.tiles import mosaic

TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TERRAIN_ZOOM = 14


def fetch_dem(bbox_lonlat: Tuple[float, float, float, float]) -> np.ndarray:
    rgb = mosaic(lambda z, x, y: TERRARIUM_URL.format(z=z, x=x, y=y), bbox_lonlat, TERRAIN_ZOOM).astype(np.float64)
    dem = rgb[..., 0] * 256.0 + rgb[..., 1] + rgb[..., 2] / 256.0 - 32768.0
    # Missing tiles decode to -32768; replace with the valid median so a gap doesn't create a pit.
    valid = dem > -1000
    if valid.any():
        dem[~valid] = float(np.median(dem[valid]))
    else:
        dem[:] = 0.0
    return dem


def sample(dem: np.ndarray, u: float, v: float) -> float:
    """Bilinear sample at fractional texture coordinates u, v in [0, 1] (v = 0 at the north edge)."""
    h, w = dem.shape
    x = min(max(u * (w - 1), 0), w - 1)
    y = min(max(v * (h - 1), 0), h - 1)
    x0, y0 = int(x), int(y)
    x1, y1 = min(x0 + 1, w - 1), min(y0 + 1, h - 1)
    fx, fy = x - x0, y - y0
    top = dem[y0, x0] * (1 - fx) + dem[y0, x1] * fx
    bot = dem[y1, x0] * (1 - fx) + dem[y1, x1] * fx
    return float(top * (1 - fy) + bot * fy)


def build_grid(dem: np.ndarray, extent_local: Tuple[float, float, float, float], n: int = 48) -> Dict[str, Any]:
    """Regular n x n grid of heights relative to the datum (elevation at the extent centre)."""
    minx, miny, maxx, maxy = extent_local
    datum = sample(dem, 0.5, 0.5)
    rows = []
    for j in range(n):
        v = j / (n - 1)  # row 0 = north edge
        rows.append([round(sample(dem, i / (n - 1), v) - datum, 2) for i in range(n)])
    flat = [h for r in rows for h in r]
    return {
        "extent": [round(minx, 2), round(miny, 2), round(maxx, 2), round(maxy, 2)],
        "n": n,
        "heights": rows,
        "datum_msl_m": round(datum, 2),
        "relief_m": round(max(flat) - min(flat), 2),
        "source": "AWS Terrain Tiles (Terrarium, SRTM/NED blend)",
    }


def height_at(grid: Dict[str, Any], x: float, y: float) -> float:
    minx, miny, maxx, maxy = grid["extent"]
    u = (x - minx) / max(maxx - minx, 1e-6)
    v = (maxy - y) / max(maxy - miny, 1e-6)
    return round(sample(np.asarray(grid["heights"], dtype=np.float64), u, v), 2)
