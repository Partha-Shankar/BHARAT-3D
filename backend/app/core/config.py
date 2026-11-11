import logging
import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Keys that have appeared in this repository's source or docs: never accepted for signing tokens.
PUBLISHED_KEYS = frozenset({
    "bharat3d-enterprise-secret-key-2026-production",
    "change-me-to-a-long-random-string", "change-me", "changeme", "secret", "your-secret-key", "dev",
})
MIN_KEY_LENGTH = 32


class InsecureSecretKey(RuntimeError):
    """The signing key is missing, published or too short, and the service runs in production."""


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./bharat3d.db"
    # No built-in value: tokens are signed with SECRET_KEY from the environment (see check_signing_key).
    SECRET_KEY: str = ""
    ENVIRONMENT: str = "development"  # "production" on the hosted backend
    API_DOCS: bool | None = None  # /docs, /redoc and /openapi.json; default: on outside production, off in it
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DEMO_MODE: bool = True
    DATA_DIR: str = "../data"
    APP_NAME: str = "BHARAT 3D"
    VERSION: str = "1.0.0"
    CORS_ORIGINS: str = "*"  # comma-separated, e.g. https://bharat-3d.pages.dev,http://localhost:5173
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in ("production", "prod")

    @property
    def docs_enabled(self) -> bool:
        return (not self.is_production) if self.API_DOCS is None else self.API_DOCS


def signing_key_problem(key: str) -> str | None:
    """Why a key must not sign tokens, or None when it is acceptable."""
    key = (key or "").strip()
    if not key:
        return "not set"
    if key in PUBLISHED_KEYS:
        return "a value that is published in the source code"
    if len(key) < MIN_KEY_LENGTH:
        return f"shorter than {MIN_KEY_LENGTH} characters"
    return None


def check_signing_key(settings: Settings) -> Settings:
    """Production refuses to start with a weak key. Elsewhere a random per-process key is used instead (sign-ins
    then last until the process restarts), so a development machine can never mint tokens with a known key."""
    problem = signing_key_problem(settings.SECRET_KEY)
    if problem is None:
        return settings
    if settings.is_production:
        raise InsecureSecretKey(
            f"SECRET_KEY is {problem}. Set a random value of at least {MIN_KEY_LENGTH} characters in the service "
            "environment, for example the output of: python -c \"import secrets; print(secrets.token_urlsafe(48))\"")
    logger.warning("SECRET_KEY is %s; using a random key for this process (development only).", problem)
    settings.SECRET_KEY = secrets.token_urlsafe(48)
    return settings


@lru_cache
def get_settings() -> Settings:
    return check_signing_key(Settings())
