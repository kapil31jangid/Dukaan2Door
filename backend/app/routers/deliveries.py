from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import UserContext, get_db, get_current_user, require_role
from app.models.delivery import DeliveryStatus as ModelDeliveryStatus
from app.models.order import Order
from app.models.retailer import Retailer
from app.schemas.delivery import (
    DeliveryAssignmentResponse,
    DeliveryLocationUpdate,
    DeliveryResponse,
    DeliveryStatus,
    DeliveryStatusUpdate,
    DeliveryTrackingListResponse,
    DeliveryTrackingResponse,
    RouteResponse,
)
from app.services.delivery_service import (
    assign_delivery_partner,
    authorize_delivery_access,
    get_delivery_or_404,
    get_partner_for_user,
    record_location_update,
    update_delivery_status,
)
from app.services.realtime_service import manager
from app.services.routing_service import get_route

router = APIRouter(prefix="/deliveries", tags=["Delivery Workflow"])


def _schema_status(model_status: ModelDeliveryStatus) -> DeliveryStatus:
    return DeliveryStatus(model_status.value)


def _model_status(schema_status: DeliveryStatus) -> ModelDeliveryStatus:
    return ModelDeliveryStatus(schema_status.value)


def _delivery_response(delivery) -> DeliveryResponse:
    return DeliveryResponse.model_validate(delivery)


@router.post(
    "/{order_id}/assign",
    response_model=DeliveryAssignmentResponse,
    summary="Assign nearest available delivery partner to ready order",
)
async def assign_delivery(
    order_id: int,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not retailer or not retailer.store or retailer.store.id != order.store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this order")

    result = assign_delivery_partner(db, order_id)
    if not result.assigned:
        if result.delivery:
            return DeliveryAssignmentResponse(
                assigned=False,
                delivery=_delivery_response(result.delivery),
                reason=result.reason,
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=result.reason or "No delivery partner available",
        )

    response = DeliveryAssignmentResponse(
        assigned=True,
        delivery=_delivery_response(result.delivery),
        distance_km=result.distance_km,
    )
    await manager.broadcast(
        result.delivery.id,
        "delivery_assigned",
        {"delivery_id": result.delivery.id, "order_id": order_id, "status": result.delivery.status.value},
    )
    return response


@router.get("/{delivery_id}", response_model=DeliveryResponse, summary="Get delivery details")
def get_delivery(
    delivery_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role)
    return _delivery_response(delivery)


@router.patch("/{delivery_id}/status", response_model=DeliveryResponse, summary="Update delivery status")
async def patch_delivery_status(
    delivery_id: int,
    payload: DeliveryStatusUpdate,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role, write=True)
    updated = update_delivery_status(db, delivery, _model_status(payload.status))
    await manager.broadcast(
        delivery_id,
        "delivery_status_updated",
        {"delivery_id": delivery_id, "status": updated.status.value, "order_status": updated.order.status.value},
    )
    if updated.status == ModelDeliveryStatus.DELIVERED:
        await manager.broadcast(delivery_id, "delivery_completed", {"delivery_id": delivery_id})
    return _delivery_response(updated)


@router.post(
    "/{delivery_id}/location",
    response_model=DeliveryTrackingResponse,
    summary="Record delivery partner location update",
)
async def update_delivery_location(
    delivery_id: int,
    payload: DeliveryLocationUpdate,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role, write=True)
    partner = get_partner_for_user(db, current_user.user_id)
    update = record_location_update(db, delivery, partner, payload.latitude, payload.longitude)
    await manager.broadcast(
        delivery_id,
        "delivery_location_updated",
        {
            "delivery_id": delivery_id,
            "latitude": update.lat,
            "longitude": update.lng,
            "status": update.status.value if update.status else None,
            "recorded_at": update.recorded_at.isoformat(),
        },
    )
    return DeliveryTrackingResponse.model_validate(update)


@router.get("/{delivery_id}/route", response_model=RouteResponse, summary="Get OSRM route for delivery")
def get_delivery_route(
    delivery_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role)
    return RouteResponse(
        **get_route(
            delivery.pickup_lat,
            delivery.pickup_lng,
            delivery.destination_lat,
            delivery.destination_lng,
        )
    )


@router.get(
    "/{delivery_id}/tracking",
    response_model=DeliveryTrackingListResponse,
    summary="Get delivery tracking history",
)
def get_delivery_tracking(
    delivery_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role)
    updates: List[DeliveryTrackingResponse] = [
        DeliveryTrackingResponse.model_validate(update)
        for update in sorted(delivery.tracking_updates, key=lambda item: item.recorded_at)
    ]
    return DeliveryTrackingListResponse(updates=updates)
