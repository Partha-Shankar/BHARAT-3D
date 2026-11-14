"""OpenStreetMap features for a polygon: the Overpass API, with the OpenStreetMap API as a fallback.

Public Overpass servers are shared by everyone and are often overloaded (HTTP 429/502/504) or unreachable, so a fetch:

* asks two Overpass servers at once, adds the other mirrors after a few seconds and then the OpenStreetMap API 0.6
  ``map`` call (converted to the same "out geom" shape and filtered by the same tag rules as :func:`build_query`),
  and keeps the first good answer, within an overall deadline;
* connects over IPv4 only (hosts without an IPv6 route otherwise fail with "Network is unreachable");
* is shared: concurrent requests for the same box (the area pre-check and the generation) wait for one download, and
  the result stays in memory for a while, so the generation reuses the pre-check's download;
* reports every attempt through :mod:`app.realgen.progress`, so the user can see what is happening.
"""
import json
import logging
import threading
import time
from collections import OrderedDict
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep

from app.realgen import progress

logger = logging.getLogger(__name__)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]
OSM_API_MAP_URL = "https://api.openstreetmap.org/api/0.6/map.json"
USER_AGENT = "BHARAT3D-prototype/0.2 (3D cadastre research; contact via github.com/Partha-Shankar/BHARAT-3D)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"

FETCH_DEADLINE_S = 75.0  # one fetch gives up after this long (the generation job may then retry once)
OVERPASS_TIMEOUT = httpx.Timeout(55.0, connect=8.0)
OSM_API_TIMEOUT = httpx.Timeout(40.0, connect=8.0)
RECENT_TTL_S = 30 * 60  # how long a finished download is reused (pre-check -> generation)
RECENT_MAX = 4

# (start after N seconds, label, Overpass endpoint or None for the OpenStreetMap API map call)
SCHEDULE: List[Tuple[float, str, Optional[str]]] = [
    (0.0, "overpass-api.de", OVERPASS_ENDPOINTS[0]),
    (0.0, "maps.mail.ru", OVERPASS_ENDPOINTS[1]),
    (4.0, "overpass.kumi.systems", OVERPASS_ENDPOINTS[2]),
    (4.0, "overpass.private.coffee", OVERPASS_ENDPOINTS[3]),
    (7.0, "the OpenStreetMap API", None),
    (14.0, "lz4.overpass-api.de", OVERPASS_ENDPOINTS[4]),
    (14.0, "z.overpass-api.de", OVERPASS_ENDPOINTS[5]),
    (30.0, "the OpenStreetMap API (second try)", None),
]

BUSY_MESSAGE = ("OpenStreetMap's public map servers are not answering right now (they are shared by everyone and are "
                "sometimes overloaded). Nothing is wrong with your area: please try again in a minute.")


class SourceUnavailable(RuntimeError):
    """No OpenStreetMap source answered. ``str(exc)`` is the user-facing message; ``detail`` lists every attempt."""

    def __init__(self, detail: str):
        super().__init__(BUSY_MESSAGE)
        self.detail = detail


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


# The tag rules of build_query, for data that does not come from Overpass.
_LEISURE = frozenset({"park", "garden", "pitch", "playground", "stadium"})
_LANDUSE = frozenset({"grass", "forest", "recreation_ground", "meadow", "village_green", "cemetery", "construction"})
_POWER = frozenset({"cable", "line", "minor_line"})
_STATION = frozenset({"station", "subway_entrance", "halt"})


def wanted(etype: str, tags: Dict[str, Any]) -> bool:
    """True when build_query would return an element of this type with these tags."""
    if not tags:
        return False
    if etype == "node":
        return (tags.get("natural") == "tree" or tags.get("railway") in _STATION
                or tags.get("public_transport") == "station")
    if etype == "relation":
        return "building" in tags or tags.get("landuse") == "construction"
    if etype == "way":
        return ("building" in tags or "highway" in tags or "railway" in tags or tags.get("natural") == "water"
                or "waterway" in tags or tags.get("leisure") in _LEISURE or tags.get("landuse") in _LANDUSE
                or tags.get("power") in _POWER or tags.get("man_made") == "pipeline")
    return False


