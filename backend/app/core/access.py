# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Role-based views of personal and financial fields (policy: docs/ACCESS_POLICY.md).

Every role sees the same geometry, identifiers, levels, areas, UDS, lineage, compliance findings and subsurface
assets. What differs is personal and financial data: owner names, identity documents, tenancy, tax, and the e-mail
addresses of the people who edited an area.

Rules of this module:

* Pure: no I/O, no globals mutated. Redactors never mutate their input; they work on a deep copy, because scene and
  registry dicts come from the shared on-disk cache.
* SURVEYOR and ADMIN short-circuit: the redactors return the very object they were given.
* Shape-preserving: a redacted response has the same keys, nesting and JSON types as the full one. Hidden text
  becomes ``RESTRICTED``, a hidden status becomes ``NOT_DISCLOSED`` (the 3D panel shows it as "NOT DISCLOSED"),
  a hidden number becomes ``0`` of the same numeric type, and ``None`` stays ``None``.
"""
from __future__ import annotations

import copy
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from typing import Any, TypeVar

T = TypeVar("T")

# --------------------------------------------------------------------------- views and roles
FULL = "full"
MUNICIPAL = "municipal"
UTILITY = "utility"
PUBLIC = "public"
VIEWS = (FULL, MUNICIPAL, UTILITY, PUBLIC)
VIEW_HEADER = "X-BHARAT3D-View"  # response header naming the view that was served

PUBLIC_ROLE = "PUBLIC"  # no valid token
ROLE_VIEW: dict[str, str] = {
    "SURVEYOR": FULL,
    "ADMIN": FULL,
    "MUNICIPALITY": MUNICIPAL,
    "UTILITY_OPERATOR": UTILITY,
    "CITIZEN": PUBLIC,
    PUBLIC_ROLE: PUBLIC,
}
ROLE_LABEL: dict[str, str] = {
    "SURVEYOR": "Surveyor",
    "ADMIN": "Administrator",
    "MUNICIPALITY": "Municipal officer",
    "UTILITY_OPERATOR": "Utility operator",
    "CITIZEN": "Citizen",
}
UNKNOWN_LABEL = "Registered user"  # an editor whose account cannot be found

RESTRICTED = "Restricted"
NOT_DISCLOSED = "NOT_DISCLOSED"


class Action(str, Enum):
    """What a view does with one group of fields."""

    KEEP = "keep"
    MASK = "mask"  # names: initials ("P**** M****"); documents: last 4 characters ("*************0981")
    HIDE = "hide"  # replaced by a same-type placeholder
    LABEL = "label"  # editor e-mail replaced by the editor's role label


@dataclass(frozen=True)
class ViewPolicy:
    """One column of the access policy table."""

    view: str
    owner: Action
    masked_id: Action
    title_deed: Action
    tenancy: Action  # tenant name, lease rent and status, occupancy
    tax: Action  # annual tax, assessed value, payment status, amounts paid and due
    editor: Action  # "by" of edits and survey packages

    @property
    def is_full(self) -> bool:
        return self.view == FULL


_KEEP, _MASK, _HIDE, _LABEL = Action.KEEP, Action.MASK, Action.HIDE, Action.LABEL
POLICIES: dict[str, ViewPolicy] = {  # the table in docs/ACCESS_POLICY.md, column by column
    FULL: ViewPolicy(FULL, owner=_KEEP, masked_id=_KEEP, title_deed=_KEEP, tenancy=_KEEP, tax=_KEEP, editor=_KEEP),
    MUNICIPAL: ViewPolicy(MUNICIPAL, owner=_KEEP, masked_id=_KEEP, title_deed=_KEEP, tenancy=_KEEP, tax=_KEEP,
                          editor=_LABEL),
    UTILITY: ViewPolicy(UTILITY, owner=_MASK, masked_id=_HIDE, title_deed=_HIDE, tenancy=_HIDE, tax=_HIDE,
                        editor=_LABEL),
    PUBLIC: ViewPolicy(PUBLIC, owner=_MASK, masked_id=_HIDE, title_deed=_MASK, tenancy=_HIDE, tax=_HIDE,
                       editor=_LABEL),
}

# Field catalogue per response shape: key -> (policy group, value kind). Kinds: name, document, text, status, number.
UNIT_FIELDS: dict[str, tuple[str, str]] = {  # realgen building detail, per unit
    "owner": ("owner", "name"),
    "occupancy": ("tenancy", "status"),
    "annual_tax_inr": ("tax", "number"),
}
LEGACY_UNIT_FIELDS: dict[str, tuple[str, str]] = {  # /api/units/{id} and /api/citizen/* records
    "owner_name": ("owner", "name"),
    "masked_id": ("masked_id", "text"),
    "title_deed": ("title_deed", "document"),
    "tenant_name": ("tenancy", "text"),
    "occupancy_status": ("tenancy", "status"),
    "lease_status": ("tenancy", "status"),
    "annual_tax": ("tax", "number"),
    "payment_status": ("tax", "status"),
}
OWNERSHIP_FIELDS: dict[str, tuple[str, str]] = {
    "owner_name": ("owner", "name"),
    "masked_id": ("masked_id", "text"),
    "title_deed": ("title_deed", "document"),
}
LEASE_FIELDS: dict[str, tuple[str, str]] = {
    "tenant_name": ("tenancy", "text"),
    "monthly_rent": ("tenancy", "number"),
    "status": ("tenancy", "status"),
}
TAX_FIELDS: dict[str, tuple[str, str]] = {
    "annual_tax": ("tax", "number"),
    "assessed_value": ("tax", "number"),
    "amount_paid": ("tax", "number"),
    "amount_due": ("tax", "number"),
    "payment_status": ("tax", "status"),
}


# --------------------------------------------------------------------------- viewer
def role_value(role: Any) -> str:
    """'SURVEYOR' for RoleEnum.SURVEYOR or 'SURVEYOR'; '' for None."""
    return str(getattr(role, "value", role) or "")


def viewer_role(user: Any | None) -> str:
    """The caller's role name, or ``"PUBLIC"`` when there is no valid signed-in user."""
    if user is None:
        return PUBLIC_ROLE
    return role_value(getattr(user, "role", None)) or PUBLIC_ROLE


