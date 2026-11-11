# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Check character for BHARAT 3D identifiers (specification: docs/ID_SPEC.md).

The registry stores every identifier in its canonical form (the patterns in ``norms.py``). Wherever an identifier is
printed, exported, copied or typed it carries one check character after a final hyphen, the *issued form*::

    MP210O46RALYNV-BL01-L00-U001      canonical (registry key, never changes)
    MP210O46RALYNV-BL01-L00-U001-K    issued (what people read and type)

The check character is ISO/IEC 7064 MOD 37-36 (hybrid system, alphabet 0-9 A-Z; the same check as the GRid
standard) computed over the identifier's letters and digits in order, hyphens ignored. It catches every single
mistyped character; of swaps of two neighbouring characters it catches all but a rare few (measured on the real
3D ULPINs of the bundled demo area in ``tests/unit/test_idcheck.py``: 3 of 5,988 missed).
Software never derives meaning from the check character; it only rejects mistyped identifiers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.realgen.norms import CSR_RE, INF_RE, UNIT_RE, UTL_RE

ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_MOD = len(ALPHABET)  # 36
BASE_ULPIN_RE = re.compile(r"^[0-9A-Z]{14}$")

# kind -> canonical pattern (the order matters only for reporting; the patterns do not overlap)
PATTERNS: dict[str, re.Pattern] = {
    "unit": UNIT_RE,  # 3D ULPIN of a titled volume
    "utility": UTL_RE,  # INF-UTL subsurface corridor
    "infrastructure": INF_RE,  # INF-TUN/FLY/AIR/PUB/PRK/MAR
    "common_space": CSR_RE,  # Common Space Registry entry
    "ulpin": BASE_ULPIN_RE,  # 14-character base (2D) ULPIN
}


class CheckCharacterError(ValueError):
    """An issued identifier whose check character does not match: it was probably mistyped."""


def _value(ch: str) -> int:
    i = ALPHABET.find(ch)
    if i < 0:
        raise ValueError(f"character {ch!r} is not allowed in an identifier")
    return i


def _digits(identifier: str) -> str:
    return identifier.replace("-", "")


def check_char(identifier: str) -> str:
    """ISO/IEC 7064 MOD 37-36 check character of an identifier (letters and digits, hyphens ignored)."""
    p = _MOD
    for ch in _digits(identifier.strip().upper()):
        s = (p + _value(ch)) % _MOD or _MOD
        p = (2 * s) % (_MOD + 1)
    return ALPHABET[(_MOD + 1 - p) % _MOD]


def is_consistent(identifier_with_check: str) -> bool:
    """True when the last character is the correct check character of everything before it."""
    body = identifier_with_check.strip().upper()
    if len(_digits(body)) < 2 or not body[-1].isalnum():
        return False
    return check_char(body[:-1].rstrip("-")) == body[-1]


def kind_of(canonical: str) -> str | None:
    for kind, pattern in PATTERNS.items():
        if pattern.match(canonical):
            return kind
    return None


def issue(canonical: str) -> str:
    """The issued form of a canonical identifier: ``<canonical>-<check>``."""
    canonical = canonical.strip().upper()
    if kind_of(canonical) is None:
        raise ValueError(f"{canonical!r} is not a canonical BHARAT 3D identifier")
    return f"{canonical}-{check_char(canonical)}"


def issued_or_none(canonical: str | None) -> str | None:
    """Issued form, or None for a missing or non-canonical value (e.g. a demo placeholder)."""
    if not canonical:
        return None
    try:
        return issue(canonical)
    except ValueError:
        return None


@dataclass(frozen=True)
class ParsedId:
    canonical: str
    kind: str
    check: str | None  # the check character as typed, None for the canonical form


def parse(text: str) -> ParsedId | None:
    """Read a typed identifier in canonical or issued form; None when it is not an identifier at all.

    Raises CheckCharacterError for the issued form of a valid identifier with the wrong check character.
    """
    value = (text or "").strip().upper()
    kind = kind_of(value)
    if kind is not None:
        return ParsedId(value, kind, None)
    if len(value) > 2 and value[-2] == "-":
        body, check = value[:-2], value[-1]
        kind = kind_of(body)
        if kind is not None:
            if check_char(body) != check:
                raise CheckCharacterError(
                    f"The check character of {value} does not match: the identifier was probably mistyped. "
                    "Check every character and try again.")
            return ParsedId(body, kind, check)
    return None


def canonical_query(text: str) -> str:
    """A search box value with a correct check character removed, so issued IDs find their registry entry.
    Free text (names, partial IDs) is returned unchanged. Raises CheckCharacterError for a wrong check character."""
    parsed = parse(text)
    return parsed.canonical if parsed is not None else text
