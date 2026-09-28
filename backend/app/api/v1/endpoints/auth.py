from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import UserContext, get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserMeResponse
from app.services.auth_service import authenticate_user, create_user_with_profile, get_user_by_email, get_user_by_id

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user (Customer, Retailer, or Delivery Partner)",
)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user in the platform.
    Validates role, hashes password, and returns JWT access token.
    """
    if request.role not in [role.value for role in UserRole]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be one of: 'customer', 'retailer', 'delivery_partner'",
        )

    if get_user_by_email(db, request.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = create_user_with_profile(db, request.model_dump())
    access_token = create_access_token(subject=user.id, role=user.role.value)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=user.id,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and issue JWT access token",
)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user using email and password.
    Returns JWT access token, role, and user_id.
    """
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id, role=user.role.value)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=user.id,
    )


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get current user account metadata",
)
def get_me(current_user: UserContext = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return profile details for the currently authenticated user."""
    user = get_user_by_id(db, current_user.user_id)
    profile = user.customer or user.retailer or user.delivery_partner
    return UserMeResponse(
        user_id=user.id,
        email=user.email,
        role=user.role.value,
        name=getattr(profile, "name", None),
        phone=getattr(profile, "phone", None),
    )
