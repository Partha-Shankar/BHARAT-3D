from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import select
from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def create_tables():
    from app.models.models import User, Project
    from app.core.security import get_password_hash
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(User))
            existing_user = result.scalars().first()
            if not existing_user:
                demo_users = [
                    User(
                        email="survey@bharat3d.demo",
                        hashed_password=get_password_hash("demo2026"),
                        full_name="Rajesh Kumar (Surveyor)",
                        role="SURVEYOR",
                        is_active=True
                    ),
                    User(
                        email="municipality@bharat3d.demo",
                        hashed_password=get_password_hash("demo2026"),
                        full_name="Sanjay Verma (Municipal Officer)",
                        role="MUNICIPALITY",
                        is_active=True
                    ),
                    User(
                        email="utility@bharat3d.demo",
                        hashed_password=get_password_hash("demo2026"),
                        full_name="Vikram Malhotra (Utility Contractor)",
                        role="UTILITY_OPERATOR",
                        is_active=True
                    ),
                    User(
                        email="citizen@bharat3d.demo",
                        hashed_password=get_password_hash("demo2026"),
                        full_name="Priya Mehta (Property Owner)",
                        role="CITIZEN",
                        is_active=True
                    ),
                    User(
                        email="admin@bharat3d.demo",
                        hashed_password=get_password_hash("demo2026"),
                        full_name="Admin Officer",
                        role="ADMIN",
                        is_active=True
                    )
                ]
                session.add_all(demo_users)
                
            proj_result = await session.execute(select(Project))
            existing_proj = proj_result.scalars().first()
            if not existing_proj:
                p1 = Project(
                    id="proj-001",
                    name="Central Urban Zone - Ward 16 Survey",
                    description="High-density urban cadastre survey with residential towers, commercial mall, and metro tunnel infrastructure.",
                    ward_number="Ward 16",
                    zone_name="Central Urban Zone",
                    status="CONFIRMED",
                    dataset_version=3
                )
                p2 = Project(
                    id="proj-002",
                    name="North Suburbs Expansion",
                    description="New residential mapping",
                    ward_number="Ward 4",
                    zone_name="North Zone",
                    status="PROCESSING",
                    dataset_version=1
                )
                session.add_all([p1, p2])
            await session.commit()
        except Exception as e:
            print(f"Auto-seed notification: {e}")
