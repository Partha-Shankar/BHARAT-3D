"""OpenStreetMap features for a polygon via the Overpass API."""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List

import httpx
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

logger = logging.getLogger(__name__)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
USER_AGENT = "BHARAT3D-prototype/0.2 (3D cadastre research; contact via github.com/Partha-Shankar/BHARAT-3D)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


def build_query(poly: Polygon) -> str:
    """One query for everything inside the bounding box (bbox filters are much cheaper than poly filters)."""
    minx, miny, maxx, maxy = poly.bounds
    bb = f"{miny:.7f},{minx:.7f},{maxy:.7f},{maxx:.7f}"
    return f"""
[out:json][timeout:90][bbox:{bb}];
(
  way["building"];
  relation["building"];
  way["highway"];
  way["railway"];
  way["natural"="water"];
  way["waterway"];
  way["leisure"~"^(park|garden|pitch|playground|stadium)$"];
  way["landuse"~"^(grass|forest|recreation_ground|meadow|village_green|cemetery|construction)$"];
  relation["landuse"="construction"];
  node["natural"="tree"];
  way["power"~"^(cable|line|minor_line)$"];
  way["man_made"="pipeline"];
  node["railway"~"^(station|subway_entrance|halt)$"];
  node["public_transport"="station"];
);
out geom;
"""


def _overpass_post(url: str, query: str, timeout: float) -> Dict[str, Any]:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    with httpx.Client(timeout=timeout, headers=headers) as client:
        resp = client.post(url, data={"data": query})
    if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("application/json"):
        return resp.json()
    raise RuntimeError(f"{url} -> HTTP {resp.status_code}")


def _race(urls: List[str], query: str, timeout: float) -> Dict[str, Any]:
    """Ask several Overpass servers at once and keep the first good answer."""
    errors: List[str] = []
    pool = ThreadPoolExecutor(max_workers=len(urls))
    futures = {pool.submit(_overpass_post, u, query, timeout): u for u in urls}
    try:
        for fut in as_completed(futures):
            try:
                return fut.result()
            except Exception as exc:  # network / timeout / rate limit: wait for the others
                errors.append(f"{futures[fut]}: {exc}")
                logger.warning("Overpass attempt failed: %s", errors[-1])
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    raise RuntimeError("; ".join(errors) or "no server answered")


def fetch_overpass(poly: Polygon) -> Dict[str, Any]:
    """Race the main instance and the mail.ru mirror; if both fail, race the remaining mirrors and the main once more."""
    query = build_query(poly)
    try:
        return _race(OVERPASS_ENDPOINTS[:2], query, 70)
    except Exception as first:
        time.sleep(2)
        try:
            return _race(OVERPASS_ENDPOINTS[2:] + OVERPASS_ENDPOINTS[:1], query, 60)
        except Exception as second:
            raise RuntimeError(f"Overpass API unavailable (OpenStreetMap servers busy). Try again in a minute. [{first}; {second}]")


def reverse_geocode(lon: float, lat: float) -> Dict[str, Any]:
    """Locality name for the survey centroid (best effort)."""
    try:
        with httpx.Client(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
            resp = client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 16, "addressdetails": 1},
            )
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            locality = (
                addr.get("neighbourhood")
                or addr.get("suburb")
                or addr.get("quarter")
                or addr.get("city_district")
                or addr.get("village")
                or addr.get("town")
                or "Survey area"
            )
            return {
                "locality": locality,
                "city": addr.get("city") or addr.get("town") or addr.get("state_district") or "",
                "state": addr.get("state", ""),
                "state_code": (addr.get("ISO3166-2-lvl4") or "IN-XX").split("-")[-1],
                "display_name": data.get("display_name", ""),
                "country_code": (addr.get("country_code") or "").lower(),
            }
    except Exception as exc:
        logger.warning("Reverse geocode failed: %s", exc)
    return {"locality": "Survey area", "city": "", "state": "", "state_code": "XX", "display_name": "", "country_code": ""}


INDIA_BBOX = (68.0, 6.4, 97.5, 37.2)  # lon/lat envelope used as a fast pre-check


