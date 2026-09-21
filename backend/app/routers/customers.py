from fastapi import APIRouter, Depends
from app.core.deps import UserContext, require_role
from app.schemas.user import CustomerProfile, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["Customer Profiles"])


@router.get(
    "/me",
    response_model=CustomerProfile,
    summary="Get customer profile for authenticated user",
)
def get_customer_profile(
    current_user: UserContext = Depends(require_role(["customer"])),
):
    """Retrieve customer profile details including saved delivery address and coordinates."""
    return CustomerProfile(
        id=1,
        user_id=current_user.user_id,
        name="Sample Customer",
        phone="9876543210",
        delivery_address="123 Main St",
        lat=28.6139,
        lng=77.2090,
    )


@router.put(
    "/me",
    response_model=CustomerProfile,
    summary="Update customer profile details",
)
def update_customer_profile(
    payload: CustomerUpdate,
    current_user: UserContext = Depends(require_role(["customer"])),
):
    """Update delivery address, phone, or name for the authenticated customer."""
    return CustomerProfile(
        id=1,
        user_id=current_user.user_id,
        name=payload.name or "Sample Customer",
        phone=payload.phone or "9876543210",
        delivery_address=payload.delivery_address or "123 Main St",
        lat=payload.lat if payload.lat is not None else 28.6139,
        lng=payload.lng if payload.lng is not None else 77.2090,
    )