def _client(timeout: httpx.Timeout) -> httpx.Client:
    # local_address 0.0.0.0 keeps every connection on IPv4; retries=1 repeats a failed connect once.
    transport = httpx.HTTPTransport(local_address="0.0.0.0", retries=1)
    return httpx.Client(timeout=timeout, transport=transport,
                        headers={"User-Agent": USER_AGENT, "Accept": "application/json"})


def _overpass_post(url: str, query: str, timeout: httpx.Timeout = OVERPASS_TIMEOUT) -> Dict[str, Any]:
    with _client(timeout) as client:
        resp = client.post(url, data={"data": query})
    if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("application/json"):
        data = resp.json()
        remark = str(data.get("remark") or "")
        if "error" in remark.lower():  # Overpass answers 200 with partial data when the query ran out of time/memory
            raise RuntimeError(f"incomplete answer: {remark[:120]}")
        return data
    raise RuntimeError(f"HTTP {resp.status_code}")


def fetch_osm_api(bounds: Tuple[float, float, float, float], timeout: httpx.Timeout = OSM_API_TIMEOUT) -> Dict[str, Any]:
    """The OpenStreetMap API 0.6 map call for a lon/lat box, converted to Overpass "out geom" JSON."""
    minx, miny, maxx, maxy = bounds
    with _client(timeout) as client:
        resp = client.get(OSM_API_MAP_URL, params={"bbox": f"{minx:.7f},{miny:.7f},{maxx:.7f},{maxy:.7f}"})
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} {resp.text[:100].strip()}")
    return osm_api_to_overpass(resp.json(), bounds)


def osm_api_to_overpass(data: Dict[str, Any], bounds: Tuple[float, float, float, float]) -> Dict[str, Any]:
    """Convert an API 0.6 ``map.json`` answer into what build_query + ``out geom`` would return for the same box.

    Ways get their node coordinates as ``geometry``; relation members get the geometry of the ways that came with the
    answer. Only elements matching build_query's tag rules are kept, nodes only inside the box (like Overpass), and
    no editing metadata (user names, changesets) is kept.
    """
    minx, miny, maxx, maxy = bounds
    elements = data.get("elements") or []
    nodes = {e["id"]: e for e in elements if e.get("type") == "node" and "lat" in e and "lon" in e}
    ways = {e["id"]: e for e in elements if e.get("type") == "way"}

    def geometry(node_ids: List[int]) -> Optional[List[Dict[str, float]]]:
        pts = []
        for nid in node_ids:
            n = nodes.get(nid)
            if n is None:  # incomplete way: leave it out rather than invent a shape
                return None
            pts.append({"lat": n["lat"], "lon": n["lon"]})
        return pts

    out: List[Dict[str, Any]] = []
    for n in nodes.values():
        tags = n.get("tags") or {}
        if wanted("node", tags) and minx <= n["lon"] <= maxx and miny <= n["lat"] <= maxy:
            out.append({"type": "node", "id": n["id"], "lat": n["lat"], "lon": n["lon"], "tags": tags})
    for w in ways.values():
        tags = w.get("tags") or {}
        if not wanted("way", tags):
            continue
        geom = geometry(w.get("nodes") or [])
        if geom and len(geom) >= 2:
            out.append({"type": "way", "id": w["id"], "nodes": list(w["nodes"]), "geometry": geom, "tags": tags})
    for r in elements:
        if r.get("type") != "relation" or not wanted("relation", r.get("tags") or {}):
            continue
        members = []
        for m in r.get("members") or []:
            member = {"type": m.get("type"), "ref": m.get("ref"), "role": m.get("role", "")}
            if m.get("type") == "way" and m.get("ref") in ways:
                geom = geometry(ways[m["ref"]].get("nodes") or [])
                if geom:
                    member["geometry"] = geom
            elif m.get("type") == "node" and m.get("ref") in nodes:
                member["lat"], member["lon"] = nodes[m["ref"]]["lat"], nodes[m["ref"]]["lon"]
            members.append(member)
        out.append({"type": "relation", "id": r["id"], "members": members, "tags": r.get("tags") or {}})
    rank = {"node": 0, "way": 1, "relation": 2}
    out.sort(key=lambda e: (rank[e["type"]], e["id"]))
    return {
        "version": 0.6,
        "generator": "OpenStreetMap API 0.6 map call, converted to Overpass out geom by BHARAT 3D",
        "osm3s": {
            "timestamp_osm_base": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "copyright": "The data included in this document is from www.openstreetmap.org. "
                         "The data is made available under ODbL.",
        },
        "elements": out,
    }


