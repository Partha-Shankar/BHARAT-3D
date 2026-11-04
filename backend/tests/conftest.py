# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Shared fixtures for the backend tests.

* Fake users, one per role, with clearly fake identities (``*.tester@example.invalid``).
* ``area_cache``: a temp copy of one bundled seed area (plus the national INF ledger), with ``cache.CACHE_ROOT``
  pointed at it, and a small ``edits.json`` written by the fake users. Nothing under ``data/`` is modified.
* ``user_db``: a throwaway SQLite file in the pytest temp directory holding the fake users; ``get_db`` is overridden
  to it, so ``backend/bharat3d.db`` is never opened.
* The R2 area store is forced off for every test (no network).
* ``api``: a TestClient without startup events (no table creation, no seed install) that signs in as a fake role
  through dependency overrides.
"""
from __future__ import annotations

import asyncio
import shutil
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from httpx import Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.database import Base, get_db
from app.core.deps import get_current_user, get_optional_user
from app.core.security import create_access_token
from app.models.models import RoleEnum, User
from app.realgen import cache, store

if TYPE_CHECKING:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

TESTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TESTS_DIR.parents[1]
SEED_DIR = REPO_ROOT / "data" / "seed"
SEED_KEY = "df15e8785583b74c"  # Bhopal demo area: STRATA + SINGLE_TITLE buildings, a survey package, two findings
ROLES: list[str] = [r.value for r in RoleEnum]
EDITORS = ("SURVEYOR", "ADMIN")
NON_EDITORS = tuple(r for r in ROLES if r not in EDITORS)


def _fake_user(uid: int, role: str) -> User:
    return User(id=uid, email=f"{role.lower()}.tester@example.invalid", full_name=f"Test {role.title()}",
                role=RoleEnum(role), is_active=True, hashed_password="!unusable")


FAKE_USERS: dict[str, User] = {role: _fake_user(i, role) for i, role in enumerate(ROLES, start=1)}
UNKNOWN_EDITOR = "former.editor@example.invalid"  # an editor whose account no longer exists
FAKE_EDITS = [
    {"seq": 1, "at": 1767000000.0, "by": FAKE_USERS["SURVEYOR"].email,
     "op": {"op": "building.update", "id": "BLD-0001", "set": {"name": "Test Tower"}}},
    {"seq": 2, "at": 1767000100.0, "by": FAKE_USERS["ADMIN"].email,
     "op": {"op": "building.update", "id": "BLD-0001", "set": {"sanctioned_floors": 4}}},
    {"seq": 3, "at": 1767000200.0, "by": UNKNOWN_EDITOR,
     "op": {"op": "building.update", "id": "BLD-0002", "set": {"name": "Test Annexe"}}},
]


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Mark tests by folder: tests/unit -> unit, tests/api -> api, tests/ingest -> ingest."""
    for item in items:
        parts = Path(str(item.fspath)).resolve().relative_to(TESTS_DIR).parts
        if len(parts) > 1 and parts[0] in ("unit", "api", "ingest"):
            item.add_marker(getattr(pytest.mark, parts[0]))


@pytest.fixture(autouse=True)
def _store_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """The R2 store must never be reached from a test, whatever the shell environment holds."""
    monkeypatch.setattr(store, "STORE_URL", "")
    monkeypatch.setattr(store, "STORE_TOKEN", "")
    assert not store.enabled()


@pytest.fixture
def area_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A temp cache with one seed area, the INF ledger, and FAKE_EDITS; returns the cache root."""
    root = tmp_path / "cache"
    shutil.copytree(SEED_DIR / SEED_KEY, root / SEED_KEY)
    shutil.copytree(SEED_DIR / "_registry", root / "_registry")
    monkeypatch.setattr(cache, "CACHE_ROOT", str(root))
    cache.write_json(SEED_KEY, "edits.json", FAKE_EDITS)
    return root


@pytest.fixture(scope="session")
def user_db(tmp_path_factory: pytest.TempPathFactory) -> async_sessionmaker:
    """A throwaway SQLite file with the fake users (NullPool: every session opens a connection in its own loop)."""
    path = tmp_path_factory.mktemp("db") / "users.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{path.as_posix()}", poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def setup() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with factory() as s:
            s.add_all([_fake_user(u.id, getattr(u.role, "value", u.role)) for u in FAKE_USERS.values()])
            await s.commit()

    asyncio.run(setup())
    return factory


class Api:
    """TestClient wrapper: ``api.get(path, role="CITIZEN")`` signs in as that fake role; ``role=None`` is anonymous.

    A role overrides both ``get_current_user`` and ``get_optional_user``. Anonymous calls use the real dependencies,
    so a request without a token gets a 401 on protected routes and the public view on optional-sign-in routes.
    """

    def __init__(self, app: FastAPI, client: TestClient) -> None:
        self.app = app
        self.client = client

    def as_role(self, role: str | None) -> None:
        overrides = self.app.dependency_overrides
        for dep in (get_current_user, get_optional_user):
            overrides.pop(dep, None)
        if role is not None:
            user = FAKE_USERS[role]
            overrides[get_current_user] = lambda: user
            overrides[get_optional_user] = lambda: user

    def request(self, method: str, path: str, role: str | None = None, **kw) -> Response:
        self.as_role(role)
        return self.client.request(method, path, **kw)

    def get(self, path: str, role: str | None = None, **kw) -> Response:
        return self.request("GET", path, role, **kw)

    def post(self, path: str, role: str | None = None, **kw) -> Response:
        return self.request("POST", path, role, **kw)

    def delete(self, path: str, role: str | None = None, **kw) -> Response:
        return self.request("DELETE", path, role, **kw)


@pytest.fixture
def api(area_cache: Path, user_db: async_sessionmaker) -> Iterator[Api]:
    """TestClient over the temp area cache and the throwaway user table. Startup events are not run."""
    # Imported here, so pure unit-test runs never load the web app.
    from fastapi.testclient import TestClient

    from app.main import app

    async def test_db() -> AsyncIterator[AsyncSession]:
        async with user_db() as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    client = TestClient(app)  # not used as a context manager: startup (create_tables, install_seeds) never runs
    try:
        yield Api(app, client)
    finally:
        client.close()
        app.dependency_overrides.clear()


@pytest.fixture
def seed_buildings(area_cache: Path) -> dict[str, str]:
    """One building id per identity kind present in the seed area, e.g. {"STRATA": "BLD-0001", ...}."""
    scene = cache.read_json(SEED_KEY, "scene.json")
    out: dict[str, str] = {}
    for b in scene["buildings"]:
        out.setdefault(b.get("identity_kind", "STRATA"), b["id"])
    return out


def token_for(role: str, **claims: object) -> str:
    """A real signed JWT for a fake user (for tests that exercise the real auth dependencies)."""
    return create_access_token({"sub": str(FAKE_USERS[role].id), **claims})


def json_body(resp: Response) -> object:
    """Response JSON, with a clear failure message when the status is not 200."""
    assert resp.status_code == 200, f"{resp.status_code}: {resp.text[:300]}"
    return resp.json()
