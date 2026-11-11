import logging
from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.database import create_tables
from app.api import auth, citizen, ingest, projects, realgen, units
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="BHARAT 3D — real-geography 3D ULPIN generation, volumetric property registry, compliance and subsurface safety.",
    default_response_class=ORJSONResponse,
    # The interactive API browser is for development; in production it is off (ENVIRONMENT=production, API_DOCS).
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

# Auth uses bearer tokens (no cookies), so a configurable origin list without credentials is sufficient.
_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Every /api route except sign-in requires a signed-in user (see docs/ACCESS_POLICY.md). The only other public
# paths are /health and the satellite textures the 3D viewer loads.
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(units.router, prefix="/api")
app.include_router(citizen.router, prefix="/api")
app.include_router(realgen.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")

@app.on_event("startup")
async def on_startup():
    logger.info("Initializing database...")
    await create_tables()
    logger.info("Database initialized.")
    # Areas: R2 (durable) first, then bundled demo areas that R2 does not override, then background restore.
    import threading

    from app.realgen import store
    from app.realgen.seed import install_seeds

    remote = store.startup()
    install_seeds(frozenset(remote["areas"]) | frozenset(remote["deleted"]))
    if remote["areas"]:
        threading.Thread(target=store.restore_all, args=(remote["areas"],), daemon=True).start()

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Bharat 3D Backend"}
