# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Signing key and API docs settings (app/core/config.py)."""
import pytest

from app.core import config
from app.core.config import (
    InsecureSecretKey,
    Settings,
    check_signing_key,
    signing_key_problem,
)

GOOD = "k" * 20 + "9f8e7d6c5b4a3f2e1d0c"  # 40 characters, test-only


def make(**kw) -> Settings:
    return Settings(_env_file=None, **kw)


@pytest.mark.parametrize(("key", "problem"), [
    ("", "not set"), ("   ", "not set"),
    ("bharat3d-enterprise-secret-key-2026-production", "published"),
    ("changeme", "published"), ("change-me-to-a-long-random-string", "published"),
    ("short-but-secret", "shorter than 32"),
])
def test_weak_keys_are_named(key: str, problem: str) -> None:
    assert problem in signing_key_problem(key)


def test_good_key_is_accepted() -> None:
    assert signing_key_problem(GOOD) is None
    s = check_signing_key(make(SECRET_KEY=GOOD, ENVIRONMENT="production"))
    assert s.SECRET_KEY == GOOD


@pytest.mark.parametrize("key", ["", "bharat3d-enterprise-secret-key-2026-production", "too-short"])
@pytest.mark.parametrize("env", ["production", "PROD", " Production "])
def test_production_refuses_to_start_with_a_weak_key(key: str, env: str) -> None:
    with pytest.raises(InsecureSecretKey, match="SECRET_KEY is"):
        check_signing_key(make(SECRET_KEY=key, ENVIRONMENT=env))


def test_development_uses_a_random_key_instead() -> None:
    a = check_signing_key(make(SECRET_KEY="", ENVIRONMENT="development"))
    b = check_signing_key(make(SECRET_KEY="bharat3d-enterprise-secret-key-2026-production"))
    assert len(a.SECRET_KEY) >= 32 and len(b.SECRET_KEY) >= 32 and a.SECRET_KEY != b.SECRET_KEY
    assert signing_key_problem(a.SECRET_KEY) is None


def test_no_key_is_built_in() -> None:
    assert Settings.model_fields["SECRET_KEY"].default == ""


@pytest.mark.parametrize(("env", "flag", "on"), [
    ("production", None, False), ("development", None, True), ("production", True, True),
    ("development", False, False),
])
def test_api_docs_switch(env: str, flag, on: bool) -> None:
    assert make(SECRET_KEY=GOOD, ENVIRONMENT=env, API_DOCS=flag).docs_enabled is on


def test_app_follows_the_docs_setting() -> None:
    from app.main import app, settings

    expected = ("/docs", "/redoc", "/openapi.json") if settings.docs_enabled else (None, None, None)
    assert (app.docs_url, app.redoc_url, app.openapi_url) == expected


def test_running_settings_have_a_usable_key() -> None:
    assert signing_key_problem(config.get_settings().SECRET_KEY) is None