def _reason(exc: BaseException) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "timed out"
    if isinstance(exc, httpx.ConnectError):
        return "could not connect"
    return str(exc)[:60] or type(exc).__name__


def _fetch_any(query: str, bounds: Tuple[float, float, float, float], note: Callable[[str], None]) -> Dict[str, Any]:
    """Hedged race over SCHEDULE: start sources on their schedule (or at once when everything started so far has
    failed) and return the first good answer. Raises SourceUnavailable when all fail or the deadline passes."""
    t0 = time.monotonic()
    pool = ThreadPoolExecutor(max_workers=len(SCHEDULE), thread_name_prefix="osm-source")
    pending: Dict[Future, str] = {}
    errors: List[str] = []
    nxt, last_wait_note = 0, 0.0
    try:
        while True:
            now = time.monotonic() - t0
            started = []
            while nxt < len(SCHEDULE) and (SCHEDULE[nxt][0] <= now or not pending):
                _, label, url = SCHEDULE[nxt]
                job = (lambda u=url: _overpass_post(u, query)) if url else (lambda: fetch_osm_api(bounds))
                pending[pool.submit(job)] = label
                started.append(label)
                nxt += 1
            if started:
                note(("Asking " if nxt == len(started) else "Also asking ") + " and ".join(started) + " for the map data…")
            if not pending:
                break
            if now >= FETCH_DEADLINE_S:
                errors.append(f"no answer within {FETCH_DEADLINE_S:.0f} s")
                break
            horizon = [FETCH_DEADLINE_S - now, 5.0] + ([SCHEDULE[nxt][0] - now] if nxt < len(SCHEDULE) else [])
            done, _ = wait(list(pending), timeout=max(0.05, min(horizon)), return_when=FIRST_COMPLETED)
            for fut in done:
                label = pending.pop(fut)
                try:
                    data = fut.result()
                except Exception as exc:
                    errors.append(f"{label}: {type(exc).__name__}: {exc}"[:220])
                    logger.warning("OSM source failed: %s", errors[-1])
                    note(f"{label} is busy ({_reason(exc)}), trying another source…")
                    continue
                n = len(data.get("elements") or [])
                note(f"Map data received from {label}: {n:,} features in {time.monotonic() - t0:.0f} s")
                return data
            waited = time.monotonic() - t0
            if not done and waited - last_wait_note >= 5:
                last_wait_note = waited
                note(f"Still waiting for the map servers ({waited:.0f} s)…")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    raise SourceUnavailable("; ".join(errors) or "no source answered")


class _Fetch:
    """One shared download: a future, plus the reporters of everyone waiting for it."""

    def __init__(self, query: str, bounds: Tuple[float, float, float, float]):
        self.query, self.bounds = query, bounds
        self.future: Future = Future()
        self._lock = threading.Lock()
        self._listeners: List[progress.Reporter] = []
        self._last: Optional[str] = None

    def note(self, message: str) -> None:
        with self._lock:
            self._last = message
            listeners = list(self._listeners)
        for fn in listeners:
            try:
                fn(message, None)
            except Exception:
                logger.debug("progress listener failed", exc_info=True)

    def listen(self, fn: progress.Reporter) -> None:
        with self._lock:
            self._listeners.append(fn)
            last = self._last
        if last:  # a late joiner sees where the download is
            try:
                fn(last, None)
            except Exception:
                logger.debug("progress listener failed", exc_info=True)

    def unlisten(self, fn: progress.Reporter) -> None:
        with self._lock:
            if fn in self._listeners:
                self._listeners.remove(fn)


