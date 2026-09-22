from typing import Generator, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.services.auth_service import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class UserContext(BaseModel):
    user_id: int
    role: str
    email: str = ""


def get_db() -> Generator:
    """Yield a database session context."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)) -> UserContext:
    """Validate access token and return current authenticated user context."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    role = payload.get("role")
    if not user_id_str or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(db, user_id)
    if not user or user.role.value != role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists or role has changed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserContext(user_id=user.id, role=user.role.value, email=user.email)


def require_role(allowed_roles: List[str]):
    """Role-based access control dependency factory."""

    def role_checker(current_user: UserContext = Depends(get_current_user)) -> UserContext:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden for role '{current_user.role}'. Required: {allowed_roles}",
            )
        return current_user

    return role_checker
