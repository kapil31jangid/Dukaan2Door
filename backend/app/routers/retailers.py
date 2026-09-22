from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import UserContext, get_db, require_role
from app.models.product import Product
from app.models.retailer import Retailer
from app.models.store import Store
from app.schemas.product import ProductResponse
from app.schemas.user import (
    RetailerProfile,
    RetailerUpdate,
    StoreProfile,
    StoreUpdate,
)
from app.services.product_service import product_to_response

router = APIRouter(prefix="/retailers", tags=["Retailer & Store Profiles"])


@router.get(
    "/me",
    response_model=RetailerProfile,
    summary="Get retailer profile",
)
def get_retailer_profile(
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Get profile information for the authenticated retailer."""
    retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not retailer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer profile not found")
    return RetailerProfile.model_validate(retailer, from_attributes=True)


@router.put(
    "/me",
    response_model=RetailerProfile,
    summary="Update retailer profile",
)
def update_retailer_profile(
    payload: RetailerUpdate,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Update profile details for the authenticated retailer."""
    retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not retailer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(retailer, field, value)
    db.commit()
    db.refresh(retailer)
    return RetailerProfile.model_validate(retailer, from_attributes=True)


@router.get(
    "/me/store",
    response_model=StoreProfile,
    summary="Get retailer's store details",
)
def get_store(
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Get store details, coordinates, operating hours, and open/closed status."""
    store = db.query(Store).join(Store.retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return StoreProfile.model_validate(store, from_attributes=True)


@router.put(
    "/me/store",
    response_model=StoreProfile,
    summary="Update store profile / toggles",
)
def update_store(
    payload: StoreUpdate,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Update store details, address, coordinates, operating hours, or is_open toggle."""
    store = db.query(Store).join(Store.retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(store, field, value)
    db.commit()
    db.refresh(store)
    return StoreProfile.model_validate(store, from_attributes=True)


@router.get(
    "/me/products",
    response_model=List[ProductResponse],
    summary="Get retailer's own catalog with stock",
)
def get_retailer_products(
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Retrieve full product catalog belonging to the retailer's store with stock counts."""
    store = db.query(Store).join(Store.retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    products = db.query(Product).filter(Product.store_id == store.id).all()
    return [ProductResponse(**product_to_response(product)) for product in products]
