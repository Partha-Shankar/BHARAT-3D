"""Deterministic schematic floor plans for any footprint (no CAD input needed).

Each plan is laid out in the footprint's oriented bounding box (u = long axis, v = short axis):
a stair + lift core, a corridor (double-loaded when the plate is deep enough), units along the corridor,
and rooms inside each unit by use. Everything is clipped to the real footprint. The same building and
floor always produce the same plan.
"""
import math
from typing import Any, Dict, List, Tuple

from shapely.geometry import Polygon, box
from shapely.affinity import affine_transform

from app.realgen.geo import ring_coords, stable_int

TARGET_UNIT_M2 = {"R": 85.0, "M": 90.0, "C": 110.0, "I": 600.0, "P": 0.0}
CORRIDOR_W = 1.8
CORE_W = 5.5


def _obb_frame(geom: Polygon) -> Tuple[Tuple[float, ...], Tuple[float, ...], float, float]:
    """Affine maps world<->plan coords and the plan's length (u) and depth (v)."""
    rect = geom.minimum_rotated_rectangle
    pts = list(rect.exterior.coords)[:4]
    e1 = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    e2 = (pts[3][0] - pts[0][0], pts[3][1] - pts[0][1])
    if math.hypot(*e1) < math.hypot(*e2):
        e1, e2 = e2, e1
        origin = pts[0]
    else:
        origin = pts[0]
    L, D = math.hypot(*e1), math.hypot(*e2)
    ux, uy = e1[0] / L, e1[1] / L
    vx, vy = e2[0] / D, e2[1] / D
    # plan -> world: x = ox + u*ux + v*vx ; y = oy + u*uy + v*vy
    to_world = (ux, vx, uy, vy, origin[0], origin[1])
    det = ux * vy - vx * uy
    ia, ib, id_, ie = vy / det, -vx / det, -uy / det, ux / det
    to_plan = (ia, ib, id_, ie, -(ia * origin[0] + ib * origin[1]), -(id_ * origin[0] + ie * origin[1]))
    return to_world, to_plan, L, D


def _clip(rect: Polygon, plate: Polygon, min_area: float = 1.5):
    part = rect.intersection(plate)
    if part.is_empty:
        return None
    if part.geom_type != "Polygon":
        polys = [g for g in getattr(part, "geoms", []) if g.geom_type == "Polygon"]
        if not polys:
            return None
        part = max(polys, key=lambda g: g.area)
    return part if part.area >= min_area else None


def _split(u0: float, u1: float, weights: List[float]) -> List[Tuple[float, float]]:
    total = sum(weights)
    out, cur = [], u0
    for w in weights:
        nxt = cur + (u1 - u0) * w / total
        out.append((cur, nxt))
        cur = nxt
    return out


def _rooms_for_unit(usage: str, u0: float, u1: float, v_corr: float, v_out: float, seed: int) -> List[Tuple[str, str, Polygon]]:
    """Rooms in plan coords. v_corr is the corridor side, v_out the window side."""
    w = u1 - u0
    lo, hi = min(v_corr, v_out), max(v_corr, v_out)
    d = hi - lo

    def band(a: float, b: float):  # fraction of depth measured from the corridor side
        if v_corr <= v_out:
            return lo + d * a, lo + d * b
        return hi - d * b, hi - d * a

    rooms: List[Tuple[str, str, Polygon]] = []
    if usage == "C" or (usage == "M" and seed % 3 != 0):
        a0, a1 = band(0.0, 0.18)
        b0, b1 = band(0.18, 1.0)
        (s0, s1), (t0, t1) = _split(u0, u1, [0.7, 0.3])
        rooms.append(("Shop / office floor", "shop", box(u0, b0, u1, b1)))
        rooms.append(("Store", "store", box(s0, a0, s1, a1)))
        rooms.append(("Toilet", "bath", box(t0, a0, t1, a1)))
        return rooms
    if usage == "I":
        a0, a1 = band(0.0, 0.15)
        b0, b1 = band(0.15, 1.0)
        rooms.append(("Work floor", "work", box(u0, b0, u1, b1)))
        rooms.append(("Site office", "store", box(u0, a0, u1, a1)))
        return rooms
    # Residential: living zone on the window side, service + bedrooms toward the corridor.
    l0, l1 = band(0.5, 1.0)
    s0_, s1_ = band(0.0, 0.5)
    if w >= 9:
        bhk = 3 if w >= 12 and seed % 2 == 0 else 2
        weights = [0.3, 0.17, 0.13, 0.4] if bhk == 2 else [0.26, 0.15, 0.11, 0.24, 0.24]
        names = [("Bedroom 1", "bed"), ("Kitchen", "kitchen"), ("Bath", "bath"), ("Bedroom 2", "bed")]
        if bhk == 3:
            names.append(("Bedroom 3", "bed"))
        for (a, b), (nm, kind) in zip(_split(u0, u1, weights), names):
            rooms.append((nm, kind, box(a, min(s0_, s1_), b, max(s0_, s1_))))
        (p0, p1), (q0, q1) = _split(u0, u1, [0.68, 0.32])
        rooms.append(("Living / dining", "living", box(p0, min(l0, l1), p1, max(l0, l1))))
        rooms.append(("Master bedroom", "bed", box(q0, min(l0, l1), q1, max(l0, l1))))
    else:
        for (a, b), (nm, kind) in zip(_split(u0, u1, [0.45, 0.3, 0.25]), [("Bedroom", "bed"), ("Kitchen", "kitchen"), ("Bath", "bath")]):
            rooms.append((nm, kind, box(a, min(s0_, s1_), b, max(s0_, s1_))))
        rooms.append(("Living room", "living", box(u0, min(l0, l1), u1, max(l0, l1))))
    return rooms


