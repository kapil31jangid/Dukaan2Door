from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.schemas.matching import StoreMatchRequest, StoreMatchResponse
from app.services.store_matching_service import RequestedItem, find_matching_store

router = APIRouter(prefix="/matching", tags=["Store Matching"])


@router.post("/store", response_model=StoreMatchResponse, summary="Find eligible store for requested items")
def match_store(
    payload: StoreMatchRequest,
    _current_user=Depends(require_role(["customer"])),
    db: Session = Depends(get_db),
):
    result = find_matching_store(
        db,
        payload.latitude,
        payload.longitude,
        [RequestedItem(product_id=item.product_id, quantity=item.quantity) for item in payload.items],
    )
    if not result.matched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.reason or "No eligible store found",
        )
    return StoreMatchResponse(**result.__dict__)
