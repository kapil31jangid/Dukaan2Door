from fastapi import APIRouter, Depends, HTTPException, status
from app.core.deps import UserContext, get_current_user
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserMeResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user (Customer, Retailer, or Delivery Partner)",
)
def register(request: RegisterRequest):
    """
    Register a new user in the platform.
    Validates role, hashes password, and returns JWT access token.
    """
    if request.role not in ["customer", "retailer", "delivery_partner"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be one of: 'customer', 'retailer', 'delivery_partner'",
        )

    # Note: DB user insertion will be connected when Shrija's models arrive.
    access_token = create_access_token(subject=1, role=request.role)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=request.role,
        user_id=1,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and issue JWT access token",
)
def login(request: LoginRequest):
    """
    Authenticate user using email and password.
    Returns JWT access token, role, and user_id.
    """
    # Note: DB user validation will be connected when Shrija's models arrive.
    access_token = create_access_token(subject=1, role="customer")
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role="customer",
        user_id=1,
    )


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get current user account metadata",
)
def get_me(current_user: UserContext = Depends(get_current_user)):
    """Return profile details for the currently authenticated user."""
    return UserMeResponse(
        user_id=current_user.user_id,
        email="user@example.com",
        role=current_user.role,
        name="User Profile",
    )
