"""Everything computed *from* a scene: floor plans, the reserved 3D ULPIN (VPRID) registry, compliance
findings, statistics, and the surveyor's edits.

Generation writes `scene_base.json` once. Surveyor edits are an append-only list in `edits.json`.
The effective `scene.json` = apply(edits, base) -> derive(). Undo/reset just replays fewer edits.
"""
import copy
import math
import time
from typing import Any, Dict, List, Optional, Tuple

from shapely.geometry import LineString, Polygon, box

from app.realgen import cache, floorplan, norms, synth, terrain
from app.realgen.fuse import FLOOR_HEIGHT_M
from app.realgen.geo import ring_coords, stable_int

PLAN_VERSION = 5  # bump when floor-plan / identity rules change; stored scenes re-derive on load

EDITABLE_BUILDING = {"name", "usage", "floors", "floor_height", "min_height", "height", "footprint",
                     "sanctioned_floors", "unit_overrides", "building_type", "tenure", "verified", "certified"}
EDITABLE_ASSET = {"name", "path", "footprint", "depth_m", "radius_m", "buffer_m", "operator", "kind"}
EDITABLE_ROAD = {"name", "path", "width_m", "elevation_m", "is_bridge", "kind"}


# --------------------------------------------------------------------------- floor plans & identities
def _override(b: Dict[str, Any], floor: int) -> Optional[int]:
    o = b.get("unit_overrides") or {}
    v = o.get(str(floor), o.get("all"))
    return int(v) if v else None


def floor_plan(b: Dict[str, Any], floor: int) -> Dict[str, Any]:
    return floorplan.plan_floor(b["footprint"], b["usage"], b["seed"], floor, _override(b, floor))


