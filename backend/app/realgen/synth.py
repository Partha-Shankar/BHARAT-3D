"""Derived and synthetic layers: roads, parcels, identities, sanctions, compliance and subsurface assets.

Geometry here is computed from the real OSM footprints and roads. Values that open data cannot supply
(parcel identities, sanctions, utilities without OSM records) are generated deterministically from the
polygon seed and carry source="synthetic".
"""
import math
from typing import Any, Dict, List, Optional, Tuple

import shapely
from shapely.geometry import LineString, MultiPoint, Polygon, box
from shapely.ops import unary_union

from app.realgen.fuse import FLOOR_HEIGHT_M, parse_int, parse_metres
from app.realgen.geo import LocalFrame, line_coords, ring_coords, stable_int

ROAD_WIDTH = {
    "motorway": 16, "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 8,
    "motorway_link": 7, "trunk_link": 7, "primary_link": 7, "secondary_link": 6, "tertiary_link": 6,
    "residential": 6, "unclassified": 6, "living_street": 5, "service": 4, "track": 3,
    "pedestrian": 4, "footway": 2, "path": 1.5, "cycleway": 2, "steps": 2, "corridor": 2,
}
CARRIAGEWAY = {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified",
               "living_street", "service", "motorway_link", "trunk_link", "primary_link",
               "secondary_link", "tertiary_link"}
