# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Check character of BHARAT 3D identifiers (app/realgen/idcheck.py, docs/ID_SPEC.md)."""
from __future__ import annotations

import itertools
import json

import pytest

from app.realgen import idcheck
from tests.conftest import SEED_DIR, SEED_KEY


def _seed_ids() -> dict[str, list[str]]:
    reg = json.loads((SEED_DIR / SEED_KEY / "registry.json").read_text(encoding="utf-8"))
    scene = json.loads((SEED_DIR / SEED_KEY / "scene.json").read_text(encoding="utf-8"))
    return {
        "unit": sorted({e["vprid"] for e in reg if e["vprid"]}),
        "ulpin": sorted({p["ulpin"] for p in scene["parcels"] if p.get("ulpin")}),
        "utility": sorted({a["inf_id"] for a in scene["subsurface"] if a.get("inf_id")}),
        "common_space": sorted({c["id"] for c in scene.get("common_spaces") or []}),
    }


IDS = _seed_ids()


def test_published_test_vector() -> None:
    # ISO/IEC 7064 MOD 37-36 as used by the GRid standard: A1-2425G-ABC1234002-M
    assert idcheck.check_char("A12425GABC1234002") == "M"
    assert idcheck.is_consistent("A12425GABC1234002M")


def test_spec_examples() -> None:  # the worked examples in docs/ID_SPEC.md
    assert idcheck.issue("MP210O46RALYNV-BL01-L00-U001") == "MP210O46RALYNV-BL01-L00-U001-C"
    assert idcheck.issue("INF-UTL-TEL-MP33-000013") == "INF-UTL-TEL-MP33-000013-" + idcheck.check_char("INFUTLTELMP33000013")
    assert idcheck.issue("MP210O46RALYNV") == "MP210O46RALYNV-" + idcheck.check_char("MP210O46RALYNV")


def test_hyphens_do_not_count() -> None:
    assert idcheck.check_char("MP210O46RALYNV-BL01-L00-U001") == idcheck.check_char("MP210O46RALYNVBL01L00U001")


@pytest.mark.parametrize("kind", ["unit", "ulpin", "utility", "common_space"])
def test_every_kind_round_trips(kind: str) -> None:
    assert IDS[kind], f"seed area has no {kind} identifiers"
    for canonical in IDS[kind]:
        issued = idcheck.issue(canonical)
        parsed = idcheck.parse(issued)
        assert parsed == idcheck.ParsedId(canonical, kind, issued[-1])
        assert idcheck.parse(canonical) == idcheck.ParsedId(canonical, kind, None)
        assert idcheck.parse(issued.lower()).canonical == canonical  # typed in lower case
        assert idcheck.canonical_query(f"  {issued} ") == canonical


def test_infrastructure_ids() -> None:
    for canonical in ("INF-TUN-MP33-0001", "INF-PUB-DL07-0042", "INF-PUB-DL07-0042-BL01-L02-U201"):
        assert idcheck.parse(idcheck.issue(canonical)).canonical == canonical


def test_every_single_typo_is_caught() -> None:
    sample = IDS["unit"][:60] + IDS["utility"][:20] + IDS["ulpin"][:20]
    for canonical in sample:
        issued = idcheck.issue(canonical)
        for i, ch in enumerate(issued):
            if ch == "-":
                continue
            for other in idcheck.ALPHABET:
                if other != ch:
                    assert not idcheck.is_consistent(issued[:i] + other + issued[i + 1:]), (issued, i, other)


def test_neighbour_swaps_are_caught_but_for_a_rare_few() -> None:
    swaps = missed = 0
    for canonical in IDS["unit"]:
        issued = idcheck.issue(canonical)
        pos = [i for i, ch in enumerate(issued) if ch != "-"]
        for a, b in itertools.pairwise(pos):
            if issued[a] == issued[b]:
                continue
            t = list(issued)
            t[a], t[b] = t[b], t[a]
            swaps += 1
            missed += idcheck.is_consistent("".join(t))
    assert swaps > 5000
    assert missed / swaps < 0.001  # documented: 3 of 5,988 on this area


def test_wrong_check_character_is_an_error() -> None:
    issued = idcheck.issue(IDS["unit"][0])
    wrong = issued[:-1] + ("A" if issued[-1] != "A" else "B")
    with pytest.raises(idcheck.CheckCharacterError, match="probably mistyped"):
        idcheck.parse(wrong)
    with pytest.raises(idcheck.CheckCharacterError):
        idcheck.canonical_query(wrong)


@pytest.mark.parametrize("text", ["", "Sharma Residency", "BLD-0001", "MP210O46", "VPR-TEST-0001", "U804", "-"])
def test_free_text_is_not_an_identifier(text: str) -> None:
    assert idcheck.parse(text) is None
    assert idcheck.canonical_query(text) == text


def test_issue_rejects_non_canonical_values() -> None:
    for bad in ("VPR-TEST-0001", "mp210o46ralynv-bl01", "", "IN-01-0008"):
        with pytest.raises(ValueError):
            idcheck.issue(bad)
        assert idcheck.issued_or_none(bad) is None
    assert idcheck.issued_or_none(None) is None


def test_characters_outside_the_alphabet_are_rejected() -> None:
    with pytest.raises(ValueError):
        idcheck.check_char("AB*C")
    assert not idcheck.is_consistent("A")