def view_for(role: str) -> str:
    """View served to a role; unknown roles fail closed to the public view."""
    return ROLE_VIEW.get(role, PUBLIC)


def view_of(user: Any | None) -> str:
    return view_for(viewer_role(user))


def policy(view: str) -> ViewPolicy:
    """The policy column for a view; unknown views fail closed to the public view."""
    return POLICIES.get(view, POLICIES[PUBLIC])


# --------------------------------------------------------------------------- masking helpers
def mask_name(name: Any) -> Any:
    """``"Priya Mehta"`` -> ``"P**** M****"``: the first character of each word and four stars, so the length of the
    name does not leak. Non-strings and empty strings are returned unchanged."""
    if not isinstance(name, str) or not name.strip():
        return name
    return " ".join(word[0] + "****" for word in name.split())


def mask_tail(value: Any, keep: int = 4) -> Any:
    """Keep the last ``keep`` characters and star the rest: ``"DEED-DL-2024-0981"`` -> ``"*************0981"``.
    A value no longer than ``keep`` is starred completely. Non-strings are returned unchanged."""
    if not isinstance(value, str) or not value:
        return value
    keep = max(0, keep)
    if len(value) <= keep:
        return "*" * len(value)
    return "*" * (len(value) - keep) + (value[-keep:] if keep else "")


def role_label(role: Any) -> str:
    """Human label for a role, e.g. ``"Surveyor"``; unknown roles get ``UNKNOWN_LABEL``."""
    return ROLE_LABEL.get(role_value(role), UNKNOWN_LABEL)


def _hidden(value: Any, kind: str) -> Any:
    """Same-type placeholder for a hidden value."""
    if value is None:
        return None
    if isinstance(value, (int, float)):  # bool included: type(True)(0) is False
        return type(value)(0)
    return NOT_DISCLOSED if kind == "status" else RESTRICTED


def _apply(action: Action, value: Any, kind: str) -> Any:
    if action is Action.KEEP:
        return value
    if action is Action.MASK:
        return mask_name(value) if kind == "name" else mask_tail(value)
    return _hidden(value, kind)


def _redact_fields(record: dict[str, Any], pol: ViewPolicy, fields: Mapping[str, tuple[str, str]]) -> None:
    """In place, on a record the caller already copied."""
    for key, (group, kind) in fields.items():
        if key in record:
            record[key] = _apply(getattr(pol, group), record[key], kind)


def _redact_record(record: T, view: str, fields: Mapping[str, tuple[str, str]]) -> T:
    pol = policy(view)
    if pol.is_full or not isinstance(record, dict):
        return record
    out = copy.deepcopy(record)
    _redact_fields(out, pol, fields)
    return out


# --------------------------------------------------------------------------- redactors, one per response shape
def redact_building_detail(detail: T, view: str) -> T:
    """``GET /api/realgen/scenes/{key}/buildings/{id}``: owner, occupancy and tax of every unit."""
    pol = policy(view)
    if pol.is_full or not isinstance(detail, dict):
        return detail
    out = copy.deepcopy(detail)
    for floor in out.get("floors") or []:
        for unit in floor.get("units") or []:
            _redact_fields(unit, pol, UNIT_FIELDS)
    return out


def editor_emails(records: Iterable[Mapping[str, Any]]) -> set[str]:
    """The distinct ``by`` values of activity events or edit records (to look up their roles)."""
    return {r["by"] for r in records if isinstance(r.get("by"), str) and r["by"]}


def _relabel(records: T, view: str, labels: Mapping[str, str]) -> T:
    pol = policy(view)
    if pol.editor is not Action.LABEL or not isinstance(records, list):
        return records
    out = copy.deepcopy(records)
    for r in out:
        if isinstance(r, dict) and isinstance(r.get("by"), str) and r["by"]:
            r["by"] = labels.get(r["by"], UNKNOWN_LABEL)
    return out


def redact_activity(events: T, view: str, labels: Mapping[str, str]) -> T:
    """``GET /api/realgen/activity``: editor e-mails become role labels (``labels``: e-mail -> label).
    ``by: null`` (the generator) stays null."""
    return _relabel(events, view, labels)


def redact_edits(edits: T, view: str, labels: Mapping[str, str]) -> T:
    """``GET /api/realgen/scenes/{key}/edits``: editor e-mails become role labels."""
    return _relabel(edits, view, labels)


def redact_legacy_unit(unit: T, view: str) -> T:
    """``GET /api/units/{id}``."""
    return _redact_record(unit, view, LEGACY_UNIT_FIELDS)


def redact_ownership(record: T, view: str) -> T:
    """``GET /api/units/{id}/ownership``."""
    return _redact_record(record, view, OWNERSHIP_FIELDS)


def redact_lease(record: T, view: str) -> T:
    """``GET /api/units/{id}/lease``."""
    return _redact_record(record, view, LEASE_FIELDS)


def redact_tax(record: T, view: str) -> T:
    """``GET /api/units/{id}/tax``."""
    return _redact_record(record, view, TAX_FIELDS)


def redact_citizen_property(record: T, view: str) -> T:
    """``GET /api/citizen/property/{identifier}`` (a public lookup). ``/my-properties`` is the caller's own record
    and is not redacted."""
    return _redact_record(record, view, LEGACY_UNIT_FIELDS)
