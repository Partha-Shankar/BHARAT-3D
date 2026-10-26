import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt
from app.core.config import get_settings
from fastapi.security import OAuth2PasswordBearer
import logging

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# bcrypt takes ~1.5 s on a small shared CPU (Render free). After a successful check, an HMAC of (hash, password)
# is remembered in process memory so repeat sign-ins are instant; the password itself is never stored, and a
# wrong password always pays the full bcrypt cost.
_verified: set = set()


def _fingerprint(plain_password: str, hashed_password: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{hashed_password}\0{plain_password}".encode(), hashlib.sha256).hexdigest()


def remember_verified(plain_password: str, hashed_password: str) -> None:
    """Register a pair whose hash was just created from this password (no need to verify it again)."""
    _verified.add(_fingerprint(plain_password, hashed_password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    fp = _fingerprint(plain_password, hashed_password)
    if fp in _verified:
        return True
    try:
        ok = pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logging.error(f"Password verification failed: {e}")
        return False
    if ok and len(_verified) < 10_000:
        _verified.add(fp)
    return ok

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None
