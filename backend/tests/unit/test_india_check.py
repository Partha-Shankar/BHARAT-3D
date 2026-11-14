# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""The India check runs on the server against India's boundary, with no geocoder; place names fall back to a second
geocoder when Nominatim refuses (it answers 429 to shared cloud servers).

No network: any attempt to open a connection fails the test.
"""
from __future__ import annotations

from typing import Any

import pytest
from shapely.geometry import box

from app.realgen import fetch_osm


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("the India check must not use the network")
    monkeypatch.setattr(fetch_osm, "_client", refuse)
    fetch_osm._place_cache.clear()


def square(lon: float, lat: float, half_deg: float = 0.0015):
    return box(lon - half_deg, lat - half_deg, lon + half_deg, lat + half_deg)


@pytest.mark.parametrize("name, lon, lat", [
    ("Bengaluru, Devagiri temple ward (the reported case)", 77.565, 12.92),
    ("Bengaluru, S.G. Palya", 77.605, 12.935),
    ("Delhi", 77.21, 28.61),
    ("Ambala", 76.83, 30.36),
    ("Leh", 77.58, 34.16),
    ("Gilgit, as on India's map", 74.31, 35.92),
    ("Tawang", 91.86, 27.59),
    ("Port Blair", 92.73, 11.62),
    ("Kavaratti", 72.64, 10.56),
    ("Mumbai, Marine Drive on the coast", 72.823, 18.943),
])
def test_places_in_india_pass(name: str, lon: float, lat: float) -> None:
    assert fetch_osm.india_check(square(lon, lat)) is None, name


@pytest.mark.parametrize("name, lon, lat", [
    ("Kathmandu", 85.32, 27.70),
    ("Lahore", 74.35, 31.52),
    ("Dhaka", 90.41, 23.81),
    ("Colombo", 79.86, 6.93),
    ("Thimphu", 89.64, 27.47),
    ("Arabian Sea", 70.0, 15.0),
    ("Bay of Bengal", 87.0, 15.0),
    ("London (outside the envelope)", -0.12, 51.5),
])
def test_places_outside_india_are_blocked(name: str, lon: float, lat: float) -> None:
    assert fetch_osm.india_check(square(lon, lat)) == fetch_osm.OUTSIDE_INDIA, name


def test_the_old_geocoder_message_is_gone() -> None:
    assert "geocoder" not in fetch_osm.OUTSIDE_INDIA


class FakeResponse:
    def __init__(self, status: int, payload: dict[str, Any] | None = None) -> None:
        self.status_code = status
        self._payload = payload or {}

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeClient:
    """Answers Nominatim with `nominatim` and Photon with `photon` (status, payload)."""

    def __init__(self, nominatim: FakeResponse, photon: FakeResponse, calls: list[str]) -> None:
        self.nominatim, self.photon, self.calls = nominatim, photon, calls

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *_a: Any) -> None:
        return None

    def get(self, url: str, params: dict[str, Any] | None = None) -> FakeResponse:
        self.calls.append(url)
        return self.nominatim if "nominatim" in url else self.photon


NOMINATIM_OK = {"display_name": "Vasanth Nagar, Bengaluru, Karnataka, India", "address": {
    "suburb": "Vasanth Nagar", "city": "Bengaluru", "state": "Karnataka", "ISO3166-2-lvl4": "IN-KA", "country_code": "in"}}
PHOTON_OK = {"features": [{"properties": {"district": "S.G. Palya", "city": "Bengaluru", "state": "Karnataka",
                                          "country": "India", "countrycode": "IN"}}]}


def use(monkeypatch: pytest.MonkeyPatch, nominatim: FakeResponse, photon: FakeResponse) -> list[str]:
    calls: list[str] = []
    monkeypatch.setattr(fetch_osm, "_client", lambda *_a, **_k: FakeClient(nominatim, photon, calls))
    return calls


def test_nominatim_answer_is_used_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = use(monkeypatch, FakeResponse(200, NOMINATIM_OK), FakeResponse(200, PHOTON_OK))
    place = fetch_osm.reverse_geocode(77.59, 12.99)
    assert (place["locality"], place["city"], place["state_code"], place["country_code"]) == ("Vasanth Nagar", "Bengaluru", "KA", "in")
    assert all("nominatim" in u for u in calls)


def test_refused_nominatim_falls_back_to_photon_with_the_same_state_code(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = use(monkeypatch, FakeResponse(429), FakeResponse(200, PHOTON_OK))
    place = fetch_osm.reverse_geocode(77.605, 12.935)
    assert (place["locality"], place["city"], place["state_code"], place["country_code"]) == ("S.G. Palya", "Bengaluru", "KA", "in")
    assert any("photon" in u for u in calls)


def test_both_geocoders_down_gives_the_old_default(monkeypatch: pytest.MonkeyPatch) -> None:
    use(monkeypatch, FakeResponse(429), FakeResponse(503))
    assert fetch_osm.reverse_geocode(77.6, 12.9) == {"locality": "Survey area", "city": "", "state": "", "state_code": "XX",
                                                     "display_name": "", "country_code": ""}


def test_answers_are_remembered(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = use(monkeypatch, FakeResponse(200, NOMINATIM_OK), FakeResponse(200, PHOTON_OK))
    fetch_osm.reverse_geocode(77.59, 12.99)
    fetch_osm.reverse_geocode(77.59, 12.99)
    assert len(calls) == 1
