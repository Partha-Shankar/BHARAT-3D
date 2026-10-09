"""Turn raw OSM building records into measured buildings with height provenance."""
import re
from typing import Any, Dict, List, Optional

from shapely.geometry import Polygon

from app.realgen.geo import LocalFrame, stable_int

FLOOR_HEIGHT_M = 3.2

RESIDENTIAL = {"house", "residential", "apartments", "detached", "semidetached_house", "terrace", "dormitory", "bungalow", "hut"}
COMMERCIAL = {"commercial", "retail", "office", "hotel", "supermarket", "kiosk", "mall"}
INDUSTRIAL = {"industrial", "warehouse", "factory", "manufacture", "storage_tank", "hangar"}
PUBLIC = {"school", "college", "university", "hospital", "government", "public", "civic", "kindergarten",
          "temple", "mosque", "church", "gurudwara", "religious", "train_station", "transportation", "fire_station"}
MINOR = {"garage", "garages", "shed", "roof", "carport", "toilets", "service", "construction", "ruins"}

# Typical storeys by OSM building tag where nothing better is known (Indian urban stock).
DEFAULT_LEVELS = {
    "house": 2, "residential": 4, "apartments": 7, "detached": 2, "terrace": 3, "dormitory": 4,
    "commercial": 4, "retail": 2, "office": 7, "hotel": 6, "industrial": 2, "warehouse": 2,
    "school": 3, "college": 4, "university": 4, "hospital": 5, "government": 4, "public": 3,
    "garage": 1, "garages": 1, "shed": 1, "roof": 1, "temple": 2, "mosque": 2, "church": 2,
}

_NUM = re.compile(r"[-+]?\d*\.?\d+")


def parse_metres(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    m = _NUM.search(value.replace(",", "."))
    if not m:
        return None
    num = float(m.group())
    if "'" in value or "ft" in value.lower():
        num *= 0.3048
    return num if 0 < num < 900 else None


def parse_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    m = _NUM.search(value)
    if not m:
        return None
    try:
        n = int(round(float(m.group())))
    except ValueError:
        return None
    return n if 0 <= n < 200 else None


def usage_code(tags: Dict[str, str]) -> str:
    btype = tags.get("building", "yes")
    if btype in RESIDENTIAL:
        return "R"
    if btype in COMMERCIAL or tags.get("shop") or tags.get("office"):
        return "M" if btype in RESIDENTIAL else "C"
    if btype in INDUSTRIAL:
        return "I"
    if btype in PUBLIC or tags.get("amenity") in {"school", "hospital", "place_of_worship", "college", "townhall"}:
        return "P"
    return "R"


# Village and sparse peri-urban stock is mostly single storey; about one home in four has an upper floor.
RURAL_LEVELS = {"house": 1, "detached": 1, "hut": 1, "bungalow": 1, "semidetached_house": 1, "terrace": 1, "farm": 1,
                "retail": 1, "commercial": 1, "temple": 1, "mosque": 1, "church": 1, "religious": 1, "shed": 1,
                "school": 2, "residential": 2, "apartments": 3}
RURAL_DENSITY_PER_HA = 4.0  # buildings per hectare below which the area is treated as rural
RURAL_MAX_COVERAGE = 0.3  # ... provided buildings also cover less than this share of the ground


def default_levels(btype: str, area_m2: float, seed: int, rural: bool = False) -> int:
    if rural and btype not in MINOR:
        base = RURAL_LEVELS.get(btype, 1 if area_m2 < 200 else 2)
        if base == 1 and btype in RESIDENTIAL | {"yes"} and seed % 4 == 0:
            base = 2
        return base
    if btype in DEFAULT_LEVELS:
        base = DEFAULT_LEVELS[btype]
    elif btype in MINOR:
        base = 1
    else:  # building=yes: infer from footprint size
        base = 2 if area_m2 < 80 else 3 if area_m2 < 250 else 4 if area_m2 < 900 else 5
    jitter = (seed % 3) - 1 if base >= 3 else 0  # -1, 0, +1
    return max(1, base + jitter)


def measure_buildings(raw: List[Dict[str, Any]], survey_ll: Polygon, frame: LocalFrame) -> List[Dict[str, Any]]:
    buildings = []
    for rec in raw:
        geom_ll = rec["geom"]
        if not survey_ll.contains(geom_ll.representative_point()):
            continue
        local = frame.to_local(geom_ll).simplify(0.15, preserve_topology=True)
        if local.is_empty or local.area < 8.0:
            continue
        tags = rec["tags"]
        btype = tags.get("building", "yes")
        seed = stable_int(rec["osm_id"])

        height = parse_metres(tags.get("height")) or parse_metres(tags.get("building:height"))
        levels = parse_int(tags.get("building:levels"))
        min_height = parse_metres(tags.get("min_height")) or (
            (parse_int(tags.get("building:min_level")) or 0) * FLOOR_HEIGHT_M
        )

        if height:
            height_source = "osm:height"
            floors = levels or max(1, round((height - min_height) / FLOOR_HEIGHT_M))
        elif levels:
            height_source = "osm:levels"
            floors = levels
            height = min_height + levels * FLOOR_HEIGHT_M + (0.6 if levels > 1 else 0.3)
        else:
            height_source = "estimated:typology"
            floors = default_levels(btype, local.area, seed)
            height = min_height + floors * FLOOR_HEIGHT_M + 0.3

        buildings.append({
            "osm_id": rec["osm_id"],
            "geom": local,
            "tags": tags,
            "building_type": btype,
            "name": tags.get("name") or tags.get("name:en"),
            "usage": usage_code(tags),
            "height": round(float(height), 2),
            "min_height": round(float(min_height), 2),
            "floors": int(floors),
            "height_source": height_source,
            "footprint_source": "osm",
            "roof_shape": tags.get("roof:shape", "flat"),
            "basement_levels": parse_int(tags.get("building:levels:underground")) or 0,
            "seed": seed,
        })
    return buildings


def apply_context_defaults(buildings: List[Dict[str, Any]], survey_area_m2: float) -> bool:
    """In a village or sparse fringe, untagged buildings take the rural storey counts. Returns True if rural."""
    area = survey_area_m2 or 1.0
    density = len(buildings) / (area / 10_000)
    coverage = sum(b["geom"].area for b in buildings) / area
    rural = bool(buildings) and density < RURAL_DENSITY_PER_HA and coverage < RURAL_MAX_COVERAGE
    if rural:
        for b in buildings:
            if b["height_source"] != "estimated:typology":
                continue
            floors = default_levels(b["building_type"], b["geom"].area, b["seed"], rural=True)
            b["floors"] = floors
            b["height"] = round(b["min_height"] + floors * FLOOR_HEIGHT_M + 0.3, 2)
            b["height_source"] = "estimated:typology:rural"
    return rural


def ai_building(geom, score: float, method: str) -> Dict[str, Any]:
    """A footprint detected in the imagery (no OSM record): typology height until a model or surveyor refines it."""
    c = geom.centroid
    seed = stable_int("ai", round(c.x, 1), round(c.y, 1))
    floors = default_levels("yes", geom.area, seed)
    return {
        "osm_id": "ai", "geom": geom, "tags": {}, "building_type": "yes", "name": None, "usage": "R",
        "height": round(floors * FLOOR_HEIGHT_M + 0.3, 2), "min_height": 0.0, "floors": floors,
        "height_source": "estimated:typology", "footprint_source": f"ai:{method}", "roof_shape": "flat",
        "basement_levels": 0, "seed": seed, "ai_score": score,
    }
