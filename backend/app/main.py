import logging
from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.database import create_tables
from app.api import auth, projects, jobs, buildings, units, violations, infrastructure, excavation, citizen, audit, maps, realgen
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="BHARAT 3D — real-geography 3D ULPIN generation, volumetric property registry, compliance and subsurface safety.",
    default_response_class=ORJSONResponse
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

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(buildings.router, prefix="/api")
app.include_router(units.router, prefix="/api")
app.include_router(violations.router, prefix="/api")
app.include_router(infrastructure.router, prefix="/api")
app.include_router(excavation.router, prefix="/api")
app.include_router(citizen.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(maps.router, prefix="/api")
app.include_router(realgen.router, prefix="/api")

@app.on_event("startup")
async def on_startup():
    logger.info("Initializing database...")
    await create_tables()
    logger.info("Database initialized.")
    from app.realgen.seed import install_seeds  # bundled demo areas (ephemeral hosts lose generated ones)

    install_seeds()

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Bharat 3D Backend"}
