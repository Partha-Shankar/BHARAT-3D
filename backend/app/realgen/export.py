# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Open-standard exports of a generated area (specification: docs/ID_SPEC.md, "Exports").

* :func:`cityjson`: CityJSON 2.0, the OGC-endorsed JSON encoding of CityGML 3.0. Buildings as LOD1 solids with their
  3D ULPIN units as ``BuildingUnit`` children, 2D parcels as ``LandUse`` surfaces and subsurface utility corridors as
  ``GenericCityObject`` lines at depth, in the area's UTM zone with heights above mean sea level. It never contains
  owner, tenant or tax data.
* :func:`ladm`: the same area as ISO 19152 LADM classes (levels, spatial units, basic administrative units, parties,
  rights and spatial-unit relationships). Parties and owner names follow the caller's access-policy view
  (docs/ACCESS_POLICY.md): views that mask owners get no parties.

Every identifier appears in canonical and issued form (with its check character, ``app.realgen.idcheck``).
Both exports are built from the same building details the app shows; they are cached per area until it changes.
"""
from __future__ import annotations

import datetime as dt
import threading
from collections import OrderedDict
from collections.abc import Iterable
from typing import Any

from pyproj import Transformer
from shapely.geometry import Polygon, mapping
from shapely.geometry.polygon import orient
from shapely.ops import transform as shp_transform

from app.core import access
from app.realgen import cache, idcheck, scene_ops, terrain

CITYJSON_VERSION = "2.0"
SCALE = 0.001  # 1 mm
SIMPLIFY_M = 0.05  # drop sub-5 cm wiggles from curved unit outlines
HEIGHT_REFERENCE = "metres above mean sea level (EGM96 geoid, from the terrain tiles)"
LADM_STANDARD = "ISO 19152-1:2024 Geographic information - Land Administration Domain Model (LADM)"

# ------------------------------------------------------------------------------------------------ shared helpers


def _proj_local(scene: dict[str, Any]) -> str:
    o = scene["origin"]
    return f"+proj=aeqd +lat_0={o['lat']} +lon_0={o['lon']} +datum=WGS84 +units=m +no_defs"  # = geo.LocalFrame


def utm_epsg(lon: float, lat: float) -> int:
    zone = int((lon + 180.0) // 6.0) + 1
    return (32600 if lat >= 0 else 32700) + zone


def clean_polygon(points: Iterable[Iterable[float]]) -> Polygon | None:
    """A valid, counter-clockwise polygon from a ring of local [x, y] points, or None when it has no area."""
    pts = [(float(p[0]), float(p[1])) for p in points]
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        return None
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 0.01:
        return None
    poly = poly.simplify(SIMPLIFY_M, preserve_topology=True)
    if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 0.01:
        return None
    return orient(poly, sign=1.0)  # exterior counter-clockwise, holes clockwise


def _rings(poly: Polygon) -> list[list[tuple[float, float]]]:
    out = []
    for ring in [poly.exterior, *poly.interiors]:
        pts = []
        for x, y in list(ring.coords)[:-1]:
            p = (round(x, 3), round(y, 3))
            if not pts or pts[-1] != p:
                pts.append(p)
        if len(pts) >= 2 and pts[0] == pts[-1]:
            pts.pop()
        if len(pts) >= 3:
            out.append(pts)
    return out


_memo_lock = threading.Lock()
_details_memo: OrderedDict[str, tuple[tuple, list[dict[str, Any]]]] = OrderedDict()
DETAILS_MEMO_AREAS = 3


def building_details(key: str, scene: dict[str, Any]) -> list[dict[str, Any]]:
    """Unredacted building details (floors, units, common spaces) of every building, cached until the area changes."""
    meta = cache.read_json(key, "meta.json") or {}
    marker = (scene.get("plan_version"), scene.get("edits_count"), meta.get("updated_at"), len(scene["buildings"]))
    with _memo_lock:
        hit = _details_memo.get(key)
        if hit is not None and hit[0] == marker:
            _details_memo.move_to_end(key)
            return hit[1]
    with cache.read_snapshot():  # building_detail reads registry.json once per building: parse it once here
        details = [d for d in (scene_ops.building_detail(scene, b["id"]) for b in scene["buildings"]) if d is not None]
    with _memo_lock:
        _details_memo[key] = (marker, details)
        _details_memo.move_to_end(key)
        while len(_details_memo) > DETAILS_MEMO_AREAS:
            _details_memo.popitem(last=False)
    return details


def _ids(canonical: str | None) -> dict[str, str | None]:
    return {"canonical": canonical, "issued": idcheck.issued_or_none(canonical)}


def _today() -> str:
    return dt.datetime.now(dt.UTC).date().isoformat()


# ------------------------------------------------------------------------------------------------ CityJSON 2.0


class _Vertices:
    """Collects local (x, y, z) vertices once each; at the end they are moved to UTM and quantised to 1 mm."""

    def __init__(self) -> None:
        self.index: dict[tuple[float, float, float], int] = {}
        self.points: list[tuple[float, float, float]] = []

    def add(self, x: float, y: float, z: float) -> int:
        k = (round(x, 3), round(y, 3), round(z, 3))
        i = self.index.get(k)
        if i is None:
            i = self.index[k] = len(self.points)
            self.points.append(k)
        return i


def _solid(vs: _Vertices, poly: Polygon, z0: float, z1: float) -> dict[str, Any] | None:
    """LOD1 solid: the polygon extruded from z0 to z1 (outward-facing surfaces, holes kept)."""
    if z1 - z0 < 0.05:
        return None
    rings = _rings(poly)
    if not rings:
        return None
    bottom = [[vs.add(x, y, z0) for x, y in reversed(r)] for r in rings]
    top = [[vs.add(x, y, z1) for x, y in r] for r in rings]
    walls = []
    for r in rings:
        for (ax, ay), (bx, by) in zip(r, r[1:] + r[:1]):
            walls.append([[vs.add(ax, ay, z0), vs.add(bx, by, z0), vs.add(bx, by, z1), vs.add(ax, ay, z1)]])
    return {"type": "Solid", "lod": "1", "boundaries": [[bottom, top, *walls]]}


def _surface(vs: _Vertices, poly: Polygon, z: float) -> dict[str, Any] | None:
    rings = _rings(poly)
    if not rings:
        return None
    return {"type": "MultiSurface", "lod": "1", "boundaries": [[[vs.add(x, y, z) for x, y in r] for r in rings]]}


def _line(vs: _Vertices, path: list[list[float]], z_of) -> dict[str, Any] | None:
    pts = []
    for x, y in path:
        i = vs.add(x, y, z_of(x, y))
        if not pts or pts[-1] != i:
            pts.append(i)
    return {"type": "MultiLineString", "lod": "1", "boundaries": [pts]} if len(pts) >= 2 else None


UNIT_ATTRS = ("status", "level", "unit_code", "unit_no", "usage_class", "built_up_m2", "carpet_m2", "volume_m3",
              "uds_ppm", "source")  # never owner, occupancy or tax


def cityjson(key: str, scene: dict[str, Any]) -> dict[str, Any]:
    """The area as a CityJSON 2.0 document (see the module docstring)."""
    datum = float(scene["terrain"]["datum_msl_m"])
    grid = scene["terrain"]

    def ground(x: float, y: float) -> float:
        return terrain.height_at(grid, x, y)

    vs = _Vertices()
    objects: dict[str, Any] = {}
    details = {d["building"]["id"]: d for d in building_details(key, scene)}

    for b in scene["buildings"]:
        poly = clean_polygon(b["footprint"])
        if poly is None:
            continue
        base = float(b["base_z"]) + float(b.get("min_height") or 0.0)
        geom = _solid(vs, poly, base, float(b["base_z"]) + float(b["height"]))
        detail = details.get(b["id"]) or {"floors": [], "common_spaces": []}
        children = []
        for floor in detail["floors"]:
            for u in floor["units"]:
                upoly = clean_polygon(u.get("polygon") or [])
                ugeom = _solid(vs, upoly, float(u["z_min"]), float(u["z_max"])) if upoly is not None else None
                if ugeom is None:
                    continue
                uid = idcheck.issued_or_none(u.get("vprid")) or f"{b['id']}-{floor['level']}-{u['unit_code']}"
                attrs = {k: u.get(k) for k in UNIT_ATTRS if u.get(k) is not None}
                attrs.update({"3d_ulpin": u.get("vprid"), "3d_ulpin_issued": idcheck.issued_or_none(u.get("vprid")),
                              "floor": floor["floor"]})
                objects[uid] = {"type": "BuildingUnit", "parents": [b["id"]], "attributes": attrs, "geometry": [ugeom]}
                children.append(uid)
        parcel_ulpin = b.get("parent_parcel_ulpin") or b.get("ulpin")
        attrs = {
            "name": b.get("name"), "bharat3d_id": b["id"], "identity_kind": b.get("identity_kind"),
            "ulpin": parcel_ulpin, "ulpin_issued": idcheck.issued_or_none(parcel_ulpin),
            "measuredHeight": round(float(b["height"]), 2), "storeysAboveGround": int(b["floors"]),
            "storeysBelowGround": int(b.get("basement_levels") or 0), "roofType": b.get("roof_shape"),
            "usage": b.get("usage"), "usage_class": b.get("usage_class"), "sanction_status": b.get("sanction_status"),
            "sanctioned_floors": b.get("sanctioned_floors"), "height_source": b.get("height_source"),
            "footprint_source": b.get("footprint_source"), "under_construction": bool(b.get("under_construction")),
            "common_space_registry": [idcheck.issued_or_none(c["id"]) or c["id"] for c in detail["common_spaces"]],
        }
        objects[b["id"]] = {"type": "Building", "attributes": {k: v for k, v in attrs.items() if v is not None},
                            "geometry": [geom] if geom else []}
        if children:
            objects[b["id"]]["children"] = children

    for p in scene["parcels"]:
        poly = clean_polygon(p["footprint"])
        geom = _surface(vs, poly, ground(poly.centroid.x, poly.centroid.y)) if poly is not None else None
        if geom is None:
            continue
        attrs = {"ulpin": p.get("ulpin"), "ulpin_issued": idcheck.issued_or_none(p.get("ulpin")), "kind": p.get("kind"),
                 "identity": p.get("identity"), "area_m2": p.get("area_m2"), "buildings": p.get("building_ids") or [],
                 "encumbrances": [idcheck.issued_or_none(e.get("inf_id")) or e.get("inf_id")
                                  for e in p.get("encumbrances") or []]}
        objects[p["id"]] = {"type": "LandUse", "attributes": attrs, "geometry": [geom]}

    for a in scene.get("subsurface") or []:
        depth = float(a.get("depth_m") or 0.0)
        geom = _line(vs, a.get("path") or [], lambda x, y, d=depth: ground(x, y) - d)
        if geom is None:
            continue
        attrs = {"inf_id": a.get("inf_id"), "inf_id_issued": idcheck.issued_or_none(a.get("inf_id")),
                 "kind": a.get("kind"), "name": a.get("name"), "operator": a.get("operator"), "depth_m": depth,
                 "buffer_m": a.get("buffer_m"), "radius_m": a.get("radius_m"), "source": a.get("source"),
                 "subsurface": True}
        objects[a["id"]] = {"type": "GenericCityObject", "attributes": {k: v for k, v in attrs.items() if v is not None},
                            "geometry": [geom]}

    o = scene["origin"]
    epsg = utm_epsg(o["lon"], o["lat"])
    to_utm = Transformer.from_crs(_proj_local(scene), f"EPSG:{epsg}", always_xy=True)
    if vs.points:
        xs, ys = to_utm.transform([p[0] for p in vs.points], [p[1] for p in vs.points])
        world = [(x, y, z + datum) for x, y, (_, _, z) in zip(xs, ys, vs.points)]
    else:
        world = []
    lo = [min(c[i] for c in world) for i in range(3)] if world else [0.0, 0.0, 0.0]
    hi = [max(c[i] for c in world) for i in range(3)] if world else [0.0, 0.0, 0.0]
    translate = [round(v, 3) for v in lo]
    vertices = [[round((c[i] - translate[i]) / SCALE) for i in range(3)] for c in world]
    place = scene.get("place") or {}
    return {
        "type": "CityJSON",
        "version": CITYJSON_VERSION,
        "transform": {"scale": [SCALE, SCALE, SCALE], "translate": translate},
        "metadata": {
            "identifier": f"bharat3d-{key}",
            "title": f"BHARAT 3D survey area: {', '.join(x for x in (place.get('locality'), place.get('city')) if x)}"
                     f" ({key}). Heights in {HEIGHT_REFERENCE}.",
            "referenceDate": _today(),
            "referenceSystem": f"https://www.opengis.net/def/crs/EPSG/0/{epsg}",
            "geographicalExtent": [round(v, 3) for v in (*lo, *hi)],
        },
        "CityObjects": objects,
        "vertices": vertices,
    }


# ------------------------------------------------------------------------------------------------ LADM (ISO 19152)

LEVELS = [
    {"lID": "L1-PARCEL", "name": "2D parcels (base ULPIN)", "type": "primaryRight", "structure": "polygon",
     "registerType": "urban"},
    {"lID": "L2-UNIT", "name": "3D titled volumes (3D ULPIN)", "type": "primaryRight", "structure": "polygon",
     "registerType": "urban", "note": "polygon extruded between zMin and zMax"},
    {"lID": "L3-COMMON", "name": "Common Space Registry (no separate title)", "type": "secondaryRight",
     "structure": "text", "registerType": "urban"},
    {"lID": "L4-INF-UTL", "name": "Subsurface utility corridors (INF-UTL)", "type": "publicSpace",
     "structure": "unstructuredLine", "registerType": "urban"},
]


def ladm(key: str, scene: dict[str, Any], view: str) -> dict[str, Any]:
    """The area as ISO 19152 LADM classes; owners follow the access-policy ``view``."""
    local = _proj_local(scene)
    to_ll = Transformer.from_crs(local, "EPSG:4326", always_xy=True)
    datum = float(scene["terrain"]["datum_msl_m"])
    grid = scene["terrain"]
    show_owners = access.policy(view).owner == access.Action.KEEP

    def lonlat(poly: Polygon) -> dict[str, Any]:
        g = mapping(shp_transform(lambda x, y, z=None: to_ll.transform(x, y), poly))
        return {"type": g["type"], "coordinates": [[[round(x, 7), round(y, 7)] for x, y in ring]
                                                   for ring in g["coordinates"]]}

    spatial_units: list[dict[str, Any]] = []
    ba_units: list[dict[str, Any]] = []
    rrrs: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    parties: dict[str, dict[str, Any]] = {}

    for p in scene["parcels"]:
        poly = clean_polygon(p["footprint"])
        su = _ids(p.get("ulpin"))
        if poly is None or not su["canonical"]:
            continue
        z = round(datum + terrain.height_at(grid, poly.centroid.x, poly.centroid.y), 2)
        spatial_units.append({"suID": su["issued"] or su["canonical"], "canonicalID": su["canonical"],
                              "level": "L1-PARCEL", "dimension": "2D", "label": p.get("kind"),
                              "area": [{"type": "calculatedArea", "areaSize": p.get("area_m2")}],
                              "referenceHeight": z, "geometry": lonlat(poly)})
        ba_units.append({"uID": f"BAU-{su['issued'] or su['canonical']}", "type": "basicPropertyUnit",
                         "name": f"Parcel {su['canonical']}", "spatialUnits": [su["issued"] or su["canonical"]]})

    for d in building_details(key, scene):
        b = d["building"]
        parcel = idcheck.issued_or_none(b.get("parent_parcel_ulpin") or b.get("ulpin"))
        red = access.redact_building_detail(d, view)
        for floor in red["floors"]:
            for u in floor["units"]:
                ids = _ids(u.get("vprid"))
                if not ids["canonical"]:
                    continue
                poly = clean_polygon(u.get("polygon") or [])
                if poly is None:
                    continue
                suid = ids["issued"] or ids["canonical"]
                below = float(u["z_max"]) <= float(b["base_z"]) + 0.01
                spatial_units.append({
                    "suID": suid, "canonicalID": ids["canonical"], "level": "L2-UNIT", "dimension": "3D",
                    "label": f"{b.get('name')} · {floor['label']} · {u.get('unit_code')}",
                    "surfaceRelation": "below" if below else "above",
                    "area": [{"type": "officialArea", "areaSize": u.get("carpet_m2")},
                             {"type": "calculatedArea", "areaSize": u.get("built_up_m2")}],
                    "volume": [{"type": "calculatedVolume", "volumeSize": u.get("volume_m3")}],
                    "zMin": round(datum + float(u["z_min"]), 2), "zMax": round(datum + float(u["z_max"]), 2),
                    "geometry": lonlat(poly), "status": u.get("status"), "usageClass": u.get("usage_class"),
                })
                bau = f"BAU-{suid}"
                ba_units.append({"uID": bau, "type": "basicPropertyUnit", "name": f"Unit {ids['canonical']}",
                                 "spatialUnits": [suid]})
                if parcel:
                    relations.append({"su1": suid, "su2": parcel, "relation": "within"})
                right = {"rID": f"R-{suid}", "type": "LA_Right", "rightType": "ownership", "uID": bau,
                         "share": {"numerator": u.get("uds_ppm"), "denominator": 1_000_000,
                                   "of": "undivided land share of the parent parcel"}}
                owner = u.get("owner")
                if show_owners and owner:
                    pid = f"PTY-{len(parties) + 1:05d}" if owner not in parties else parties[owner]["pID"]
                    parties.setdefault(owner, {"pID": pid, "name": owner, "type": "naturalPerson"})
                    right["pID"] = parties[owner]["pID"]
                else:
                    right["pID"] = None
                    right["partyWithheld"] = "owner withheld under the access policy for this view"
                rrrs.append(right)
        for c in d["common_spaces"]:
            ids = _ids(c.get("id"))
            spatial_units.append({"suID": ids["issued"] or ids["canonical"], "canonicalID": ids["canonical"],
                                  "level": "L3-COMMON", "dimension": "3D", "label": c.get("label"),
                                  "extent": c.get("levels"), "building": b["id"]})

    for a in scene.get("subsurface") or []:
        ids = _ids(a.get("inf_id"))
        path = a.get("path") or []
        if not ids["canonical"] or len(path) < 2:
            continue
        coords = [[round(lon, 7), round(lat, 7)] for lon, lat in (to_ll.transform(x, y) for x, y in path)]
        spatial_units.append({"suID": ids["issued"] or ids["canonical"], "canonicalID": ids["canonical"],
                              "level": "L4-INF-UTL", "dimension": "3D", "label": a.get("name") or a.get("kind"),
                              "surfaceRelation": "below", "depth_m": a.get("depth_m"),
                              "bufferWidth_m": a.get("buffer_m"), "geometry": {"type": "LineString", "coordinates": coords}})

    place = scene.get("place") or {}
    return {
        "ladm": {"standard": LADM_STANDARD, "profile": "BHARAT 3D JSON profile, see docs/ID_SPEC.md",
                 "view": view, "generated": _today(),
                 "heights": HEIGHT_REFERENCE, "coordinates": "EPSG:4326 longitude, latitude"},
        "area": {"key": key, "place": place, "zone": scene.get("zone")},
        "LA_Level": LEVELS,
        "LA_SpatialUnit": spatial_units,
        "LA_BAUnit": ba_units,
        "LA_Party": list(parties.values()) if show_owners else [],
        "LA_RRR": rrrs,
        "LA_RequiredRelationshipSpatialUnit": relations,
    }
