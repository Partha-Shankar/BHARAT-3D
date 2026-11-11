from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import decode_token, oauth2_scheme
from app.core.database import get_db
from app.models.models import User

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


EDITOR_ROLES = ("SURVEYOR", "ADMIN")


def role_of(user: User) -> str:
    return str(getattr(user.role, "value", user.role))


def require_role(*allowed_roles: str):
    """Dependency: the signed-in user, if their role is one of `allowed_roles` (401 without sign-in, else 403)."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if role_of(current_user) not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted for this role")
        return current_user
    return role_checker


require_editor = require_role(*EDITOR_ROLES)
