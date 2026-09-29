from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import UserContext, get_db, get_current_user, require_role
from app.models.delivery import DeliveryStatus as ModelDeliveryStatus
from app.models.order import Order, OrderStatus as ModelOrderStatus
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
    get_available_partners_for_order,
    get_delivery_or_404,
    get_partner_for_user,
    record_location_update,
    update_delivery_status,
)
from app.services.geo_service import calculate_distance_km, has_valid_coordinates
from app.api.v1.endpoints.orders import _order_to_response
from app.services.realtime_service import manager
from app.services.routing_service import get_route

router = APIRouter(prefix="/deliveries", tags=["Delivery Workflow"])


def _schema_status(model_status: ModelDeliveryStatus) -> DeliveryStatus:
    return DeliveryStatus(model_status.value)


def _model_status(schema_status: DeliveryStatus) -> ModelDeliveryStatus:
    return ModelDeliveryStatus(schema_status.value)


def _delivery_response(delivery) -> DeliveryResponse:
    return DeliveryResponse.model_validate(delivery)


@router.get(
    "/available-orders",
    summary="List ready orders that a delivery partner can claim",
)
def get_available_orders(
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    partner = get_partner_for_user(db, current_user.user_id)
    if not partner or not partner.is_available or not has_valid_coordinates(partner.current_lat, partner.current_lng):
        return []

    available = []
    for order in db.query(Order).filter(Order.status == ModelOrderStatus.READY_FOR_PICKUP).all():
        if order.delivery and order.delivery.delivery_partner_id is not None:
            continue
        if not order.store or not has_valid_coordinates(order.store.lat, order.store.lng):
            continue
        distance = calculate_distance_km(
            float(order.store.lat), float(order.store.lng),
            float(partner.current_lat), float(partner.current_lng),
        )
        if distance <= 5:
            available.append((distance, order))

    available.sort(key=lambda item: (item[0], item[1].created_at))
    return [_order_to_response(order) for _, order in available]


@router.post(
    "/available-orders/{order_id}/claim",
    response_model=DeliveryAssignmentResponse,
    summary="Allow a delivery partner to claim a ready order",
)
async def claim_available_order(
    order_id: int,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    partner = get_partner_for_user(db, current_user.user_id)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery partner profile not found")
    if not partner.is_available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Partner is not available to claim orders")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != ModelOrderStatus.READY_FOR_PICKUP:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only ready orders can be claimed")
    if order.delivery and order.delivery.delivery_partner_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order has already been claimed")

    result = assign_delivery_partner(db, order_id, partner_id=partner.id)
    if not result.assigned or not result.delivery:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result.reason or "Order could not be claimed")

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


@router.get(
    "/{order_id}/available-partners",
    summary="Get list of available delivery partners near store for dispatch",
)
def get_nearby_partners_endpoint(
    order_id: int,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not retailer or not retailer.store or retailer.store.id != order.store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this store")
    return get_available_partners_for_order(db, order_id)


@router.post(
    "/{order_id}/assign",
    response_model=DeliveryAssignmentResponse,
    summary="Assign nearest or chosen delivery partner to ready order",
)
async def assign_delivery(
    order_id: int,
    partner_id: Optional[int] = Query(None, description="Optional specific delivery partner ID"),
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
    if not retailer or not retailer.store or retailer.store.id != order.store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this order")

    result = assign_delivery_partner(db, order_id, partner_id=partner_id)
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
    update = record_location_update(
        db,
        delivery,
        partner,
        payload.latitude,
        payload.longitude,
        payload.accuracy_m,
    )
    await manager.broadcast(
        delivery_id,
        "delivery_location_updated",
        {
            "delivery_id": delivery_id,
            "latitude": update.lat,
            "longitude": update.lng,
            "accuracy_m": update.accuracy_m,
            "status": update.status.value if update.status else None,
            "recorded_at": update.recorded_at.isoformat(),
        },
    )
    return DeliveryTrackingResponse.model_validate(update)


@router.get("/{delivery_id}/route", response_model=RouteResponse, summary="Get OSRM route for delivery")
def get_delivery_route(
    delivery_id: int,
    origin_lat: Optional[float] = Query(None),
    origin_lng: Optional[float] = Query(None),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role)
    if (origin_lat is None) != (origin_lng is None):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="origin_lat and origin_lng must be provided together")
    route_origin_lat = origin_lat if origin_lat is not None else delivery.pickup_lat
    route_origin_lng = origin_lng if origin_lng is not None else delivery.pickup_lng
    route_destination_lat = delivery.pickup_lat if origin_lat is not None else delivery.destination_lat
    route_destination_lng = delivery.pickup_lng if origin_lng is not None else delivery.destination_lng
    return RouteResponse(
        pickup_lat=route_origin_lat,
        pickup_lng=route_origin_lng,
        destination_lat=route_destination_lat,
        destination_lng=route_destination_lng,
        **get_route(
            route_origin_lat,
            route_origin_lng,
            delivery.pickup_lat if origin_lat is not None else delivery.destination_lat,
            delivery.pickup_lng if origin_lng is not None else delivery.destination_lng,
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
