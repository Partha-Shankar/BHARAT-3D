# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Keep-awake: only on Render, can be turned off, never raises, pings on its interval, starts once. No network."""
from __future__ import annotations

import threading
import time
from typing import Any

import httpx
import pytest

from app.core import keepawake

URL = "https://bharat-3d-api.onrender.com"


@pytest.fixture(autouse=True)
def clean(monkeypatch: pytest.MonkeyPatch) -> None:
    for k in ("RENDER", "RENDER_EXTERNAL_URL", "KEEP_AWAKE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setattr(keepawake, "_started", False)


def on_render(monkeypatch: pytest.MonkeyPatch, **extra: str) -> None:
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("RENDER_EXTERNAL_URL", URL)
    for k, v in extra.items():
        monkeypatch.setenv(k, v)


def test_off_outside_render() -> None:
    assert keepawake.target() is None
    assert keepawake.start() is False


def test_on_render_targets_its_own_health_url(monkeypatch: pytest.MonkeyPatch) -> None:
    on_render(monkeypatch)
    assert keepawake.target() == f"{URL}/health"


@pytest.mark.parametrize("value", ["0", "false", "OFF", "no"])
def test_can_be_turned_off(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    on_render(monkeypatch, KEEP_AWAKE=value)
    assert keepawake.target() is None


def test_ignores_a_non_https_address(monkeypatch: pytest.MonkeyPatch) -> None:
    on_render(monkeypatch, RENDER_EXTERNAL_URL="http://example.internal")
    assert keepawake.target() is None


def test_ping_never_raises() -> None:
    class Broken:
        def get(self, _url: str) -> Any:
            raise httpx.ConnectError("no route")
    assert keepawake.ping(f"{URL}/health", client=Broken()) is None  # type: ignore[arg-type]


def test_loop_pings_on_its_interval_and_stops(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(keepawake, "INTERVAL_S", 0.05)
    monkeypatch.setattr(keepawake, "ping", lambda url, client=None: calls.append(url) or 200)
    stop = threading.Event()
    t = threading.Thread(target=keepawake._loop, args=(f"{URL}/health", stop), daemon=True)
    t.start()
    time.sleep(0.3)
    stop.set()
    t.join(1)
    assert not t.is_alive()
    assert 3 <= len(calls) <= 8 and set(calls) == {f"{URL}/health"}


def test_starts_only_once(monkeypatch: pytest.MonkeyPatch) -> None:
    on_render(monkeypatch)
    started: list[Any] = []
    monkeypatch.setattr(keepawake.threading, "Thread", lambda **kw: started.append(kw) or type("T", (), {"start": lambda self: None})())
    assert keepawake.start() is True
    assert keepawake.start() is True
    assert len(started) == 1
