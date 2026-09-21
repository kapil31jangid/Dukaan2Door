from fastapi import APIRouter, Depends
from app.core.deps import UserContext, require_role
from app.schemas.user import DeliveryPartnerProfile, DeliveryPartnerUpdate

router = APIRouter(prefix="/delivery-partners", tags=["Delivery Partner Profiles"])


@router.get(
    "/me",
    response_model=DeliveryPartnerProfile,
    summary="Get delivery partner profile",
)
def get_delivery_partner_profile(
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
):
    """Get delivery partner profile info including vehicle info and availability toggle."""
    return DeliveryPartnerProfile(
        id=1,
        user_id=current_user.user_id,
        name="Sample Delivery Partner",
        phone="9876543212",
        vehicle_info="Honda Activa DL-01-AB-1234",
        is_available=True,
    )


@router.put(
    "/me",
    response_model=DeliveryPartnerProfile,
    summary="Update delivery partner profile & availability toggle",
)
def update_delivery_partner_profile(
    payload: DeliveryPartnerUpdate,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
):
    """Update delivery partner vehicle info, phone, or toggle availability status."""
    return DeliveryPartnerProfile(
        id=1,
        user_id=current_user.user_id,
        name=payload.name or "Sample Delivery Partner",
        phone=payload.phone or "9876543212",
        vehicle_info=payload.vehicle_info or "Honda Activa DL-01-AB-1234",
        is_available=payload.is_available if payload.is_available is not None else True,
    )
