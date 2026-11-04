# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Unit tests for app.core.access: the policy table, masking helpers and the shape-preserving redactors."""
import copy
from collections.abc import Callable
from types import SimpleNamespace
from typing import Any

import pytest

from app.core import access
from app.core.access import FULL, MUNICIPAL, PUBLIC, UTILITY, Action
from app.models.models import RoleEnum

NON_FULL = (MUNICIPAL, UTILITY, PUBLIC)


def _user(role: Any) -> SimpleNamespace:
    return SimpleNamespace(role=role)


# --------------------------------------------------------------------------- viewer and views
@pytest.mark.parametrize("user, role", [
    (None, "PUBLIC"),
    (_user(RoleEnum.SURVEYOR), "SURVEYOR"),
    (_user("CITIZEN"), "CITIZEN"),
    (_user(RoleEnum.UTILITY_OPERATOR), "UTILITY_OPERATOR"),
    (_user(None), "PUBLIC"),
    (SimpleNamespace(), "PUBLIC"),
])
def test_viewer_role(user: Any, role: str) -> None:
    assert access.viewer_role(user) == role


@pytest.mark.parametrize("role, view", [("SURVEYOR", FULL), ("ADMIN", FULL), ("MUNICIPALITY", MUNICIPAL),
                                        ("UTILITY_OPERATOR", UTILITY), ("CITIZEN", PUBLIC), ("PUBLIC", PUBLIC),
                                        ("SOMETHING_NEW", PUBLIC), ("", PUBLIC)])
def test_view_for_fails_closed(role: str, view: str) -> None:
    assert access.view_for(role) == view


def test_view_of_and_policy_fallback() -> None:
    assert access.view_of(_user(RoleEnum.ADMIN)) == FULL and access.view_of(None) == PUBLIC
    assert access.policy("no-such-view") is access.POLICIES[PUBLIC]
    assert set(access.POLICIES) == set(access.VIEWS)


def test_policy_table_matches_the_documented_policy() -> None:
    """docs/ACCESS_POLICY.md, column by column."""
    rows = {v: (p.owner, p.masked_id, p.title_deed, p.tenancy, p.tax, p.editor) for v, p in access.POLICIES.items()}
    K, M, H, L = Action.KEEP, Action.MASK, Action.HIDE, Action.LABEL
    assert rows == {
        FULL: (K, K, K, K, K, K),
        MUNICIPAL: (K, K, K, K, K, L),
        UTILITY: (M, H, H, H, H, L),
        PUBLIC: (M, H, M, H, H, L),
    }
    assert access.POLICIES[FULL].is_full and not any(access.POLICIES[v].is_full for v in NON_FULL)


# --------------------------------------------------------------------------- helpers
@pytest.mark.parametrize("name, masked", [
    ("Priya Mehta", "P**** M****"),
    ("Aarav", "A****"),
    ("  Test   Person  ", "T**** P****"),
    ("Dr. Test Q. Person", "D**** T**** Q**** P****"),
    ("Ab", "A****"),  # length never leaks
    ("", ""),
    ("   ", "   "),
    (None, None),
    (42, 42),
])
def test_mask_name(name: Any, masked: Any) -> None:
    assert access.mask_name(name) == masked


@pytest.mark.parametrize("value, keep, masked", [
    ("DEED-DL-2024-0981", 4, "*************0981"),
    ("ID-XXXX-8921", 4, "********8921"),
    ("1234", 4, "****"),
    ("abc", 4, "***"),
    ("abcdef", 2, "****ef"),
    ("abcdef", 0, "******"),
    ("abcdef", -3, "******"),
    ("", 4, ""),
    (None, 4, None),
    (1234567, 4, 1234567),
])
def test_mask_tail(value: Any, keep: int, masked: Any) -> None:
    assert access.mask_tail(value, keep) == masked


def test_mask_tail_default_keeps_four() -> None:
    assert access.mask_tail("TEST-DEED-0001") == "**********0001"


@pytest.mark.parametrize("role, label", [("SURVEYOR", "Surveyor"), (RoleEnum.ADMIN, "Administrator"),
                                         ("MUNICIPALITY", "Municipal officer"), ("UTILITY_OPERATOR", "Utility operator"),
                                         ("CITIZEN", "Citizen"), ("ROBOT", "Registered user"), (None, "Registered user")])
def test_role_label(role: Any, label: str) -> None:
    assert access.role_label(role) == label


def test_editor_emails() -> None:
    recs = [{"by": "a.tester@example.invalid"}, {"by": None}, {"by": ""}, {}, {"by": "a.tester@example.invalid"},
            {"by": "b.tester@example.invalid"}, {"by": 7}]
    assert access.editor_emails(recs) == {"a.tester@example.invalid", "b.tester@example.invalid"}