UTILITY_ROADS = {"trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "living_street"}
SIDEWALK_ROADS = {"trunk", "primary", "secondary", "tertiary", "residential", "unclassified"}
SIDEWALK_WIDTH = 1.8

UNIT_SIZE_M2 = {"R": 90.0, "C": 60.0, "M": 75.0, "I": 400.0, "P": 0.0}
B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


# --------------------------------------------------------------------------- roads & rail
def road_width(tags: Dict[str, str]) -> float:
    w = parse_metres(tags.get("width"))
    if w:
        return min(w, 40.0)
    lanes = parse_int(tags.get("lanes"))
    if lanes:
        return min(lanes * 3.25, 40.0)
    return float(ROAD_WIDTH.get(tags.get("highway", ""), 5))


def build_roads(raw_roads, frame: LocalFrame, extent_poly: Polygon) -> Tuple[List[Dict], List[Dict]]:
    """Surface/elevated roads for rendering, and road tunnels for the subsurface layer."""
    roads, tunnels = [], []
    for rec in raw_roads:
        tags = rec["tags"]
        hw = tags.get("highway", "")
        if hw in {"construction", "proposed", "platform", "bus_stop", "elevator"}:
            continue
        line = frame.to_local(rec["geom"]).intersection(extent_poly)
        if line.is_empty:
            continue
        parts = [line] if line.geom_type == "LineString" else [g for g in getattr(line, "geoms", []) if g.geom_type == "LineString"]
        layer = int(tags.get("layer", "0")) if tags.get("layer", "0").lstrip("-").isdigit() else 0
        width = road_width(tags)
        width_tagged = bool(parse_metres(tags.get("width")) or parse_int(tags.get("lanes")))
        is_bridge = tags.get("bridge") not in (None, "no") or layer >= 1
        is_tunnel = tags.get("tunnel") not in (None, "no") or layer <= -1
        for k, part in enumerate(parts):
            if part.length < 2:
                continue
            rid = f"{rec['osm_id']}-{k}"
            if is_tunnel:
                pedestrian = hw in {"footway", "path", "steps", "corridor", "pedestrian", "cycleway"}
                # OSM `layer` is a stacking order, not metres: map it to plausible cut-and-cover depths.
                depth = 4.0 if pedestrian else min(4.0 + max(abs(layer), 1) * 2.5, 12.0)
                tunnels.append({
                    "id": f"TUN-{rid}", "kind": "road_tunnel",
                    "name": tags.get("name") or ("Pedestrian subway" if pedestrian else "Road underpass"),
                    "source": "osm", "path": line_coords(part), "depth_m": round(depth, 1),
                    "radius_m": round(1.6 if pedestrian else max(width / 2, 3.0), 1), "buffer_m": 2.0 if pedestrian else 3.0,
                    "operator": tags.get("operator", "PWD"),
                })
                continue
            roads.append({
                "id": f"RD-{rid}", "kind": hw, "name": tags.get("name"), "width_m": round(width, 1),
                "path": line_coords(part), "elevation_m": round(max(layer, 1) * 6.5, 1) if is_bridge else 0.0,
                "is_bridge": bool(is_bridge), "source": "osm", "width_tagged": width_tagged,
                "sidewalk": tags.get("sidewalk") or tags.get("sidewalk:both"),
                "is_sidewalk": hw in {"footway", "path"} and tags.get("footway") == "sidewalk",
            })
    return roads, tunnels


def build_railways(raw_rail, frame: LocalFrame, extent_poly: Polygon) -> Tuple[List[Dict], List[Dict]]:
    surface, underground = [], []
    for rec in raw_rail:
        tags = rec["tags"]
        rw = tags.get("railway", "")
        if rw not in {"rail", "subway", "light_rail", "monorail", "narrow_gauge", "tram"}:
            continue
        line = frame.to_local(rec["geom"]).intersection(extent_poly)
        if line.is_empty:
            continue
        parts = [line] if line.geom_type == "LineString" else [g for g in getattr(line, "geoms", []) if g.geom_type == "LineString"]
        layer_s = tags.get("layer", "0")
        layer = int(layer_s) if layer_s.lstrip("-").isdigit() else 0
        tunnel = tags.get("tunnel") not in (None, "no") or layer <= -1 or (rw == "subway" and tags.get("bridge") in (None, "no"))
        bridge = tags.get("bridge") not in (None, "no") or layer >= 1
        name = tags.get("name") or tags.get("line") or ("Metro line" if rw in {"subway", "light_rail"} else "Railway")
        for k, part in enumerate(parts):
            if part.length < 2:
                continue
            rid = f"{rec['osm_id']}-{k}"
            if tunnel:
                underground.append({
                    "id": f"MET-{rid}", "kind": "metro" if rw in {"subway", "light_rail"} else "rail_tunnel",
                    "name": name, "source": "osm", "path": line_coords(part),
                    # Typical bored metro crown depths in Indian cities are 12-22 m; OSM layer only orders them.
                    "depth_m": round(min(max(11.0 + abs(layer) * 2.0, 13.0), 22.0), 1), "radius_m": 3.1, "buffer_m": 5.0,
                    "operator": tags.get("operator", "Metro operator"),
                })
            else:
                surface.append({
                    "id": f"RL-{rid}", "kind": rw, "name": name, "path": line_coords(part),
                    "elevation_m": round(max(layer, 1) * 9.0, 1) if bridge else 0.0, "is_bridge": bool(bridge),
                    "source": "osm",
                })
    return surface, underground


# --------------------------------------------------------------------------- parcels & identity
def _b36(n: int, width: int) -> str:
    s = ""
    for _ in range(width):
        n, r = divmod(n, 36)
        s = B36[r] + s
    return s


def synth_ulpin(state_code: str, x: float, y: float, seed: int) -> str:
    """14-character synthetic ULPIN stand-in: 2-letter state + 2-digit district + 10 base-36 characters."""
    st = (state_code or "XX")[:2].upper().ljust(2, "X")
    district = f"{seed % 89 + 10:02d}"
    return st + district + _b36(stable_int(st, round(x, 1), round(y, 1)), 10)


def build_parcels(buildings: List[Dict], roads: List[Dict], survey_local: Polygon, state_code: str, seed: int) -> List[Dict]:
    carriage = [LineString(r["path"]).buffer(r["width_m"] / 2.0, cap_style="flat")
                for r in roads if r["kind"] in CARRIAGEWAY and r["elevation_m"] == 0.0]
    road_union = unary_union(carriage) if carriage else Polygon()
    blocks_geom = survey_local.difference(road_union)
    blocks = [blocks_geom] if blocks_geom.geom_type == "Polygon" else list(getattr(blocks_geom, "geoms", []))

    parcels: List[Dict] = []
    assigned = set()
    for block in blocks:
        if block.area < 20:
            continue
        members = [b for b in buildings if block.contains(b["geom"].representative_point())]
        if not members:  # open land (field, park, vacant plot): stays a plain 2D parcel
            if block.area >= 50:
                c = block.representative_point()
                parcels.append({"id": f"PCL-{len(parcels) + 1:04d}", "ulpin": synth_ulpin(state_code, c.x, c.y, seed),
                                "geom": block, "building_ids": [], "kind": "open_land"})
            continue
        if len(members) == 1:
            cells = [block]
        else:
            pts = MultiPoint([b["geom"].representative_point() for b in members])
            cells = list(shapely.voronoi_polygons(pts, extend_to=block, ordered=True).geoms)
        for b, cell in zip(members, cells):
            parcel = cell.intersection(block).intersection(b["geom"].buffer(30))
            parcel = parcel.union(b["geom"]).buffer(0)
            if parcel.geom_type == "MultiPolygon":
                parcel = max(parcel.geoms, key=lambda g: g.area)
            c = parcel.centroid
            ulpin = synth_ulpin(state_code, c.x, c.y, seed)
            parcels.append({"id": f"PCL-{len(parcels) + 1:04d}", "ulpin": ulpin, "geom": parcel, "building_ids": [b["id"]]})
            b["parcel_id"] = parcels[-1]["id"]
            b["ulpin"] = ulpin
            assigned.add(b["id"])

    for b in buildings:  # buildings straddling roads or outside blocks still get a parcel
        if b["id"] not in assigned:
            parcel = b["geom"].buffer(2)
            c = parcel.centroid
            ulpin = synth_ulpin(state_code, c.x, c.y, seed)
            parcels.append({"id": f"PCL-{len(parcels) + 1:04d}", "ulpin": ulpin, "geom": parcel, "building_ids": [b["id"]]})
            b["parcel_id"], b["ulpin"] = parcels[-1]["id"], ulpin
    return parcels


def units_per_floor(area_m2: float, usage: str) -> int:
    size = UNIT_SIZE_M2.get(usage, 90.0)
    if size <= 0:  # institutional buildings stay one volume (no stratified sale)
        return 1
    return int(min(max(round(area_m2 * 0.75 / size), 1), 12))


def unit_polygons(geom: Polygon, n: int) -> List[Polygon]:
    """Split the footprint along its oriented bounding box into n roughly equal cells."""
    if n <= 1:
        return [geom]
    rect = geom.minimum_rotated_rectangle
    pts = list(rect.exterior.coords)[:4]
    e1 = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    e2 = (pts[3][0] - pts[0][0], pts[3][1] - pts[0][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    cols = max(1, round(math.sqrt(n * l1 / max(l2, 1e-6))))
    rows = max(1, math.ceil(n / cols))
    cells = []
    for r in range(rows):
        for c in range(cols):
            def p(a, b):
                return (pts[0][0] + e1[0] * a + e2[0] * b, pts[0][1] + e1[1] * a + e2[1] * b)
            cell = Polygon([p(c / cols, r / rows), p((c + 1) / cols, r / rows),
                            p((c + 1) / cols, (r + 1) / rows), p(c / cols, (r + 1) / rows)])
            part = cell.intersection(geom)
            if not part.is_empty and part.area > 2:
                if part.geom_type == "MultiPolygon":
                    part = max(part.geoms, key=lambda g: g.area)
                if part.geom_type == "Polygon":
                    cells.append(part)
    return cells[:n] if cells else [geom]


# --------------------------------------------------------------------------- compliance
MAJOR_ROADS = {"trunk", "primary", "secondary", "tertiary", "trunk_link", "primary_link", "secondary_link", "tertiary_link"}
SIDEWALK_TAG_YES = {"both", "left", "right", "yes", "separate"}


def apply_sanctions(buildings: List[Dict]) -> None:
    """Synthetic sanction register (India has no open one).

    ~5% of private buildings have no sanction on record; ~12% of the rest are sanctioned 1-2 floors lower
    than what stands. Everything else matches. Deterministic per building.
    """
    for b in buildings:
        s = b["seed"]
        sanctioned = b["floors"]
        status = "ON_RECORD"
        if b["usage"] != "P" and b["floors"] >= 2 and 12 <= s % 100 < 17:
            status = "NOT_ON_RECORD"
        elif b["floors"] >= 3 and b["usage"] != "P" and s % 100 < 12:
            sanctioned = max(1, b["floors"] - (1 + (s // 100) % 2))
        b["sanction_status"] = status
        b["sanctioned_floors"] = sanctioned
        b["sanctioned_height"] = round(b["min_height"] + sanctioned * FLOOR_HEIGHT_M + 0.6, 2)
        b["permit_no"] = None if status == "NOT_ON_RECORD" else f"BP/{2008 + s % 16}/{s % 90000 + 10000}"


def _rings(g) -> List[List[List[float]]]:
    polys = [g] if g.geom_type == "Polygon" else [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon"]
    return [ring_coords(x) for x in polys if x.area > 0.2]


def _penetration(g) -> float:
    """Approximate depth of an overlap sliver (short side of its oriented box)."""
    if g.is_empty:
        return 0.0
    pts = list(g.minimum_rotated_rectangle.exterior.coords)
    if len(pts) < 4:
        return 0.0
    return min(math.dist(pts[0], pts[1]), math.dist(pts[1], pts[2]))


def footpath_bands(roads: List[Dict]) -> List[Tuple[Dict, Polygon, str]]:
    """Footpaths as polygons, with how we know they exist: 'mapped' (OSM sidewalk way/tag) or 'assumed'."""
    bands = []
    for r in roads:
        if r["elevation_m"] != 0.0:
            continue
        line = LineString(r["path"])
        if r.get("is_sidewalk"):  # separately mapped sidewalk way
            bands.append((r, line.buffer(max(r["width_m"], 1.5) / 2.0, cap_style="flat"), "mapped"))
            continue
        tag = (r.get("sidewalk") or "").lower()
        if tag in {"no", "none"} or r["kind"] not in CARRIAGEWAY:
            continue
        if tag in SIDEWALK_TAG_YES or r["kind"] in MAJOR_ROADS:
            half = r["width_m"] / 2.0
            band = line.buffer(half + SIDEWALK_WIDTH, cap_style="flat").difference(line.buffer(half, cap_style="flat"))
            bands.append((r, band, "mapped" if tag in SIDEWALK_TAG_YES else "assumed"))
    return bands


def construction_sites(raw_sites, buildings: List[Dict], frame: LocalFrame, survey_local: Polygon) -> List[Dict]:
    sites: List[Dict] = []
    for rec in raw_sites:
        g = frame.to_local(rec["geom"]).intersection(survey_local)
        if g.is_empty or g.area < 20:
            continue
        if g.geom_type != "Polygon":
            g = max([x for x in g.geoms if x.geom_type == "Polygon"], key=lambda x: x.area)
        sites.append({"id": f"SITE-{len(sites) + 1:03d}", "osm_id": rec["osm_id"], "kind": "construction_site",
                      "name": rec["tags"].get("name") or "Construction site", "polygon": ring_coords(g),
                      "area_m2": round(g.area, 1), "source": "osm", "building_id": None})
    for b in buildings:
        t = b.get("tags", {})
        if t.get("building") == "construction" or t.get("construction"):
            b["under_construction"] = True
            sites.append({"id": f"SITE-{len(sites) + 1:03d}", "osm_id": b["osm_id"], "kind": "building_under_construction",
                          "name": f"{b.get('name') or b['id']} (under construction)", "polygon": ring_coords(b["geom"]),
                          "area_m2": round(b["geom"].area, 1), "source": "osm", "building_id": b["id"]})
    for s in sites:  # synthetic building-permit register for sites (~35% unpermitted)
        k = stable_int(s["osm_id"], "permit")
        s["permit_status"] = "NO_PERMIT_ON_RECORD" if k % 100 < 35 else "PERMITTED"
        s["permit_no"] = None if s["permit_status"] != "PERMITTED" else f"BP/2026/{k % 90000 + 10000}"
    return sites


def compliance(buildings: List[Dict], roads: List[Dict], sites: List[Dict]) -> List[Dict]:
    """All findings are geometric checks on the current buildings/roads; only the registers are synthetic."""
    violations: List[Dict] = []

    def add(b_id, vtype, severity, sanctioned, observed, excess, confidence, basis, location, geometry=None, floors=None):
        violations.append({
            "id": f"VIO-{len(violations) + 1:03d}", "building_id": b_id, "type": vtype, "severity": severity,
            "sanctioned": sanctioned, "observed": observed, "excess": excess, "floors_flagged": floors or [],
            "measurement_confidence": confidence, "basis": basis,
            "location": [round(location[0], 2), round(location[1], 2)], "geometry": geometry or [],
        })

    bands = footpath_bands(roads)
    band_index = shapely.STRtree([b for _, b, _ in bands]) if bands else None
    carriage = [(r, LineString(r["path"]).buffer(r["width_m"] / 2.0, cap_style="flat")) for r in roads
                if r["kind"] in CARRIAGEWAY and r["elevation_m"] == 0.0]
    carriage_index = shapely.STRtree([c for _, c in carriage]) if carriage else None

    for b in buildings:
        b["violation_ids"] = []
        b["footpath_encroachment_m2"] = 0.0
        geom = b["geom"]
        c = geom.centroid
        hs = b["height_source"]
        hconf = "high" if hs.startswith(("osm", "edited")) else "medium" if hs.startswith("ml") else "low"

        # 1. Structure with no sanction on record
        if b.get("sanction_status") == "NOT_ON_RECORD":
            add(b["id"], "NO_SANCTION_ON_RECORD", "HIGH", "No building permit found in the sanction register",
                f"G+{b['floors'] - 1} structure, {b['height']} m", f"{b['floors']} floor(s) unsanctioned", "medium",
                "building present in OSM/imagery but absent from the (synthetic) sanction register", (c.x, c.y),
                floors=list(range(b["floors"])))
        # 2. Floors beyond the sanction
        elif b["floors"] > b["sanctioned_floors"]:
            extra = b["floors"] - b["sanctioned_floors"]
            add(b["id"], "UNAUTHORIZED_EXTRA_FLOORS", "CRITICAL" if extra >= 2 else "HIGH",
                f"G+{b['sanctioned_floors'] - 1} ({b['sanctioned_height']} m)", f"G+{b['floors'] - 1} ({b['height']} m)",
                f"{extra} floor(s), {round(b['height'] - b['sanctioned_height'], 1)} m", hconf,
                "observed height vs synthetic sanction register", (c.x, c.y),
                floors=list(range(b["sanctioned_floors"], b["floors"])))

        if b["usage"] == "P":
            continue
        # 3. Building on the carriageway itself
        if carriage_index is not None:
            parts = []
            for i in carriage_index.query(geom):
                r, cg = carriage[int(i)]
                g = geom.intersection(cg)
                if (not g.is_empty and g.area >= 4.0 and _penetration(g) >= 0.6
                        and (r.get("width_tagged") or r["kind"] in MAJOR_ROADS)):
                    parts.append((r, g))
            if parts:
                r, g = max(parts, key=lambda x: x[1].area)
                p = g.representative_point()
                add(b["id"], "ROAD_ENCROACHMENT", "CRITICAL" if g.area >= 15 else "HIGH", "0 m² on the carriageway",
                    f"{g.area:.1f} m² built over {r.get('name') or r['kind']} (width {r['width_m']} m)", f"{g.area:.1f} m²",
                    "medium", "OSM footprint ∩ carriageway (OSM centreline buffered by tagged/major-road width)",
                    (p.x, p.y), _rings(g))
        # 4. Footpath encroachment
        if band_index is not None:
            best = None
            for i in band_index.query(geom):
                r, band, how = bands[int(i)]
                g = geom.intersection(band)
                if g.is_empty or g.area < 3.0 or _penetration(g) < 0.5:
                    continue
                if best is None or g.area > best[1].area:
                    best = (r, g, how)
            if best:
                r, g, how = best
                b["footpath_encroachment_m2"] = round(g.area, 1)
                p = g.representative_point()
                add(b["id"], "FOOTPATH_ENCROACHMENT", "HIGH" if g.area >= 10 else "MEDIUM", "0 m² on the public footpath",
                    f"{g.area:.1f} m² over the footpath of {r.get('name') or r['kind']}", f"{g.area:.1f} m²",
                    "high" if how == "mapped" else "medium",
                    "OSM footprint ∩ " + ("mapped OSM sidewalk" if how == "mapped" else f"assumed {SIDEWALK_WIDTH} m footpath beside a major road"),
                    (p.x, p.y), _rings(g))
        # 5. Front setback for taller buildings (illustrative NBC-style rule)
        if b["height"] > 15 and carriage_index is not None:
            near = [carriage[int(i)][1] for i in carriage_index.query(geom.buffer(3.0)) if carriage[int(i)][0]["kind"] in MAJOR_ROADS]
            if near:
                d = min(geom.distance(cg) for cg in near)
                if 0 < d < 3.0:
                    add(b["id"], "SETBACK_SHORTFALL", "MEDIUM", "≥ 3.0 m front open space for buildings above 15 m",
                        f"{d:.1f} m to the carriageway edge", f"{3.0 - d:.1f} m short", "medium",
                        "distance from OSM footprint to carriageway edge; rule is illustrative", (c.x, c.y))

    # 6. Construction sites without a permit on record
    for s in sites:
        s.pop("violation_id", None)
        if s["permit_status"] == "NO_PERMIT_ON_RECORD":
            g = Polygon(s["polygon"])
            p = g.representative_point()
            add(s.get("building_id"), "UNPERMITTED_CONSTRUCTION", "HIGH", "Building permit required before construction",
                f"Active site of {s['area_m2']} m² ({s['kind'].replace('_', ' ')})", "No permit on record", "medium",
                "construction mapped in OSM vs (synthetic) permit register", (p.x, p.y), _rings(g))
            s["violation_id"] = violations[-1]["id"]

    by_id = {b["id"]: b for b in buildings}
    for v in violations:
        if v["building_id"] in by_id:
            by_id[v["building_id"]]["violation_ids"].append(v["id"])
    return violations


# --------------------------------------------------------------------------- subsurface
UTILITY_SPECS = [
    # kind, label, depth (m below ground, centre), radius, buffer, side offset sign, operator
    ("telecom", "Optical fibre duct", 1.4, 0.10, 1.0, -1, "Telecom operator"),
    ("water", "Water main (DI)", 1.8, 0.20, 1.5, +1, "Water utility"),
    ("power", "11 kV feeder cable", 2.2, 0.08, 2.0, -1.6, "Power distribution utility"),
    ("sewer", "Trunk sewer", 3.5, 0.45, 1.5, 0, "Sewerage utility"),
]


# Cities with operational or under-construction metro systems: only there is an illustrative alignment plausible.
METRO_CITIES = {"delhi", "new delhi", "noida", "greater noida", "gurugram", "gurgaon", "faridabad", "ghaziabad", "mumbai",
                "navi mumbai", "thane", "bengaluru", "bangalore", "chennai", "kolkata", "hyderabad", "secunderabad", "pune",
                "ahmedabad", "gandhinagar", "jaipur", "lucknow", "kochi", "nagpur", "kanpur", "agra", "bhopal", "indore",
                "patna", "meerut", "surat"}


def build_subsurface(buildings, roads, raw_power, raw_pipes, frame, extent_poly, real_underground, seed,
                     city: str = "") -> List[Dict]:
    assets: List[Dict] = list(real_underground)

    for rec in raw_power:
        if rec["tags"].get("power") == "cable" or rec["tags"].get("location") == "underground":
            line = frame.to_local(rec["geom"]).intersection(extent_poly)
            if line.geom_type == "LineString" and line.length > 2:
                assets.append({"id": f"PWR-{rec['osm_id']}", "kind": "power", "name": rec["tags"].get("name") or "Underground power cable",
                               "source": "osm", "path": line_coords(line), "depth_m": 1.5, "radius_m": 0.1,
                               "buffer_m": 2.0, "operator": rec["tags"].get("operator", "Power utility")})
    for rec in raw_pipes:
        line = frame.to_local(rec["geom"]).intersection(extent_poly)
        if line.geom_type == "LineString" and line.length > 2:
            kind = "gas" if "gas" in rec["tags"].get("substance", "") else "water"
            assets.append({"id": f"PIP-{rec['osm_id']}", "kind": kind, "name": rec["tags"].get("name") or f"{kind.title()} pipeline",
                           "source": "osm", "path": line_coords(line), "depth_m": 2.0, "radius_m": 0.2,
                           "buffer_m": 3.0 if kind == "gas" else 1.5, "operator": rec["tags"].get("operator", "")})

    # Synthetic utility corridors under carriageways that actually serve buildings (none under open fields).
    built = shapely.STRtree([b["geom"] for b in buildings]) if buildings else None
    n = 0
    for r in roads:
        if r["kind"] not in UTILITY_ROADS or r["elevation_m"] != 0.0:
            continue
        line = LineString(r["path"])
        if line.length < 15 or built is None or len(built.query(line.buffer(40))) < 2:
            continue
        half = r["width_m"] / 2.0
        for kind, label, depth, radius, buf, side, operator in UTILITY_SPECS:
            if kind == "sewer" and r["kind"] not in {"trunk", "primary", "secondary", "tertiary"}:
                continue
            offset = side * (half + 0.8) if side else 0.0
            path = line.offset_curve(offset) if offset else line
            if path.is_empty or path.geom_type != "LineString" or path.length < 5:
                continue
            n += 1
            assets.append({"id": f"UTL-{kind[:3].upper()}-{n:04d}", "kind": kind, "name": f"{label} — {r.get('name') or r['kind']}",
                           "source": "synthetic", "path": line_coords(path), "depth_m": depth, "radius_m": radius,
                           "buffer_m": buf, "operator": operator})

    # Basements under tall or tagged buildings.
    for b in buildings:
        levels = b.get("basement_levels") or (2 if b["floors"] >= 7 else 0)
        if levels:
            b["basement_levels"] = levels
            assets.append({"id": f"BSM-{b['id']}", "kind": "basement", "name": f"Basement parking ({levels} levels) — {b['name']}",
                           "source": "osm" if b["tags"].get("building:levels:underground") else "synthetic",
                           "footprint": ring_coords(b["geom"]), "depth_top_m": 0.5, "depth_m": round(levels * 3.3 + 0.5, 1),
                           "buffer_m": 2.0, "building_id": b["id"], "operator": "Private"})

    # Illustrative metro alignment only when the area has none mapped and has an arterial road.
    if len(buildings) >= 10 and city.strip().lower() in METRO_CITIES and not any(a["kind"] == "metro" for a in assets):
        arterials = [r for r in roads if r["kind"] in {"trunk", "primary"} and r["elevation_m"] == 0.0]
        if arterials:
            longest = max(arterials, key=lambda r: LineString(r["path"]).length)
            if LineString(longest["path"]).length > 80:
                assets.append({"id": "MET-SYN-01", "kind": "metro", "name": f"Illustrative metro alignment under {longest.get('name') or 'arterial road'}",
                               "source": "synthetic", "path": longest["path"], "depth_m": 15.0, "radius_m": 3.1,
                               "buffer_m": 6.0, "operator": "Illustrative (not a real alignment)"})
    return assets


def excavation_check(trench: Polygon, depth: float, assets: List[Dict]) -> Dict[str, Any]:
    """Trench (local metres polygon) to `depth` metres vs subsurface assets: plan distance + vertical clearance."""
    clashes = []
    rank = {"CLEAR": 0, "MEDIUM_RISK": 1, "HIGH_RISK": 2, "CRITICAL_RISK": 3}
    overall = "LOW_RISK"
    for a in assets:
        if "path" in a:
            geom = LineString(a["path"])
            top = a["depth_m"] - a["radius_m"]
        else:
            geom = Polygon(a["footprint"])
            top = a.get("depth_top_m", 0.5)
        d_plan = float(trench.distance(geom))
        if d_plan > a["buffer_m"] + 5:
            continue
        vertical = top - depth  # >0 means the trench floor is above the asset
        if d_plan == 0 and vertical <= 0:
            sev = "CRITICAL_RISK"
        elif d_plan <= a["buffer_m"] and vertical <= a["buffer_m"]:
            sev = "HIGH_RISK"
        elif d_plan <= a["buffer_m"] + 5 and vertical <= a["buffer_m"] + 1:
            sev = "MEDIUM_RISK"
        else:
            continue
        clashes.append({
            "asset_id": a["id"], "asset_name": a["name"], "asset_type": a["kind"].upper(), "source": a["source"],
            "depth_meters": a["depth_m"], "plan_distance_meters": round(d_plan, 2),
            "vertical_clearance_meters": round(vertical, 2), "clash_severity": sev,
        })
        if rank.get(sev, 0) > rank.get(overall, 0):
            overall = sev
    clashes.sort(key=lambda c: (-rank[c["clash_severity"]], c["plan_distance_meters"]))
    return {
        "status": "ANALYSIS_COMPLETE", "excavation_depth_meters": depth, "overall_risk_level": overall,
        "clashes_detected_count": len(clashes), "clashes": clashes,
        "recommendation": ("Do not excavate: trench intersects a registered asset. Re-route or hand-dig trial pits under utility supervision."
                           if overall == "CRITICAL_RISK" else
                           "Clearance verification and trial pits required before mechanical excavation." if overall in {"HIGH_RISK", "MEDIUM_RISK"}
                           else "No registered asset within buffer. Proceed with standard precautions."),
        "digital_noc_eligible": overall == "LOW_RISK",
        "method": "plan distance (Shapely) + vertical clearance against registered subsurface assets",
    }
