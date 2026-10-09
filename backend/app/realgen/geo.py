import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any, Iterable, List, Sequence, Tuple

from pyproj import Transformer
from shapely.geometry import Polygon, shape, mapping
from shapely.ops import transform

MAX_AREA_M2 = 500_000.0
MIN_AREA_M2 = 2_000.0


def polygon_from_geojson(geojson: Any) -> Polygon:
    """Accept a Feature, a geometry, or a bare ring of [lon, lat] pairs."""
    if isinstance(geojson, str):
        geojson = json.loads(geojson)
    if isinstance(geojson, list):
        geojson = {"type": "Polygon", "coordinates": [geojson]}
    if geojson.get("type") == "Feature":
        geojson = geojson["geometry"]
    if geojson.get("type") == "FeatureCollection":
        geojson = geojson["features"][0]["geometry"]
    geom = shape(geojson)
    if geom.geom_type == "MultiPolygon":
        geom = max(geom.geoms, key=lambda g: g.area)
    if geom.geom_type != "Polygon":
        raise ValueError(f"Expected a polygon, got {geom.geom_type}")
    if not geom.is_valid:
        geom = geom.buffer(0)
    return geom


def polygon_key(poly: Polygon) -> str:
    coords = [[round(x, 6), round(y, 6)] for x, y in poly.exterior.coords]
    return hashlib.sha1(json.dumps(coords).encode()).hexdigest()[:16]


@dataclass
class LocalFrame:
    """Azimuthal-equidistant frame centred on the survey polygon: x = metres east, y = metres north."""

    lon0: float
    lat0: float

    def __post_init__(self):
        proj = f"+proj=aeqd +lat_0={self.lat0} +lon_0={self.lon0} +datum=WGS84 +units=m +no_defs"
        self._fwd = Transformer.from_crs("EPSG:4326", proj, always_xy=True)
        self._inv = Transformer.from_crs(proj, "EPSG:4326", always_xy=True)

    @classmethod
    def for_polygon(cls, poly: Polygon) -> "LocalFrame":
        c = poly.centroid
        return cls(lon0=c.x, lat0=c.y)

    def to_local(self, geom):
        return transform(self._fwd.transform, geom)

    def to_lonlat(self, geom):
        return transform(self._inv.transform, geom)

    def point_to_local(self, lon: float, lat: float) -> Tuple[float, float]:
        return self._fwd.transform(lon, lat)

    def point_to_lonlat(self, x: float, y: float) -> Tuple[float, float]:
        return self._inv.transform(x, y)


def ring_coords(geom, ndigits: int = 2) -> List[List[float]]:
    """Exterior ring as [[x, y], ...] without the closing duplicate, counter-clockwise."""
    from shapely.geometry.polygon import orient

    g = orient(geom, sign=1.0)
    pts = list(g.exterior.coords)[:-1]
    return [[round(x, ndigits), round(y, ndigits)] for x, y in pts]


def line_coords(geom, ndigits: int = 2) -> List[List[float]]:
    return [[round(x, ndigits), round(y, ndigits)] for x, y in geom.coords]


def stable_int(*parts: Any) -> int:
    """Deterministic integer from arbitrary parts (Python's hash() is salted per process)."""
    h = hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()
    return int(h[:12], 16)


def bbox_lonlat(poly: Polygon, margin_deg: float = 0.0) -> Tuple[float, float, float, float]:
    minx, miny, maxx, maxy = poly.bounds
    return minx - margin_deg, miny - margin_deg, maxx + margin_deg, maxy + margin_deg
