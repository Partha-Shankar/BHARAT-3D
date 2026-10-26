from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import create_access_token
from app.core.deps import get_current_user
from app.schemas.schemas import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import authenticate_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    # name / email / role ride in the token so the edge can label analytics events without another lookup
    role = getattr(user.role, "value", user.role)
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "name": user.full_name, "role": str(role)})
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout():
    return {"message": "Logged out"}