# --------------------------------------------------------------------------- building detail
def _detail() -> dict[str, Any]:
    unit = {"unit_no": "101", "vprid": "KA232C3EMBDLHY-BL01-L01-U101", "status": "PROVISIONAL", "owner": "Test Person",
            "occupancy": "LEASED", "annual_tax_inr": 21400, "uds_ppm": 250000, "built_up_m2": 61.5, "polygon": [[0, 0]]}
    return {"building": {"id": "BLD-0001", "name": "Test Residency"},
            "floors": [{"floor": 0, "status": "PROVISIONAL", "units": [unit, {**unit, "owner": "Other Tester"}]},
                       {"floor": 1, "units": []}],
            "common_spaces": [{"id": "CSR-1"}]}


def test_building_detail_full_is_the_same_object() -> None:
    d = _detail()
    assert access.redact_building_detail(d, FULL) is d


def test_building_detail_municipal_keeps_owner_and_tax() -> None:
    d = _detail()
    assert access.redact_building_detail(d, MUNICIPAL) == d


@pytest.mark.parametrize("view", [UTILITY, PUBLIC])
def test_building_detail_masks_owner_hides_tenancy_and_tax(view: str) -> None:
    d = _detail()
    out = access.redact_building_detail(d, view)
    u0, u1 = out["floors"][0]["units"]
    assert (u0["owner"], u1["owner"]) == ("T**** P****", "O**** T****")
    assert u0["occupancy"] == "NOT_DISCLOSED" and u0["annual_tax_inr"] == 0 and isinstance(u0["annual_tax_inr"], int)
    for k in ("unit_no", "vprid", "status", "uds_ppm", "built_up_m2", "polygon"):
        assert u0[k] == d["floors"][0]["units"][0][k]
    assert out["building"] == d["building"] and out["common_spaces"] == d["common_spaces"]


def test_building_detail_tolerates_odd_shapes() -> None:
    assert access.redact_building_detail(None, PUBLIC) is None
    assert access.redact_building_detail({"floors": None}, PUBLIC) == {"floors": None}
    out = access.redact_building_detail({"floors": [{"units": [{"owner": None, "annual_tax_inr": None}]}]}, PUBLIC)
    assert out == {"floors": [{"units": [{"owner": None, "annual_tax_inr": None}]}]}


# --------------------------------------------------------------------------- activity and edits
LABELS = {"surveyor.tester@example.invalid": "Surveyor", "admin.tester@example.invalid": "Administrator"}


def _events() -> list[dict[str, Any]]:
    return [{"kind": "generated", "by": None, "detail": {"buildings": 3}},
            {"kind": "ingested", "by": "surveyor.tester@example.invalid", "detail": {"datasets": []}},
            {"kind": "edit", "by": "admin.tester@example.invalid", "seq": 2, "detail": {"op": "building.update"}},
            {"kind": "edit", "by": "gone.tester@example.invalid", "seq": 1, "detail": {"op": "building.delete"}}]


def test_activity_full_is_the_same_object() -> None:
    ev = _events()
    assert access.redact_activity(ev, FULL, LABELS) is ev


@pytest.mark.parametrize("view", NON_FULL)
def test_activity_replaces_emails_with_role_labels(view: str) -> None:
    out = access.redact_activity(_events(), view, LABELS)
    assert [e["by"] for e in out] == [None, "Surveyor", "Administrator", "Registered user"]
    assert [e["detail"] for e in out] == [e["detail"] for e in _events()]
    assert "@" not in repr(out)


@pytest.mark.parametrize("view", NON_FULL)
def test_edits_replace_emails_with_role_labels(view: str) -> None:
    edits = [{"seq": 1, "by": "surveyor.tester@example.invalid", "op": {"op": "road.add"}},
             {"seq": 2, "by": "unknown.tester@example.invalid", "op": {"op": "road.delete"}}]
    out = access.redact_edits(edits, view, LABELS)
    assert [e["by"] for e in out] == ["Surveyor", "Registered user"] and out[0]["op"] == edits[0]["op"]
    assert access.redact_edits(edits, FULL, LABELS) is edits


def test_relabel_ignores_non_lists_and_non_dicts() -> None:
    assert access.redact_activity(None, PUBLIC, {}) is None
    assert access.redact_edits(["x", {"by": "a.tester@example.invalid"}], PUBLIC, {}) == ["x", {"by": "Registered user"}]


