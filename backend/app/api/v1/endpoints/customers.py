from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import UserContext, get_db, require_role
from app.models.customer import Customer
from app.schemas.user import CustomerProfile, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["Customer Profiles"])


@router.get(
    "/me",
    response_model=CustomerProfile,
    summary="Get customer profile for authenticated user",
)
def get_customer_profile(
    current_user: UserContext = Depends(require_role(["customer"])),
    db: Session = Depends(get_db),
):
    """Retrieve customer profile details including saved delivery address and coordinates."""
    customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")
    return CustomerProfile.model_validate(customer, from_attributes=True)


@router.put(
    "/me",
    response_model=CustomerProfile,
    summary="Update customer profile details",
)
def update_customer_profile(
    payload: CustomerUpdate,
    current_user: UserContext = Depends(require_role(["customer"])),
    db: Session = Depends(get_db),
):
    """Update delivery address, phone, or name for the authenticated customer."""
    customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return CustomerProfile.model_validate(customer, from_attributes=True)
