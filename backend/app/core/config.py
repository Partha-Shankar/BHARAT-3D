from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./bharat3d.db"
    SECRET_KEY: str = "bharat3d-sih-demo-secret-key-2026-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DEMO_MODE: bool = True
    DATA_DIR: str = "../data"
    UPLOAD_DIR: str = "../data/uploads"
    APP_NAME: str = "BHARAT 3D"
    VERSION: str = "1.0.0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache
def get_settings():
    return Settings()