def plan_floor(footprint: List[List[float]], usage: str, seed: int, floor: int, force_units: int | None = None) -> Dict[str, Any]:
    """Plan for one floor in scene-local metres: core, corridor, units (each with rooms)."""
    geom = Polygon(footprint)
    if not geom.is_valid:
        geom = geom.buffer(0)
    to_world, to_plan, L, D = _obb_frame(geom)
    plate = affine_transform(geom, to_plan).buffer(-0.12)  # inside face of the external wall
    if plate.is_empty:
        plate = affine_transform(geom, to_plan)
    if plate.geom_type != "Polygon":
        plate = max(plate.geoms, key=lambda g: g.area)

    w = lambda g: ring_coords(affine_transform(g, to_world))  # noqa: E731
    area = plate.area
    fseed = stable_int(seed, floor if usage in ("C", "M") and floor == 0 else 1)  # typical floors share a plan
    use = "C" if usage == "M" and floor == 0 else usage

    # Small plots and institutional buildings: a single volume with a stair in the corner.
    if (usage == "P" or area < 70 or L < 8) and not (force_units and force_units > 1):
        core = _clip(box(0, 0, min(3.2, L * 0.35), min(3.0, D * 0.45)), plate, 0.5)
        unit_poly = plate.difference(core) if core is not None else plate
        if unit_poly.geom_type != "Polygon":
            unit_poly = max(unit_poly.geoms, key=lambda g: g.area)
        if usage == "P":
            rooms = [("Hall / ward", "hall", box(0, 0, L, D * 0.6)), ("Offices", "office", box(0, D * 0.6, L, D))]
        else:
            rooms = _rooms_for_unit(use, 0, L, 0, D, fseed)
        unit_rooms = [(n, k, _clip(r, unit_poly)) for n, k, r in rooms]
        return {
            "core": w(core) if core is not None else None,
            "corridor": None,
            "units": [{
                "index": 1, "polygon": w(unit_poly),
                "rooms": [{"name": n, "type": k, "polygon": w(g), "area_m2": round(g.area, 1)} for n, k, g in unit_rooms if g is not None],
            }],
        }

    double = D >= 14
    core_u0 = max(0.0, L / 2 - CORE_W / 2)
    core = _clip(box(core_u0, 0, core_u0 + CORE_W, D), plate, 1.0)
    if double:
        c0, c1 = D / 2 - CORRIDOR_W / 2, D / 2 + CORRIDOR_W / 2
        strips = [(0.0, c0, c0), (c1, D, c1)]  # (v_lo, v_hi, corridor side)
    else:
        c0, c1 = 0.0, CORRIDOR_W
        strips = [(c1, D, c1)]
    corridor = _clip(box(0, c0, L, c1), plate, 1.0)

    target = TARGET_UNIT_M2.get(use, 85.0)
    segments = [(v_lo, v_hi, v_corr, seg0, seg1)
                for v_lo, v_hi, v_corr in strips
                for seg0, seg1 in ((0.0, core_u0), (core_u0 + CORE_W, L)) if seg1 - seg0 >= 3]
    seg_area = [(s1 - s0) * (vh - vl) for vl, vh, _, s0, s1 in segments]
    if force_units:
        # surveyor override: distribute exactly `force_units` units over the segments by area
        n_total = max(force_units, 1)
        raw = [n_total * a / max(sum(seg_area), 1e-6) for a in seg_area]
        counts = [int(x) for x in raw]
        for i in sorted(range(len(raw)), key=lambda i: raw[i] - counts[i], reverse=True)[: n_total - sum(counts)]:
            counts[i] += 1
    else:
        cap = 4 if use in ("C", "M") else 6  # shops/offices: at most 4 per wing
        counts = [min(max(1, round(a / target)) if target else 1, cap) for a in seg_area]
    units: List[Dict[str, Any]] = []
    for (v_lo, v_hi, v_corr, seg0, seg1), n in zip(segments, counts):
        if n <= 0:
            continue
        for a, b in _split(seg0, seg1, [1.0] * n):
            unit_rect = box(a, v_lo, b, v_hi)
            up = _clip(unit_rect, plate, 6.0)
            if up is None:
                continue
            v_out = v_hi if v_corr == v_lo else v_lo
            rooms = []
            for nm, kind, r in _rooms_for_unit(use, a, b, v_corr, v_out, stable_int(fseed, a)):
                g = _clip(r, up, 1.0)
                if g is not None:
                    rooms.append({"name": nm, "type": kind, "polygon": w(g), "area_m2": round(g.area, 1)})
            units.append({"index": len(units) + 1, "polygon": w(up), "rooms": rooms})
    if not units:  # degenerate shapes: fall back to the whole plate
        units = [{"index": 1, "polygon": w(plate), "rooms": []}]
    return {"core": w(core) if core is not None else None, "corridor": w(corridor) if corridor is not None else None, "units": units}


def units_on_floor(footprint, usage: str, seed: int, floor: int, force_units: int | None = None) -> int:
    return len(plan_floor(footprint, usage, seed, floor, force_units)["units"])