# --------------------------------------------------------------------------- legacy records
LEGACY_UNIT = {"id": "UNT-T-1", "vprid": "VPR-T-1", "owner_name": "Test Person", "masked_id": "ID-XXXX-0001",
               "title_deed": "DEED-TS-2026-0042", "tenant_name": "Test Tenant", "occupancy_status": "LEASED",
               "lease_status": "ACTIVE", "annual_tax": 12000, "payment_status": "PENDING", "area_sqm": 80.5}
OWNERSHIP = {"unit_vprid": "VPR-T-1", "owner_name": "Test Person", "masked_id": "ID-XXXX-0001",
             "ownership_type": "FREEHOLD", "share_percentage": 100.0, "title_deed": "DEED-TS-2026-0042",
             "effective_date": "2024-04-15"}
LEASE = {"unit_vprid": "VPR-T-1", "tenant_name": "Test Tenant", "lease_start": "2025-01-01", "lease_end": "2026-12-31",
         "monthly_rent": 38000.0, "status": "ACTIVE"}
TAX = {"unit_vprid": "VPR-T-1", "financial_year": "2026-27", "usage_type": "RESIDENTIAL", "assessed_value": 120000,
       "annual_tax": 12000, "amount_paid": 0, "amount_due": 12000, "payment_status": "PENDING"}


def test_legacy_unit_public_view() -> None:
    out = access.redact_legacy_unit(LEGACY_UNIT, PUBLIC)
    assert out == {**LEGACY_UNIT, "owner_name": "T**** P****", "masked_id": "Restricted",
                   "title_deed": "*************0042", "tenant_name": "Restricted", "occupancy_status": "NOT_DISCLOSED",
                   "lease_status": "NOT_DISCLOSED", "annual_tax": 0, "payment_status": "NOT_DISCLOSED"}


def test_legacy_unit_utility_view_hides_the_title_deed() -> None:
    out = access.redact_legacy_unit(LEGACY_UNIT, UTILITY)
    assert out["title_deed"] == "Restricted" and out["owner_name"] == "T**** P****" and out["masked_id"] == "Restricted"


@pytest.mark.parametrize("redactor, record", [
    (access.redact_legacy_unit, LEGACY_UNIT), (access.redact_ownership, OWNERSHIP), (access.redact_lease, LEASE),
    (access.redact_tax, TAX), (access.redact_citizen_property, LEGACY_UNIT)])
def test_legacy_municipal_and_full_views_are_unchanged(redactor: Callable, record: dict) -> None:
    assert redactor(record, FULL) is record
    assert redactor(record, MUNICIPAL) == record


def test_ownership_lease_tax_public_views() -> None:
    assert access.redact_ownership(OWNERSHIP, PUBLIC) == {**OWNERSHIP, "owner_name": "T**** P****",
                                                          "masked_id": "Restricted", "title_deed": "*************0042"}
    lease = access.redact_lease(LEASE, PUBLIC)
    assert lease == {**LEASE, "tenant_name": "Restricted", "monthly_rent": 0.0, "status": "NOT_DISCLOSED"}
    assert isinstance(lease["monthly_rent"], float)
    assert access.redact_tax(TAX, PUBLIC) == {**TAX, "assessed_value": 0, "annual_tax": 0, "amount_paid": 0,
                                              "amount_due": 0, "payment_status": "NOT_DISCLOSED"}


def test_legacy_redactors_ignore_non_dicts() -> None:
    assert access.redact_legacy_unit(["not", "a", "dict"], PUBLIC) == ["not", "a", "dict"]


# --------------------------------------------------------------------------- purity and shape
def _shape(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _shape(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_shape(v) for v in obj]
    return type(obj).__name__


CASES = [(access.redact_building_detail, _detail), (access.redact_legacy_unit, lambda: copy.deepcopy(LEGACY_UNIT)),
         (access.redact_ownership, lambda: copy.deepcopy(OWNERSHIP)), (access.redact_lease, lambda: copy.deepcopy(LEASE)),
         (access.redact_tax, lambda: copy.deepcopy(TAX)),
         (access.redact_citizen_property, lambda: copy.deepcopy(LEGACY_UNIT)),
         (lambda r, v: access.redact_activity(r, v, LABELS), _events),
         (lambda r, v: access.redact_edits(r, v, LABELS), _events)]


@pytest.mark.parametrize("view", access.VIEWS)
@pytest.mark.parametrize("redactor, make", CASES)
def test_redactors_are_pure_and_shape_preserving(redactor: Callable, make: Callable, view: str) -> None:
    record = make()
    before = copy.deepcopy(record)
    out = redactor(record, view)
    assert record == before  # the input is never mutated
    assert _shape(out) == _shape(before)  # same keys, nesting and JSON types