def india_check(poly) -> str | None:
    """None if the polygon is in India, else a user-facing reason. Uses Nominatim for the authoritative check."""
    minx, miny, maxx, maxy = poly.bounds
    if minx < INDIA_BBOX[0] or maxx > INDIA_BBOX[2] or miny < INDIA_BBOX[1] or maxy > INDIA_BBOX[3]:
        return "BHARAT 3D works only inside India. Draw the survey area within India."
    c = poly.centroid
    place = reverse_geocode(c.x, c.y)
    if place.get("country_code") == "in":
        return None
    if place.get("country_code"):
        return f"This area is outside India ({place.get('display_name', '').split(',')[-1].strip() or place['country_code'].upper()}). BHARAT 3D works only inside India."
    return "Could not confirm this area is in India (it may be over the sea, or the geocoder is unavailable). Try again or move the area onto land."


def _way_line(el: Dict[str, Any]) -> LineString | None:
    geom = el.get("geometry") or []
    if len(geom) < 2:
        return None
    return LineString([(p["lon"], p["lat"]) for p in geom])


def _way_polygon(el: Dict[str, Any]) -> Polygon | None:
    geom = el.get("geometry") or []
    if len(geom) < 4:
        return None
    pts = [(p["lon"], p["lat"]) for p in geom]
    if pts[0] != pts[-1]:
        return None
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly if not poly.is_empty and poly.geom_type == "Polygon" else None


def _relation_polygon(el: Dict[str, Any]):
    outers, inners = [], []
    for m in el.get("members", []):
        if m.get("type") != "way" or not m.get("geometry"):
            continue
        line = LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
        (inners if m.get("role") == "inner" else outers).append(line)
    if not outers:
        return None
    shell = unary_union(list(polygonize(outers)))
    if inners:
        holes = unary_union(list(polygonize(inners)))
        shell = shell.difference(holes)
    if shell.is_empty:
        return None
    if shell.geom_type == "MultiPolygon":
        shell = max(shell.geoms, key=lambda g: g.area)
    return shell if shell.geom_type == "Polygon" else None


def parse_elements(data: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """Split Overpass elements into typed feature lists (lon/lat shapely geometries)."""
    out: Dict[str, List[Dict[str, Any]]] = {
        "buildings": [], "roads": [], "railways": [], "water": [], "green": [],
        "trees": [], "power": [], "pipelines": [], "stations": [], "construction": [],
    }
    for el in data.get("elements", []):
        tags = el.get("tags", {}) or {}
        etype = el.get("type")
        if etype == "node":
            pt = Point(el["lon"], el["lat"])
            if tags.get("natural") == "tree":
                out["trees"].append({"osm_id": f"n{el['id']}", "geom": pt, "tags": tags})
            elif tags.get("railway") or tags.get("public_transport"):
                out["stations"].append({"osm_id": f"n{el['id']}", "geom": pt, "tags": tags})
            continue

        osm_id = f"{etype[0]}{el['id']}"
        if "building" in tags:
            poly = _relation_polygon(el) if etype == "relation" else _way_polygon(el)
            if poly is not None:
                out["buildings"].append({"osm_id": osm_id, "geom": poly, "tags": tags})
        elif "highway" in tags and etype == "way":
            line = _way_line(el)
            if line is not None:
                out["roads"].append({"osm_id": osm_id, "geom": line, "tags": tags})
        elif "railway" in tags and etype == "way":
            line = _way_line(el)
            if line is not None:
                out["railways"].append({"osm_id": osm_id, "geom": line, "tags": tags})
        elif tags.get("natural") == "water" or "waterway" in tags:
            poly = _way_polygon(el)
            if poly is not None:
                out["water"].append({"osm_id": osm_id, "geom": poly, "tags": tags})
            else:
                line = _way_line(el)
                if line is not None:
                    out["water"].append({"osm_id": osm_id, "geom": line, "tags": tags})
        elif tags.get("landuse") == "construction":
            poly = _relation_polygon(el) if etype == "relation" else _way_polygon(el)
            if poly is not None:
                out["construction"].append({"osm_id": osm_id, "geom": poly, "tags": tags})
        elif "leisure" in tags or "landuse" in tags:
            poly = _way_polygon(el)
            if poly is not None:
                out["green"].append({"osm_id": osm_id, "geom": poly, "tags": tags})
        elif "power" in tags:
            line = _way_line(el)
            if line is not None:
                out["power"].append({"osm_id": osm_id, "geom": line, "tags": tags})
        elif tags.get("man_made") == "pipeline":
            line = _way_line(el)
            if line is not None:
                out["pipelines"].append({"osm_id": osm_id, "geom": line, "tags": tags})
    return out
