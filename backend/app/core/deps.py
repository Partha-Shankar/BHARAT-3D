from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import decode_token, oauth2_scheme
from app.core.database import get_db
from app.models.models import User

# Same token URL as oauth2_scheme, but a missing Authorization header yields None instead of a 401.
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token) if token else None
    if payload is None or payload.get("sub") is None:
        raise credentials_exception
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise credentials_exception
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional),
                            db: AsyncSession = Depends(get_db)) -> Optional[User]:
    """The signed-in user, or None (never an error) when the token is missing, invalid or expired, or names an
    unknown or inactive user. For endpoints that stay public but serve a role-dependent view."""
    payload = decode_token(token) if token else None
    if payload is None or payload.get("sub") is None:
        return None
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        return None
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    return user if user is not None and user.is_active else None


def require_role(*allowed_roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return role_checker
