"""3D ULPIN norms: identifiers, allocation, lifecycle and integrity.

Implements the team proposal B3D-PROP-2026-ULPIN-01 (Rev 3), "One legal 3D space = one 3D ULPIN":

* Unit ID:  <14-char base ULPIN | INF anchor>-BL01-L08-U804   (usage class is an attribute, never in the ID)
* INF IDs:  INF-TUN|FLY|PUB|PRK|AIR|MAR-<ZONE>-<SEQ4>, INF-UTL-<GAS|PWR|WAT|SEW|TEL>-<ZONE>-<SEQ6>
* Common Space Registry: CSR-<anchor>-BLnn-Cnnn (lifts, stairs, corridors, common parking never get a ULPIN)
* 2D-Sufficiency: an unsevered plotted house / single-occupier building keeps its 2D ULPIN
* IDs are immutable and never reused: partition or merger retires IDs and mints fresh ones with lineage
* Undivided share in integer ppm, summing to exactly 1,000,000 per parcel scheme (largest remainder)
* Integrity axioms are checked; a unit with an open failure, or an unverified AI proposal, is not minted

The prototype's parcels, ULPINs and sanction registers are synthetic; every threshold below is a configurable default.
"""
import hashlib
import json
import os
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree

from app.realgen import cache
from app.realgen.geo import stable_int

# --------------------------------------------------------------------------- vocabulary & defaults
USAGE_CLASS = {"R": "R", "C": "C", "I": "I", "M": "M", "P": "U"}  # internal "P" (public/institutional) -> norms "U"
USAGE_LABEL = {"R": "Residential", "C": "Commercial", "I": "Industrial", "M": "Mixed", "U": "Utility / institutional", "P": "Parking"}

TUNNEL_KINDS = {"metro", "rail_tunnel", "road_tunnel"}
UTL_TYPE = {"gas": "GAS", "power": "PWR", "water": "WAT", "sewer": "SEW", "telecom": "TEL"}
TUNNEL_CLEARANCE_M = 5.0  # clearance envelope around a bore's outer lining
UTL_BUFFER_M = {"GAS": 3.0, "PWR": 2.0, "WAT": 1.5, "SEW": 1.5, "TEL": 1.0}

MINTED = ("PROVISIONAL", "CERTIFIED_AS_BUILT")
EPS_VOL = 0.001  # m3
EPS_AREA = 0.05  # m2: plan overlap below this is treated as touching (OSM digitising noise)

UNIT_RE = re.compile(r"^([0-9A-Z]{14}|INF-(PUB|PRK|AIR|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4})-BL[0-9]{2,3}-(L[0-9]{2}|S[0-9]{2}|RF)-(U[0-9]{3,4}|UFLR)$")
INF_RE = re.compile(r"^INF-(TUN|FLY|AIR|PUB|PRK|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4}$")
UTL_RE = re.compile(r"^INF-UTL-(GAS|PWR|WAT|SEW|TEL)-[A-Z]{2}[0-9]{2}-[0-9]{6}$")
CSR_RE = re.compile(r"^CSR-([0-9A-Z]{14}|INF-(PUB|PRK|AIR|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4})-BL[0-9]{2,3}-C[0-9]{3}$")


def valid_unit_id(s: str) -> bool:
    return bool(UNIT_RE.match(s)) and "-BL00-" not in s  # BL00 is reserved for parcel-level common space


# Public building types / names that make a building a public asset (INF-PUB) rather than a private one.
PUBLIC_TYPES = {"government", "civic", "public", "train_station", "transportation", "fire_station", "townhall", "courthouse"}
PUBLIC_NAME = re.compile(r"\b(govt|government|municipal|corporation|nagar\s*(nigam|palika)|panchayat|railway|metro station|"
                         r"police|post office|kendriya|navodaya|aiims|esi|district|collectorate|tahsil|court|secretariat|"
                         r"public (hospital|school|health)|zilla|state bank|bsnl|fire station|bus (stand|station|depot))\b", re.I)
RELIGIOUS = {"temple", "mosque", "church", "gurudwara", "religious", "chapel", "shrine", "monastery", "synagogue"}