def _plans(b: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    """Floor plans keyed by floor; typical floors (>= 1, no override) share the floor-1 plan."""
    plans: Dict[int, Dict[str, Any]] = {}
    out: Dict[int, Dict[str, Any]] = {}
    for f in range(b["floors"]):
        k = f if (f == 0 or _override(b, f)) else 1
        if k not in plans:
            plans[k] = floor_plan(b, f)
        out[f] = plans[k]
    return out


def pending_reason(b: Dict[str, Any], floor: int, fails: Dict[str, List[str]]) -> Optional[str]:
    """Why a unit on this floor cannot be minted yet (an open failure), or None."""
    if fails.get(b["id"]):
        return fails[b["id"]][0]
    if b.get("sanction_status") == "NOT_ON_RECORD":
        return "No sanction on record"
    if floor >= b["sanctioned_floors"]:
        return f"Above the sanctioned G+{b['sanctioned_floors'] - 1}"
    return None


def build_registry(scene: Dict[str, Any], ledger: Optional[norms.UnitLedger] = None,
                   fails: Optional[Dict[str, List[str]]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """Allocate identities under the 3D ULPIN norms: one 3D ULPIN per legal volume, minted through the area's
    lifecycle ledger so an ID is never reused. Returns registry rows and counts."""
    ledger = ledger or norms.UnitLedger("")
    fails = fails or {}
    area = scene.get("key", "")
    entries: List[Dict[str, Any]] = []
    counts = {"reserved": 0, "held": 0, "two_d": 0, "buildings": 0, "buildings_3d": 0, "inf_pub": 0, "proposals": 0}
    commons: List[Dict[str, Any]] = []
    pub_reqs = []
    live = set()
    for b in scene["buildings"]:
        counts["buildings"] += 1
        bkey = norms.building_source_key(area, b)
        live.add(bkey)
        plans = _plans(b)
        units0 = plans[0]["units"] if plans else []
        kind, reason = norms.classify(b, len(units0))
        b["identity_kind"], b["identity_reason"] = kind, reason
        b["usage_class"] = norms.USAGE_CLASS.get(b["usage"], "R")
        b["parent_parcel_ulpin"] = b.get("ulpin")
        b["units_per_floor"] = len(plans.get(1, plans.get(0, {"units": [1]}))["units"]) if plans else 1
        b["identity"] = "3D" if kind in ("STRATA", "INF_PUB") else "2D"
        base_row = {"building_id": b["id"], "building_name": b["name"], "ulpin": b.get("ulpin"), "floor": 0, "unit_index": 1,
                    "unit_no": "-", "usage_class": b["usage_class"], "area_m2": b.get("area_m2", 0), "undivided_share_ppm": None}
        if kind == "PROPOSAL":
            counts["proposals"] += 1
            entries.append({**base_row, "vprid": None, "status": "PROPOSAL", "reason": reason})
            continue
        if kind == "SINGLE_TITLE":
            counts["two_d"] += 1
            entries.append({**base_row, "vprid": None, "status": "NOT_REQUIRED_2D", "reason": reason})
            continue
        if kind == "INF_PUB":
            counts["inf_pub"] += 1
            counts["buildings_3d"] += 1
            pub_reqs.append((b, bkey))
            continue
        counts["buildings_3d"] += 1
        anchor = b["ulpin"]
        bl = ledger.building_no(anchor, bkey)
        b["block_no"] = bl
        b["building_no"] = f"BL{bl:02d}"
        whole = b["usage"] in ("C", "I", "M")
        for f in range(b["floors"]):
            units = plans[f]["units"]
            active = ledger.active_on(bkey, f)
            why = pending_reason(b, f, fails)
            if active and len(active) == len(units) and {r["unit_index"] for r in active} == {u["index"] for u in units}:
                recs = sorted(active, key=lambda r: r["unit_index"])  # same spaces: same IDs (geometry versioned)
                for r, u in zip(recs, sorted(units, key=lambda u: u["index"])):
                    gh = norms._geom_hash(u["polygon"])
                    if gh != r["geom"]:
                        r["geom"], r["version"] = gh, r["version"] + 1
                        ledger.event("VERSION", r["id"], "geometry corrected; identity unchanged")
                    if b.get("certified") and r["status"] == "PROVISIONAL":
                        r["status"] = "CERTIFIED_AS_BUILT"
                        ledger.event("CERTIFY", r["id"], "surveyor certified as built")
            elif why is None:
                parents = [r["id"] for r in active]
                for r in active:  # partition or merger: retire the old spaces, mint fresh ones with lineage
                    ledger.retire(r, "RETIRED", "floor re-partitioned (subdivision / merger)")
                recs = ledger.mint(anchor, bl, bkey, b["id"], f, units, whole and len(units) == 1,
                                   "CERTIFIED_AS_BUILT" if b.get("certified") else "PROVISIONAL", b["usage_class"], parents or None)
            else:
                recs = []
            by_index = {r["unit_index"]: r for r in recs}
            for u in units:
                r = by_index.get(u["index"])
                if r:
                    ledger.seen.add(r["id"])
                    counts["reserved"] += 1
                else:
                    counts["held"] += 1
                code = r["unit_code"] if r else f"U{f * 100 + u['index']:03d}"
                entries.append({"vprid": r["id"] if r else None, "building_id": b["id"], "building_name": b["name"],
                                "ulpin": b["ulpin"], "anchor": anchor, "building_no": f"BL{bl:02d}", "level": norms.level_code(f),
                                "unit_code": code if r else None, "floor": f, "unit_index": u["index"],
                                "unit_no": code[1:] if code.startswith("U") else code,
                                "status": r["status"] if r else "PENDING", "reason": None if r else why,
                                "usage_class": b["usage_class"], "area_m2": round(Polygon(u["polygon"]).area, 1),
                                "version": r["version"] if r else None, "undivided_share_ppm": None})
        # Common Space Registry (Edge Case 3): core, corridors, common basement parking and roof never get a ULPIN
        csr = f"CSR-{anchor}-BL{bl:02d}"
        elems = [("C001", "Stair and lift core, shafts", "all levels")]
        if any(p.get("corridor") for p in plans.values()):
            elems.append(("C002", "Corridors and lobbies", "all levels"))
        if b.get("basement_levels"):
            n = b["basement_levels"]
            elems.append(("C003", f"Basement parking (common, {n} level(s))", "S01" if n == 1 else f"S01-S{n:02d}"))
        elems.append(("C004", "Roof terrace (common)", "RF"))
        for code, label, levels in elems:
            commons.append({"id": f"{csr}-{code}", "building_id": b["id"], "label": label, "levels": levels})

    # Public assets: one INF-PUB volume per building
    if pub_reqs:
        zone = norms.zone_code(scene)
        ids = norms.mint_inf([(k, "PUB", zone, area) for _, k in pub_reqs])
        for b, k in pub_reqs:
            b["inf_id"] = ids[k]
            b["building_no"] = "BL01"
            entries.append({"vprid": ids[k], "building_id": b["id"], "building_name": b["name"], "ulpin": b.get("ulpin"),
                            "anchor": ids[k], "building_no": "BL01", "level": "L00", "unit_code": None, "floor": 0, "unit_index": 1,
                            "unit_no": "-", "status": "PROVISIONAL", "reason": b["identity_reason"], "usage_class": "U",
                            "area_m2": b.get("area_m2", 0), "version": 1, "undivided_share_ppm": None})
            commons.append({"id": f"CSR-{ids[k]}-BL01-C001", "building_id": b["id"], "label": "Stair and lift core, shafts",
                            "levels": "all levels"})

    # Undivided land share per parcel scheme (all titled units on the parcel), integer ppm summing to 1,000,000
    by_parcel: Dict[str, List[Dict[str, Any]]] = {}
    for e in entries:
        if e["vprid"] and not e["vprid"].startswith("INF-"):
            by_parcel.setdefault(e.get("ulpin") or "", []).append(e)
    for rows in by_parcel.values():
        for e, ppm in zip(rows, norms.uds_ppm([max(r["area_m2"], 0.1) for r in rows])):
            e["undivided_share_ppm"] = ppm

    ledger.close(live)
    scene["common_spaces"] = commons
    return entries, counts


def building_detail(scene: Dict[str, Any], building_id: str) -> Optional[Dict[str, Any]]:
    b = next((x for x in scene["buildings"] if x["id"] == building_id), None)
    if b is None:
        return None
    reg = cache.read_json(scene["key"], "registry.json") if scene.get("key") else None
    rows = {(e["floor"], e["unit_index"]): e for e in (reg or []) if e["building_id"] == building_id}
    kind = b.get("identity_kind", "STRATA")
    fh = b["floor_height"]
    floors = []
    plans = _plans(b)
    from app.realgen.llm import owner_name  # local import keeps module load light

    for f in range(b["floors"]):
        plan = plans[f]
        base = round(b["base_z"] + b["min_height"] + f * fh, 2)  # scene height (terrain datum), used for drawing
        above = round(b["min_height"] + f * fh, 2)  # height above the building's own ground, used for display
        units = []
        floor_status = None
        for u in plan["units"]:
            area = Polygon(u["polygon"]).area
            useed = stable_int(b["seed"], f, u["index"])
            if kind == "STRATA":
                e = rows.get((f, u["index"]), {})
                vid, status, reason, ppm = e.get("vprid"), e.get("status", "PENDING"), e.get("reason"), e.get("undivided_share_ppm")
                code = e.get("unit_code") or f"U{f * 100 + u['index']:03d}"
            elif kind == "INF_PUB":
                vid, status, reason, ppm, code = None, "PART_OF_INF_PUB", f"Inside public asset {b.get('inf_id')}", None, "-"
            elif kind == "PROPOSAL":
                vid, status, reason, ppm, code = None, "PROPOSAL", b.get("identity_reason"), None, "-"
            else:
                vid, status, reason, ppm, code = None, "NOT_REQUIRED_2D", b.get("identity_reason"), None, "-"
            floor_status = floor_status or status
            units.append({
                "unit_no": code[1:] if code.startswith("U") else code,
                "unit_code": code,
                "index": u["index"],
                "vprid": vid,
                "status": status,
                "reason": reason,
                "level": norms.level_code(f),
                "polygon": u["polygon"],
                "rooms": u["rooms"],
                "built_up_m2": round(area, 1),
                "carpet_m2": round(sum(r["area_m2"] for r in u["rooms"]) or area * 0.8, 1),
                "volume_m3": round(area * (fh - 0.2), 1),
                "z_min": base, "z_max": round(base + fh, 2), "h_min": above, "h_max": round(above + fh, 2),
                "owner": owner_name(useed),
                "occupancy": ["OWNER_OCCUPIED", "LEASED", "VACANT"][useed % 3],
                "annual_tax_inr": int(round(area * (180 if b["usage"] == "R" else 420) / 10) * 10),
                "uds_ppm": ppm,
                "uds_percent": round(ppm / 10_000, 4) if ppm is not None else None,
                "usage_class": b.get("usage_class"),
                "source": "synthetic",
            })
        floors.append({"floor": f, "label": "Ground" if f == 0 else f"Floor {f}", "level": norms.level_code(f),
                       "z_min": base, "z_max": round(base + fh, 2), "h_min": above, "h_max": round(above + fh, 2),
                       "unauthorized": f >= b["sanctioned_floors"] and b.get("sanction_status") != "NOT_ON_RECORD",
                       "status": floor_status, "core": plan["core"], "corridor": plan["corridor"], "units": units})
    commons = [c for c in scene.get("common_spaces", []) if c["building_id"] == building_id]
    return {"building": b, "floors": floors, "common_spaces": commons}


# --------------------------------------------------------------------------- derive
def derive(scene: Dict[str, Any], ledger: Optional[norms.UnitLedger] = None) -> Dict[str, Any]:
    """Recompute findings, infrastructure IDs, integrity, the 3D ULPIN registry and statistics."""
    internal = []
    proposals = []
    for b in scene["buildings"]:
        if str(b.get("footprint_source", "")).startswith("ai") and not b.get("verified"):
            proposals.append(b)  # AI proposal: no findings until a surveyor verifies the footprint
            continue
        d = dict(b)
        d["geom"] = Polygon(b["footprint"])
        if not d["geom"].is_valid:
            d["geom"] = d["geom"].buffer(0)
        d["tags"] = {"building": b.get("building_type", "yes")}
        if b.get("under_construction"):
            d["tags"]["construction"] = "yes"
        internal.append(d)
    sites = scene.get("construction_sites", [])
    violations = synth.compliance(internal, scene["roads"], sites)
    for d in internal:
        b = next(x for x in scene["buildings"] if x["id"] == d["id"])
        b["violation_ids"] = d["violation_ids"]
        b["footpath_encroachment_m2"] = d["footpath_encroachment_m2"]
    for b in proposals:
        b["violation_ids"], b["footpath_encroachment_m2"] = [], 0.0
    scene["violations"] = violations
    scene["footpaths"] = footpaths(scene)
    infra = norms.assign_infrastructure(scene, scene.get("key", ""))
    report, fails = norms.integrity(scene)
    registry, counts = build_registry(scene, ledger, fails)
    minted = [e["vprid"] for e in registry if e["vprid"]]
    report["axiom6_uds_closure"] = _uds_check(registry)
    report["identifier_syntax"] = {"checked": len(minted), "failures": [v for v in minted if not (
        norms.valid_unit_id(v) or norms.INF_RE.match(v))]}
    report["uniqueness"] = {"checked": len(minted), "failures": sorted({v for v in minted if minted.count(v) > 1})}
    scene["integrity"] = report
    scene["zone"] = norms.zone_code(scene)
    stats = scene.setdefault("stats", {})
    by_type: Dict[str, int] = {}
    for v in violations:
        by_type[v["type"]] = by_type.get(v["type"], 0) + 1
    hs: Dict[str, int] = {}
    for b in scene["buildings"]:
        hs[b["height_source"]] = hs.get(b["height_source"], 0) + 1
    stats.update({
        "buildings": len(scene["buildings"]),
        "floors": sum(b["floors"] for b in scene["buildings"]),
        "volumetric_units": len(registry),
        "vprids_reserved": counts["reserved"],
        "volumes_on_hold": counts["held"],
        "inf_pub": counts["inf_pub"],
        "inf_assets": infra["inf_assets"] + counts["inf_pub"],
        "easements": infra["easements"],
        "common_spaces": len(scene.get("common_spaces", [])),
        "ai_proposals": counts["proposals"],
        "integrity_failures": sum(len(v["failures"]) for v in report.values()),
        "buildings_3d_ulpin": counts["buildings_3d"],
        "buildings_2d_only": counts["buildings"] - counts["buildings_3d"],
        "parcels_open_land": sum(1 for p in scene["parcels"] if not p["building_ids"]),
        "parcels": len(scene["parcels"]),
        "roads": len(scene["roads"]),
        "subsurface_assets": len(scene["subsurface"]),
        "construction_sites": len(sites),
        "violations": len(violations),
        "violations_by_type": by_type,
        "footpath_m2": round(sum(f["area_m2"] for f in scene["footpaths"])),
        "height_sources": hs,
        "subsurface_by_source": {s: sum(1 for a in scene["subsurface"] if a["source"] == s) for s in ("osm", "synthetic", "edited")},
    })
    return {"scene": scene, "registry": registry}


def _uds_check(registry: List[Dict[str, Any]]) -> Dict[str, Any]:
    sums: Dict[str, int] = {}
    for e in registry:
        if e.get("undivided_share_ppm") is not None:
            sums[e["ulpin"]] = sums.get(e["ulpin"], 0) + e["undivided_share_ppm"]
    return {"checked": len(sums), "failures": [u for u, v in sums.items() if v != 1_000_000]}


def footpaths(scene: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Footpath surfaces for the 3D view: the same bands the encroachment check measures against."""
    clip = box(*scene["extent"]) if scene.get("extent") else None
    out: List[Dict[str, Any]] = []
    for road, band, how in synth.footpath_bands(scene["roads"]):
        g = (band.intersection(clip) if clip is not None else band).simplify(0.15, preserve_topology=True)
        parts = [g] if g.geom_type == "Polygon" else [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon"]
        for part in parts:
            if part.area < 2:
                continue
            out.append({
                "id": f"FP-{len(out) + 1:04d}", "road_id": road["id"], "road_name": road.get("name") or "",
                "source": how, "area_m2": round(part.area, 1),
                "rings": [[[round(x, 2), round(y, 2)] for x, y in part.exterior.coords]]
                + [[[round(x, 2), round(y, 2)] for x, y in hole.coords] for hole in part.interiors],
            })
    return out


def publish(key: str, scene: Dict[str, Any], edits_count: int) -> Dict[str, Any]:
    ledger = norms.UnitLedger(key)
    out = derive(scene, ledger)
    ledger.save()
    scene["edits_count"] = edits_count
    scene["plan_version"] = PLAN_VERSION
    cache.write_json(key, "scene.json", scene)
    cache.write_json(key, "registry.json", out["registry"])
    write_meta(key, scene)
    return scene


def write_meta(key: str, scene: Dict[str, Any]) -> None:
    prev = cache.read_json(key, "meta.json") or {}
    st = scene["stats"]
    cache.write_json(key, "meta.json", {
        "key": key, "place": scene["place"], "origin": scene["origin"], "created_at": prev.get("created_at", time.time()),
        "updated_at": time.time(), "area_m2": st.get("area_m2"), "buildings": st.get("buildings"),
        "vprids_reserved": st.get("vprids_reserved"), "violations": st.get("violations"),
        "subsurface_assets": st.get("subsurface_assets"), "edits_count": scene.get("edits_count", 0),
        "survey_polygon": scene["survey_polygon"]["lonlat"],
        "zone": scene.get("zone"), "inf_assets": st.get("inf_assets"), "common_spaces": st.get("common_spaces"),
        "pending": st.get("volumes_on_hold"), "ai_proposals": st.get("ai_proposals"),
        "integrity": {k: {"checked": v["checked"], "failures": len(v["failures"]), "sample": v["failures"][:5]}
                      for k, v in (scene.get("integrity") or {}).items()},
    })


# --------------------------------------------------------------------------- edits
def _next_id(items: List[Dict[str, Any]], prefix: str) -> str:
    n = 1 + max([int(x["id"].rsplit("-", 1)[-1]) for x in items if x["id"].startswith(prefix) and x["id"].rsplit("-", 1)[-1].isdigit()] or [0])
    return f"{prefix}{n:03d}"


def _refresh_building(scene: Dict[str, Any], b: Dict[str, Any]) -> None:
    g = Polygon(b["footprint"])
    if not g.is_valid:
        g = g.buffer(0)
    b["footprint"] = ring_coords(g)
    c = g.centroid
    b["centroid"] = [round(c.x, 2), round(c.y, 2)]
    b["area_m2"] = round(g.area, 1)
    b["base_z"] = terrain.height_at(scene["terrain"], c.x, c.y)


def apply_op(scene: Dict[str, Any], op: Dict[str, Any]) -> Optional[str]:
    """Mutates scene; returns an error string if the op could not be applied (it is then skipped)."""
    kind = op.get("op")
    if kind == "building.update":
        b = next((x for x in scene["buildings"] if x["id"] == op.get("id")), None)
        if b is None:
            return f"building {op.get('id')} not found"
        s = {k: v for k, v in (op.get("set") or {}).items() if k in EDITABLE_BUILDING}
        b.update(s)
        fh = float(b.get("floor_height") or FLOOR_HEIGHT_M)
        b["floor_height"] = fh
        if "height" in s and "floors" not in s:
            b["floors"] = max(1, round((float(b["height"]) - b["min_height"]) / fh))
        elif {"floors", "floor_height", "min_height"} & set(s) and "height" not in s:
            b["height"] = round(b["min_height"] + int(b["floors"]) * fh + 0.6, 2)
        b["floors"] = int(b["floors"])
        if "sanctioned_floors" in s:
            b["sanctioned_floors"] = int(s["sanctioned_floors"])
            b["sanctioned_height"] = round(b["min_height"] + b["sanctioned_floors"] * fh + 0.6, 2)
            b["sanction_status"] = "ON_RECORD"
        if {"height", "floors", "floor_height", "min_height"} & set(s):
            b["height_source"] = "edited:surveyor"
        if "footprint" in s:
            b["footprint_source"] = "edited:surveyor"
            _refresh_building(scene, b)
        b["edited"] = True
        return None
    if kind == "building.add":
        src = op.get("building") or {}
        fp = src.get("footprint")
        if not fp or len(fp) < 3:
            return "new building needs a footprint"
        floors = int(src.get("floors", 4))
        fh = float(src.get("floor_height", FLOOR_HEIGHT_M))
        g = Polygon(fp)
        seed = stable_int(scene["key"], round(g.centroid.x, 1), round(g.centroid.y, 1))
        pid = _next_id(scene["parcels"], "PCL-E")
        ulpin = synth.synth_ulpin(scene["place"].get("state_code", "XX"), g.centroid.x, g.centroid.y, seed)
        scene["parcels"].append({"id": pid, "ulpin": ulpin, "footprint": ring_coords(g.buffer(2)), "area_m2": round(g.buffer(2).area, 1),
                                 "building_ids": [], "source": "surveyor"})
        b = {
            "id": _next_id(scene["buildings"], "BLD-E"), "osm_id": "surveyor", "name": src.get("name") or "New building",
            "name_source": "surveyor", "building_type": src.get("building_type", "yes"), "usage": src.get("usage", "R"),
            "footprint": fp, "min_height": float(src.get("min_height", 0)), "floors": floors, "floor_height": fh,
            "height": round(float(src.get("min_height", 0)) + floors * fh + 0.6, 2), "height_source": "edited:surveyor",
            "footprint_source": "edited:surveyor", "roof_shape": "flat", "sanctioned_floors": int(src.get("sanctioned_floors", floors)),
            "sanction_status": "ON_RECORD", "permit_no": f"BP/2026/{seed % 90000 + 10000}", "parcel_id": pid, "ulpin": ulpin,
            "block_no": 1, "units_per_floor": 1, "basement_levels": 0, "violation_ids": [], "footpath_encroachment_m2": 0.0,
            "seed": seed, "edited": True,
        }
        b["sanctioned_height"] = round(b["min_height"] + b["sanctioned_floors"] * fh + 0.6, 2)
        _refresh_building(scene, b)
        scene["parcels"][-1]["building_ids"].append(b["id"])
        scene["buildings"].append(b)
        op.setdefault("result_id", b["id"])
        return None
    if kind == "building.delete":
        before = len(scene["buildings"])
        scene["buildings"] = [x for x in scene["buildings"] if x["id"] != op.get("id")]
        scene["subsurface"] = [a for a in scene["subsurface"] if a.get("building_id") != op.get("id")]
        return None if len(scene["buildings"]) < before else f"building {op.get('id')} not found"
    if kind in ("asset.update", "road.update"):
        coll = scene["subsurface"] if kind == "asset.update" else scene["roads"]
        allowed = EDITABLE_ASSET if kind == "asset.update" else EDITABLE_ROAD
        a = next((x for x in coll if x["id"] == op.get("id")), None)
        if a is None:
            return f"{op.get('id')} not found"
        a.update({k: v for k, v in (op.get("set") or {}).items() if k in allowed})
        if kind == "road.update" and "elevation_m" in (op.get("set") or {}):
            a["is_bridge"] = float(a["elevation_m"]) > 0
        a["source"] = "edited"
        return None
    if kind == "asset.add":
        src = op.get("asset") or {}
        if not src.get("path") and not src.get("footprint"):
            return "new asset needs a path or footprint"
        prefix = {"metro": "MET-E", "road_tunnel": "TUN-E", "basement": "BSM-E"}.get(src.get("kind", ""), "UTL-E")
        a = {"id": _next_id(scene["subsurface"], prefix), "kind": src.get("kind", "metro"), "name": src.get("name") or "New alignment",
             "source": "edited", "depth_m": float(src.get("depth_m", 15)), "radius_m": float(src.get("radius_m", 3.1)),
             "buffer_m": float(src.get("buffer_m", 6)), "operator": src.get("operator", "Surveyor entry")}
        if src.get("path"):
            a["path"] = src["path"]
        else:
            a["footprint"], a["depth_top_m"] = src["footprint"], float(src.get("depth_top_m", 0.5))
        scene["subsurface"].append(a)
        op.setdefault("result_id", a["id"])
        return None
    if kind == "road.add":
        src = op.get("road") or {}
        if not src.get("path") or len(src["path"]) < 2:
            return "new road needs a path"
        elev = float(src.get("elevation_m", 0))
        r = {"id": _next_id(scene["roads"], "RD-E"), "kind": src.get("kind", "primary"), "name": src.get("name") or "New road",
             "width_m": float(src.get("width_m", 12)), "path": src["path"], "elevation_m": elev, "is_bridge": elev > 0,
             "source": "edited", "width_tagged": True, "sidewalk": None, "is_sidewalk": False}
        scene["roads"].append(r)
        op.setdefault("result_id", r["id"])
        return None
    if kind in ("asset.delete", "road.delete"):
        coll_key = "subsurface" if kind == "asset.delete" else "roads"
        before = len(scene[coll_key])
        scene[coll_key] = [x for x in scene[coll_key] if x["id"] != op.get("id")]
        return None if len(scene[coll_key]) < before else f"{op.get('id')} not found"
    return f"unknown op {kind}"


def rebuild(key: str) -> Dict[str, Any]:
    """Effective scene = base + all edits, re-derived and written to scene.json."""
    base = cache.read_json(key, "scene_base.json")
    if base is None:
        raise FileNotFoundError(key)
    with norms.area_lock(key):
        scene = copy.deepcopy(base)
        scene["key"] = key
        edits = cache.read_json(key, "edits.json") or []
        errors = []
        for e in edits:
            sizes = {k: len(scene[k]) for k in ("buildings", "subsurface", "roads")}
            err = apply_op(scene, e["op"])
            if err:
                errors.append({"edit": e["seq"], "error": err})
            for k, n in sizes.items():  # objects created by an edit are identified by that edit, never by a reusable id
                for obj in scene[k][n:]:
                    obj["created_edit"] = f"{e['at']:.6f}"
        scene["edit_errors"] = errors
        return publish(key, scene, len(edits))


def add_edits(key: str, ops: List[Dict[str, Any]], user: str) -> Dict[str, Any]:
    edits = cache.read_json(key, "edits.json") or []
    for op in ops:
        edits.append({"seq": len(edits) + 1, "at": time.time(), "by": user, "op": op})
    cache.write_json(key, "edits.json", edits)
    return rebuild(key)


def undo(key: str) -> Dict[str, Any]:
    edits = cache.read_json(key, "edits.json") or []
    cache.write_json(key, "edits.json", edits[:-1])
    return rebuild(key)


def reset(key: str) -> Dict[str, Any]:
    cache.write_json(key, "edits.json", [])
    return rebuild(key)