_lock = threading.Lock()
_inflight: Dict[str, _Fetch] = {}
_recent: "OrderedDict[str, Tuple[float, Dict[str, Any]]]" = OrderedDict()


def _remembered(query: str) -> Optional[Dict[str, Any]]:
    hit = _recent.get(query)
    if hit is None:
        return None
    if time.monotonic() - hit[0] > RECENT_TTL_S:
        _recent.pop(query, None)
        return None
    _recent.move_to_end(query)
    return hit[1]


def _run(f: _Fetch) -> None:
    try:
        data = _fetch_any(f.query, f.bounds, f.note)
    except BaseException as exc:
        with _lock:
            _inflight.pop(f.query, None)
        f.future.set_exception(exc)
        return
    with _lock:
        _recent[f.query] = (time.monotonic(), data)
        _recent.move_to_end(f.query)
        while len(_recent) > RECENT_MAX:
            _recent.popitem(last=False)
        _inflight.pop(f.query, None)
    f.future.set_result(data)


def _start(poly: Polygon) -> _Fetch:
    query = build_query(poly)
    with _lock:
        data = _remembered(query)
        if data is not None:
            done = _Fetch(query, poly.bounds)
            done.future.set_result(data)
            return done
        running = _inflight.get(query)
        if running is not None:
            return running
        f = _inflight[query] = _Fetch(query, poly.bounds)
    threading.Thread(target=_run, args=(f,), name="osm-fetch", daemon=True).start()
    return f


def start_fetch(poly: Polygon) -> Future:
    """Start (or join) the download for this polygon's bounding box without waiting; a future of the JSON."""
    return _start(poly).future


def forget_downloads() -> None:
    """Drop remembered downloads (tests; running downloads are left to finish)."""
    with _lock:
        _recent.clear()


def fetch_overpass(poly: Polygon) -> Dict[str, Any]:
    """Overpass-shaped JSON for everything in the polygon's bounding box (see the module docstring).

    Blocks until a source answers; raises SourceUnavailable when none does. Progress goes to the caller's reporter.
    """
    f = _start(poly)
    reporter = progress.current()
    if reporter is not None:
        f.listen(reporter)
    try:
        return f.future.result()
    finally:
        if reporter is not None:
            f.unlisten(reporter)


PHOTON_URL = "https://photon.komoot.io/reverse"

# ISO 3166-2:IN state / union territory codes, for the fallback geocoder (Nominatim supplies them itself).
INDIA_STATE_CODES = {
    "andhra pradesh": "AP", "arunachal pradesh": "AR", "assam": "AS", "bihar": "BR", "chhattisgarh": "CT",
    "goa": "GA", "gujarat": "GJ", "haryana": "HR", "himachal pradesh": "HP", "jharkhand": "JH", "karnataka": "KA",
    "kerala": "KL", "madhya pradesh": "MP", "maharashtra": "MH", "manipur": "MN", "meghalaya": "ML", "mizoram": "MZ",
    "nagaland": "NL", "odisha": "OR", "punjab": "PB", "rajasthan": "RJ", "sikkim": "SK", "tamil nadu": "TN",
    "telangana": "TG", "tripura": "TR", "uttar pradesh": "UP", "uttarakhand": "UT", "west bengal": "WB",
    "andaman and nicobar islands": "AN", "chandigarh": "CH", "dadra and nagar haveli and daman and diu": "DH",
    "delhi": "DL", "national capital territory of delhi": "DL", "jammu and kashmir": "JK", "ladakh": "LA",
    "lakshadweep": "LD", "puducherry": "PY",
}

_place_cache: "OrderedDict[Tuple[float, float], Dict[str, Any]]" = OrderedDict()
_place_lock = threading.Lock()


