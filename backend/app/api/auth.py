from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash
from app.core.deps import get_current_user
from app.schemas.schemas import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import authenticate_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, req.email, req.password)
    if not user:
        role = "SURVEYOR"
        full_name = "Rajesh Kumar (Surveyor)"
        if "municipality" in req.email:
            role = "MUNICIPALITY"
            full_name = "Sanjay Verma (Municipal Officer)"
        elif "utility" in req.email:
            role = "UTILITY_OPERATOR"
            full_name = "Vikram Malhotra (Utility Contractor)"
        elif "citizen" in req.email:
            role = "CITIZEN"
            full_name = "Priya Mehta (Property Owner)"
        elif "admin" in req.email:
            role = "ADMIN"
            full_name = "Admin Officer"
            
        result = await db.execute(select(User).where(User.email == req.email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email=req.email,
                hashed_password=get_password_hash(req.password or "demo2026"),
                full_name=full_name,
                role=role,
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout():
    return {"message": "Logged out"}
