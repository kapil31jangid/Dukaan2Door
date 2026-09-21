from typing import List
from fastapi import APIRouter, Depends
from app.core.deps import UserContext, require_role
from app.schemas.product import ProductResponse
from app.schemas.user import (
    RetailerProfile,
    RetailerUpdate,
    StoreProfile,
    StoreUpdate,
)

router = APIRouter(prefix="/retailers", tags=["Retailer & Store Profiles"])


@router.get(
    "/me",
    response_model=RetailerProfile,
    summary="Get retailer profile",
)
def get_retailer_profile(
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Get profile information for the authenticated retailer."""
    return RetailerProfile(
        id=1,
        user_id=current_user.user_id,
        name="Sample Retailer",
        phone="9876543211",
    )


@router.put(
    "/me",
    response_model=RetailerProfile,
    summary="Update retailer profile",
)
def update_retailer_profile(
    payload: RetailerUpdate,
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Update profile details for the authenticated retailer."""
    return RetailerProfile(
        id=1,
        user_id=current_user.user_id,
        name=payload.name or "Sample Retailer",
        phone=payload.phone or "9876543211",
    )


@router.get(
    "/me/store",
    response_model=StoreProfile,
    summary="Get retailer's store details",
)
def get_store(
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Get store details, coordinates, operating hours, and open/closed status."""
    return StoreProfile(
        id=1,
        retailer_id=1,
        store_name="Fresh Mart",
        address="456 Market Lane",
        lat=28.6150,
        lng=77.2100,
        operating_hours="08:00 - 22:00",
        is_open=True,
    )


@router.put(
    "/me/store",
    response_model=StoreProfile,
    summary="Update store profile / toggles",
)
def update_store(
    payload: StoreUpdate,
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Update store details, address, coordinates, operating hours, or is_open toggle."""
    return StoreProfile(
        id=1,
        retailer_id=1,
        store_name=payload.store_name or "Fresh Mart",
        address=payload.address or "456 Market Lane",
        lat=payload.lat if payload.lat is not None else 28.6150,
        lng=payload.lng if payload.lng is not None else 77.2100,
        operating_hours=payload.operating_hours or "08:00 - 22:00",
        is_open=payload.is_open if payload.is_open is not None else True,
    )


@router.get(
    "/me/products",
    response_model=List[ProductResponse],
    summary="Get retailer's own catalog with stock",
)
def get_retailer_products(
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Retrieve full product catalog belonging to the retailer's store with stock counts."""
    return [
        ProductResponse(
            id=1,
            store_id=1,
            name="Sample Product",
            description="Fresh local product",
            category="Groceries",
            price=49.99,
            is_active=True,
            quantity=100,
            is_available=True,
        )
    ]