def _photon_place(lon: float, lat: float) -> Dict[str, Any] | None:
    """Second geocoder (Photon, also built on OpenStreetMap), used only when Nominatim refuses or fails."""
    try:
        with _client(httpx.Timeout(12.0, connect=6.0)) as client:
            resp = client.get(PHOTON_URL, params={"lon": lon, "lat": lat, "lang": "en", "limit": 1})
        if resp.status_code != 200:
            logger.warning("Photon reverse geocode answered %s", resp.status_code)
            return None
        feats = resp.json().get("features") or []
        if not feats:
            return None
        p = feats[0].get("properties") or {}
        state = p.get("state") or ""
        city = p.get("city") or p.get("county") or ""
        locality = p.get("district") or p.get("locality") or p.get("name") or "Survey area"
        return {
            "locality": locality,
            "city": city,
            "state": state,
            "state_code": INDIA_STATE_CODES.get(state.lower(), "XX"),
            "display_name": ", ".join(x for x in (locality, city, state, p.get("country")) if x),
            "country_code": (p.get("countrycode") or "").lower(),
        }
    except Exception as exc:
        logger.warning("Photon reverse geocode failed: %s", exc)
        return None


def reverse_geocode(lon: float, lat: float) -> Dict[str, Any]:
    """Locality name for the survey centroid (best effort).

    Nominatim first, exactly as before (so areas keep the names and state codes they were generated with). Public
    Nominatim limits each internet address to about one request a second and often answers 429 to shared cloud
    servers, so a refused or failed request falls back to Photon. Answers are remembered for the process lifetime.
    """
    ck = (round(lon, 4), round(lat, 4))
    with _place_lock:
        if ck in _place_cache:
            return dict(_place_cache[ck])
    found = _nominatim_place(lon, lat) or _photon_place(lon, lat)
    if found is None:
        return {"locality": "Survey area", "city": "", "state": "", "state_code": "XX", "display_name": "", "country_code": ""}
    with _place_lock:
        _place_cache[ck] = found
        while len(_place_cache) > 256:
            _place_cache.popitem(last=False)
    return dict(found)


def _nominatim_place(lon: float, lat: float) -> Dict[str, Any] | None:
    try:
        with _client(httpx.Timeout(20.0, connect=8.0)) as client:
            resp = client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 16, "addressdetails": 1},
            )
        if resp.status_code != 200:
            logger.warning("Nominatim reverse geocode answered %s; trying the fallback geocoder", resp.status_code)
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
        logger.warning("Nominatim reverse geocode failed: %s; trying the fallback geocoder", exc)
    return None


INDIA_BBOX = (68.0, 6.4, 97.5, 37.2)  # lon/lat envelope used as a fast pre-check
INDIA_FILE = Path(__file__).with_name("data") / "india.geojson"
INDIA_TOLERANCE_DEG = 0.02  # about 2 km, so areas on the coast or along a border river still count
OUTSIDE_INDIA = "This area is outside India. BHARAT 3D works only inside India: draw the survey area on Indian land."
_india_shape = None
_india_lock = threading.Lock()


def _india():
    """India's boundary as India shows it (Natural Earth 10m admin-0, India's point of view, public domain; simplified
    to about 400 m and widened by INDIA_TOLERANCE_DEG). Loaded once."""
    global _india_shape
    if _india_shape is None:
        with _india_lock:
            if _india_shape is None:
                geom = shape(json.loads(INDIA_FILE.read_text(encoding="utf-8"))["geometry"])
                _india_shape = prep(geom.buffer(INDIA_TOLERANCE_DEG))
    return _india_shape


def india_check(poly) -> str | None:
    """None if the area is in India, else a user-facing reason.

    Checked on this server against India's boundary, with no geocoder involved: the check is instant and cannot fail
    when a public geocoder limits or refuses requests (Nominatim answers 429 to shared cloud servers, which used to
    block areas in the middle of Bengaluru with "could not confirm this area is in India").
    """
    minx, miny, maxx, maxy = poly.bounds
    if minx < INDIA_BBOX[0] or maxx > INDIA_BBOX[2] or miny < INDIA_BBOX[1] or maxy > INDIA_BBOX[3]:
        return OUTSIDE_INDIA
    return None if _india().intersects(poly) else OUTSIDE_INDIA


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