def zone_code(scene: Dict[str, Any]) -> str:
    """[ZONE] = ISO 3166-2:IN state code + two-digit local zone (one zone per city in this prototype)."""
    place = scene.get("place", {})
    st = (place.get("state_code") or "XX")[:2].upper()
    return f"{st}{stable_int(st, place.get('city') or place.get('locality') or '') % 99 + 1:02d}"


# --------------------------------------------------------------------------- national INF ledger
_inf_lock = threading.Lock()
_area_locks: Dict[str, threading.Lock] = {}


def _ledger_path() -> str:
    d = os.path.join(cache.CACHE_ROOT, "_registry")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "inf_ledger.json")


def _read_inf() -> Dict[str, Any]:
    p = _ledger_path()
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"counters": {}, "assets": {}}


def _write_inf(data: Dict[str, Any]) -> None:
    p = _ledger_path()
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, p)


def mint_inf(requests: List[Tuple[str, str, str, str]]) -> Dict[str, str]:
    """[(source_key, class, zone, area_key)] -> {source_key: INF ID}. The same real asset seen from two overlapping
    areas keeps one ID; sequences are per class and zone and never reused."""
    out: Dict[str, str] = {}
    with _inf_lock:
        led = _read_inf()
        changed = False
        for skey, cls, zone, area in requests:
            rec = led["assets"].get(skey)
            if rec is None:
                ctr = f"{cls}-{zone}"
                n = led["counters"].get(ctr, 0) + 1
                led["counters"][ctr] = n
                if cls.startswith("UTL-"):
                    iid = f"INF-{cls}-{zone}-{n:06d}"
                else:
                    iid = f"INF-{cls}-{zone}-{n:04d}"
                rec = {"id": iid, "class": cls, "zone": zone, "first_area": area, "minted_at": time.time()}
                led["assets"][skey] = rec
                changed = True
            out[skey] = rec["id"]
        if changed:
            _write_inf(led)
    return out


def _osm_ref(internal_id: str) -> Optional[str]:
    """'MET-w123-0' / 'RD-w123-1' / 'PWR-w99' -> 'w123' (one physical OSM way, however it was clipped)."""
    m = re.search(r"-([wnr]\d+)", internal_id)
    return m.group(1) if m else None


def asset_source_key(area: str, obj: Dict[str, Any], kind: str) -> str:
    if obj.get("created_edit"):
        return f"area:{area}:edit:{obj['created_edit']}"
    if obj.get("source") == "osm" or obj.get("source") == "edited":
        ref = _osm_ref(obj["id"])
        if ref:
            return f"osm:{kind}:{ref}"
    return f"area:{area}:{obj['id']}"


def building_source_key(area: str, b: Dict[str, Any]) -> str:
    if b.get("created_edit"):
        return f"edit:{b['created_edit']}"
    if b.get("osm_id") and b["osm_id"] not in ("surveyor", "ai"):
        return f"osm:{b['osm_id']}"
    return f"area:{area}:{b['id']}"


# --------------------------------------------------------------------------- allocation (Sections 2 and 4)
def classify(b: Dict[str, Any], units_ground: int) -> Tuple[str, str]:
    """-> (kind, reason). kind: STRATA (3D units), SINGLE_TITLE (2D-Sufficiency), INF_PUB, PROPOSAL (AI, unverified)."""
    if str(b.get("footprint_source", "")).startswith("ai") and not b.get("verified"):
        return "PROPOSAL", "AI-extracted footprint awaiting surveyor verification (no ULPIN from AI output alone)"
    btype = (b.get("building_type") or "yes").lower()
    name = b.get("name") or ""
    if b.get("tenure") == "strata":
        return "STRATA", "Separately titled units (set by surveyor)"
    if b.get("tenure") == "single":
        return "SINGLE_TITLE", "Single title over the whole parcel column (set by surveyor)"
    if b.get("tenure") == "public":
        return "INF_PUB", "Public asset (set by surveyor)"
    if btype in PUBLIC_TYPES or (b["usage"] == "P" and PUBLIC_NAME.search(name)):
        return "INF_PUB", "Held by the State, a ULB, a statutory body or a PSU: one INF-PUB asset"
    if btype in RELIGIOUS:
        return "SINGLE_TITLE", "Religious sanctuary under institutional title stays on its 2D ULPIN"
    if b["usage"] == "P":
        return "SINGLE_TITLE", "Private institution (campus, hospital, school) stays on its host 2D ULPIN"
    if b["usage"] == "I" and units_ground <= 1:
        return "SINGLE_TITLE", "Single-occupier factory or shed: 2D-Sufficiency Rule"
    if units_ground <= 1 and b["floors"] <= 3 and b.get("area_m2", 0) <= 250:
        return "SINGLE_TITLE", "Plotted house or shop-house under one title: 2D-Sufficiency Rule (integrated basement included)"
    return "STRATA", "Multi-unit building: one 3D ULPIN per titled unit"


