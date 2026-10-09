"""Groq LLM for human-readable text only (names, ward summary). It never decides geometry or compliance."""
import json
import logging
from typing import Any, Dict, List

from faker import Faker

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SUFFIX = {"R": ["Residency", "Apartments", "Enclave", "Heights", "House"],
          "C": ["Plaza", "Complex", "Arcade", "Business Centre", "Trade Tower"],
          "M": ["Mixed-Use Block", "Market Complex", "Galleria"],
          "I": ["Works", "Warehouse", "Industrial Shed"],
          "P": ["Public Building", "Institute", "Civic Centre"]}


def fallback_names(buildings: List[Dict[str, Any]], seed: int) -> Dict[str, str]:
    fake = Faker("en_IN")
    names = {}
    for b in buildings:
        fake.seed_instance(seed ^ b["seed"])
        opts = SUFFIX.get(b["usage"], SUFFIX["R"])
        names[b["id"]] = f"{fake.last_name()} {opts[b['seed'] % len(opts)]}"
    return names


def _client():
    s = get_settings()
    if not s.GROQ_API_KEY:
        return None, None
    from groq import Groq

    return Groq(api_key=s.GROQ_API_KEY, timeout=40), s.GROQ_MODEL


def enrich(buildings: List[Dict[str, Any]], place: Dict[str, Any], stats: Dict[str, Any], seed: int) -> Dict[str, Any]:
    """Returns {"names": {building_id: name}, "summary": str, "llm": {...provenance}}."""
    unnamed = [b for b in buildings if not b.get("name")]
    names = fallback_names(unnamed, seed)
    summary = (f"{place.get('locality', 'Survey area')}, {place.get('city', '')}: {stats['buildings']} buildings "
               f"({stats['volumetric_units']} volumetric units), {stats['roads']} road segments and "
               f"{stats['subsurface_assets']} subsurface assets were modelled. {stats['violations']} compliance findings.")
    provenance = {"provider": "faker", "model": None}

    client, model = _client()
    if client is None:
        return {"names": names, "summary": summary, "llm": provenance}

    sample = sorted(unnamed, key=lambda b: -b["geom"].area)[:40]
    payload = [{"id": b["id"], "osm_type": b["building_type"], "usage": b["usage"], "floors": b["floors"],
                "footprint_m2": round(b["geom"].area)} for b in sample]
    prompt = (
        "You label buildings in a 3D land-records prototype for an Indian city. "
        f"Locality: {place.get('display_name') or place.get('locality')}.\n"
        "Give each building a short, plausible, generic Indian name that fits its use and size "
        "(e.g. 'Sharma Residency', 'Krishna Market Complex'). Never use real company or brand names. "
        "Also write a 2-sentence neutral summary of the area for a municipal surveyor using these stats: "
        f"{json.dumps(stats)}.\n"
        'Return JSON: {"names": {"<id>": "<name>"}, "summary": "<text>"}\n'
        f"Buildings: {json.dumps(payload)}"
    )
    for attempt_model in [model, "llama-3.1-8b-instant"]:
        try:
            resp = client.chat.completions.create(
                model=attempt_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.4,
                max_tokens=2500,
            )
            data = json.loads(resp.choices[0].message.content)
            for bid, name in (data.get("names") or {}).items():
                if bid in names and isinstance(name, str) and 2 < len(name) < 60:
                    names[bid] = name.strip()
            if isinstance(data.get("summary"), str):
                summary = data["summary"].strip()
            provenance = {"provider": "groq", "model": attempt_model}
            break
        except Exception as exc:
            logger.warning("Groq call with %s failed: %s", attempt_model, exc)
    return {"names": names, "summary": summary, "llm": provenance}


def owner_name(seed: int) -> str:
    fake = Faker("en_IN")
    fake.seed_instance(seed)
    return fake.name()
