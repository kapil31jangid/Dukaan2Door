from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import UserContext, get_db, require_role
from app.models.delivery_partner import DeliveryPartner
from app.schemas.user import DeliveryPartnerProfile, DeliveryPartnerUpdate

router = APIRouter(prefix="/delivery-partners", tags=["Delivery Partner Profiles"])


@router.get(
    "/me",
    response_model=DeliveryPartnerProfile,
    summary="Get delivery partner profile",
)
def get_delivery_partner_profile(
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    """Get delivery partner profile info including vehicle info and availability toggle."""
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.user_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery partner profile not found")
    return DeliveryPartnerProfile.model_validate(partner, from_attributes=True)


@router.put(
    "/me",
    response_model=DeliveryPartnerProfile,
    summary="Update delivery partner profile & availability toggle",
)
def update_delivery_partner_profile(
    payload: DeliveryPartnerUpdate,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    """Update delivery partner vehicle info, phone, or toggle availability status."""
    partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.user_id).first()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery partner profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(partner, field, value)
    db.commit()
    db.refresh(partner)
    return DeliveryPartnerProfile.model_validate(partner, from_attributes=True)