def level_code(floor: int) -> str:
    return f"S{-floor:02d}" if floor < 0 else f"L{floor:02d}"


def _geom_hash(poly: List[List[float]]) -> str:
    return hashlib.sha1(json.dumps([[round(x, 1), round(y, 1)] for x, y in poly]).encode()).hexdigest()[:12]


# --------------------------------------------------------------------------- per-area lifecycle ledger (Section 6)
def area_lock(key: str) -> threading.Lock:
    with _inf_lock:
        return _area_locks.setdefault(key, threading.Lock())


def read_ledger(key: str) -> Dict[str, Any]:
    return cache.read_json(key, "ids.json") or {"anchors": {}, "units": [], "events": []}


class UnitLedger:
    """Append-only record of every unit ID ever minted in an area, with retirement and lineage."""

    def __init__(self, key: str):
        self.key = key
        self.data = read_ledger(key) if key else {"anchors": {}, "units": [], "events": []}
        self.now = time.time()
        self.seen: set = set()
        self.by_id = {u["id"]: u for u in self.data["units"]}

    def building_no(self, anchor: str, bkey: str) -> int:
        a = self.data["anchors"].setdefault(anchor, {"next": 1, "buildings": {}})
        if bkey not in a["buildings"]:
            a["buildings"][bkey] = a["next"]
            a["next"] += 1
        return a["buildings"][bkey]

    def active_on(self, bkey: str, floor: int) -> List[Dict[str, Any]]:
        return [u for u in self.data["units"] if u["bkey"] == bkey and u["floor"] == floor and u["status"] in MINTED]

    def issued_numbers(self, bkey: str, floor: int) -> set:
        return {u["unit_code"] for u in self.data["units"] if u["bkey"] == bkey and u["floor"] == floor}

    def event(self, kind: str, uid: str, reason: str, parents: Optional[List[str]] = None):
        self.data["events"].append({"at": self.now, "kind": kind, "id": uid, "reason": reason, **({"parents": parents} if parents else {})})

    def mint(self, anchor: str, bl: int, bkey: str, building_id: str, floor: int, units: List[Dict[str, Any]],
             whole_floor: bool, status: str, usage_class: str, parents: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        issued = self.issued_numbers(bkey, floor)
        out = []
        for u in units:
            code = None
            if whole_floor and "UFLR" not in issued:
                code = "UFLR"
            if code is None:
                n = u["index"]
                code = f"U{floor * 100 + n:03d}"
                while code in issued:  # never reuse a unit number on this building and level
                    n += 1
                    code = f"U{floor * 100 + n:03d}"
            issued.add(code)
            uid = f"{anchor}-BL{bl:02d}-{level_code(floor)}-{code}"
            if uid in self.by_id or not valid_unit_id(uid):
                raise ValueError(f"3D ULPIN {uid} would be reused or is malformed")
            rec = {"id": uid, "anchor": anchor, "bkey": bkey, "building_id": building_id, "floor": floor,
                   "unit_index": u["index"], "unit_code": code, "status": status, "usage_class": usage_class,
                   "geom": _geom_hash(u["polygon"]), "version": 1, "minted_at": self.now, "parents": parents or []}
            self.data["units"].append(rec)
            self.by_id[uid] = rec
            self.event("MINT", uid, "minted" if not parents else "minted from partition / merger", parents)
            out.append(rec)
        return out

    def retire(self, rec: Dict[str, Any], status: str, reason: str):
        rec["status"] = status
        rec["retired_at"] = self.now
        rec["retire_reason"] = reason
        self.event("RETIRE" if status == "RETIRED" else "DEMOLISH", rec["id"], reason)

    def close(self, live_buildings: set):
        """Anything minted before but not seen in this rebuild is retired (never reused)."""
        for rec in self.data["units"]:
            if rec["status"] in MINTED and rec["id"] not in self.seen:
                if rec["bkey"] not in live_buildings:
                    self.retire(rec, "HISTORICAL_DEMOLISHED", "building removed from the record")
                else:
                    self.retire(rec, "RETIRED", "volume no longer exists as a separately titled unit")

    def save(self):
        if self.key:
            cache.write_json(self.key, "ids.json", self.data)


# --------------------------------------------------------------------------- UDS (Edge Case 9, Axiom 6)
def uds_ppm(weights: List[float]) -> List[int]:
    """Integer parts per million summing to exactly 1,000,000 (largest-remainder method)."""
    if not weights:
        return []
    total = sum(weights) or 1.0
    raw = [w / total * 1_000_000 for w in weights]
    base = [int(r) for r in raw]
    for i in sorted(range(len(raw)), key=lambda i: raw[i] - base[i], reverse=True)[: 1_000_000 - sum(base)]:
        base[i] += 1
    return base


# --------------------------------------------------------------------------- infrastructure (Section 3, Edge Case 1)
def assign_infrastructure(scene: Dict[str, Any], area: str) -> Dict[str, int]:
    """INF IDs, norm clearances/buffers and parcel easements for tunnels, utilities, flyovers and public buildings."""
    zone = zone_code(scene)
    reqs, targets = [], []
    for a in scene["subsurface"]:
        if a["kind"] in TUNNEL_KINDS:
            cls = "TUN"
        elif a["kind"] in UTL_TYPE:
            cls = f"UTL-{UTL_TYPE[a['kind']]}"
        else:
            continue  # basements are part of their building (common space or the 2D column)
        k = asset_source_key(area, a, cls)
        reqs.append((k, cls, zone, area))
        targets.append((a, k, cls))
    for coll in ("roads", "railways"):
        for r in scene.get(coll, []):
            if r.get("is_bridge") or (r.get("elevation_m") or 0) > 0:
                k = asset_source_key(area, r, "FLY")
                reqs.append((k, "FLY", zone, area))
                targets.append((r, k, "FLY"))
    ids = mint_inf(reqs)
    for obj, k, cls in targets:
        obj["inf_id"] = ids[k]
        if cls == "TUN":
            if obj.get("source") != "edited":
                obj["buffer_m"] = TUNNEL_CLEARANCE_M
            obj["tunnel_group"] = (obj.get("name") or obj["kind"]).split("(")[0].strip()
        elif cls.startswith("UTL-") and obj.get("source") != "edited":
            obj["buffer_m"] = UTL_BUFFER_M[cls[4:]]

    # Easements: each linear INF asset is recorded against every 2D parcel it crosses (no change to surface title).
    parcels = [p for p in scene["parcels"] if p.get("footprint")]
    tree = STRtree([Polygon(p["footprint"]).buffer(0) for p in parcels]) if parcels else None
    for p in scene["parcels"]:
        p["encumbrances"] = []
    n_ease = 0
    for obj, _, cls in targets:
        if tree is None or "path" not in obj or len(obj["path"]) < 2:
            continue
        half = (obj.get("width_m") or 0) / 2 if cls == "FLY" else (obj.get("radius_m") or 0) + (obj.get("buffer_m") or 0)
        env = LineString(obj["path"]).buffer(max(half, 0.5))
        hits = [parcels[i] for i in tree.query(env) if Polygon(parcels[i]["footprint"]).buffer(0).intersects(env)]
        obj["affected_ulpins"] = sorted({p["ulpin"] for p in hits})
        kind = "AIRSPACE_EASEMENT" if cls == "FLY" else "SUBSURFACE_EASEMENT"
        for p in hits:
            p["encumbrances"].append({"inf_id": obj["inf_id"], "type": kind})
            n_ease += 1
    return {"inf_assets": len(set(ids.values())), "easements": n_ease}


# --------------------------------------------------------------------------- integrity axioms (Section 7)
def integrity(scene: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, List[str]]]:
    """Axioms 2, 3, 5 between real geometry; 1, 4, 6, 7 hold by construction and are re-checked on the registry.
    Returns (report, {building_id: [open failures]})."""
    fails: Dict[str, List[str]] = {}
    report: Dict[str, Any] = {}
    blds = scene["buildings"]
    geoms = []
    for b in blds:
        g = Polygon(b["footprint"])
        geoms.append(g if g.is_valid else g.buffer(0))

    # Axiom 1: closed solid with positive volume (footprint valid, height > 0)
    bad1 = [b["id"] for b, g in zip(blds, geoms) if g.is_empty or g.area <= 0 or b["height"] - b["min_height"] <= 0]
    report["axiom1_closed_solid"] = {"checked": len(blds), "failures": bad1}

    # Axiom 2: no two building envelopes share interior volume
    tree = STRtree(geoms) if geoms else None
    bad2 = []
    for i, g in enumerate(geoms):
        for j in (tree.query(g) if tree is not None else []):
            if j <= i:
                continue
            ov = g.intersection(geoms[j]).area
            zi = (blds[i]["base_z"] + blds[i]["min_height"], blds[i]["base_z"] + blds[i]["height"])
            zj = (blds[j]["base_z"] + blds[j]["min_height"], blds[j]["base_z"] + blds[j]["height"])
            dz = min(zi[1], zj[1]) - max(zi[0], zj[0])
            if ov > EPS_AREA and dz > 0 and ov * dz > EPS_VOL:
                bad2.append(f"{blds[i]['id']} ∩ {blds[j]['id']}: {ov:.1f} m² × {dz:.1f} m")
                for k in (i, j):
                    fails.setdefault(blds[k]["id"], []).append(f"Axiom 2: volume overlaps {blds[j if k == i else i]['id']}")
    report["axiom2_disjoint"] = {"checked": len(blds), "failures": bad2}

    # Axiom 5: building footprint covered by its 2D parcel
    parcels = {p["id"]: p for p in scene["parcels"]}
    bad5 = []
    for b, g in zip(blds, geoms):
        p = parcels.get(b.get("parcel_id"))
        if not p or not p.get("footprint"):
            continue
        pg = Polygon(p["footprint"]).buffer(0.01)
        if g.difference(pg).area > EPS_AREA:
            bad5.append(b["id"])
            fails.setdefault(b["id"], []).append("Axiom 5: footprint not covered by its 2D parcel")
    report["axiom5_footprint_in_parcel"] = {"checked": len(blds), "failures": bad5}

    # Axiom 3: INF envelopes vs building volumes (basements below, decks above)
    bad3 = []
    by_id = {b["id"]: (b, g) for b, g in zip(blds, geoms)}
    for a in scene["subsurface"]:
        if a["kind"] not in TUNNEL_KINDS and a["kind"] not in UTL_TYPE or "path" not in a:
            continue
        reach = (a.get("radius_m") or 0) + (a.get("buffer_m") or 0)
        env = LineString(a["path"]).buffer(max(reach, 0.3))
        top = a["depth_m"] - reach  # shallowest depth of the envelope
        for j in (tree.query(env) if tree is not None else []):
            b = blds[j]
            depth = (b.get("basement_levels") or 0) * 3.3 + 0.5 if b.get("basement_levels") else 0
            if depth and geoms[j].intersects(env) and depth > top:
                bad3.append(f"{a.get('inf_id', a['id'])} × {b['id']} basement")
                fails.setdefault(b["id"], []).append(f"Axiom 3: basement reaches the envelope of {a.get('inf_id', a['id'])}")
    for coll in ("roads", "railways"):
        for r in scene.get(coll, []):
            elev = r.get("elevation_m") or 0
            if elev <= 0 or "path" not in r:
                continue
            env = LineString(r["path"]).buffer(max((r.get("width_m") or 9) / 2, 1))
            for j in (tree.query(env) if tree is not None else []):
                b = blds[j]
                if b["height"] > elev - 1.5 and geoms[j].intersection(env).area > 4:
                    bad3.append(f"{r.get('inf_id', r['id'])} × {b['id']}")
                    fails.setdefault(b["id"], []).append(f"Axiom 3: rises into the deck envelope of {r.get('inf_id', r['id'])}")
    report["axiom3_asset_conflict"] = {"checked": len(scene["subsurface"]), "failures": bad3}
    return report, fails
