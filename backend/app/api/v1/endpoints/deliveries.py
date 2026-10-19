from datetime import timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import UserContext, get_db, get_current_user, require_role
from app.core.config import settings
from app.models.delivery import DeliveryRejection, DeliveryStatus as ModelDeliveryStatus
from app.models.delivery_partner import DeliveryPartner
from app.models.order import Order, OrderStatus as ModelOrderStatus
from app.models.retailer import Retailer
from app.schemas.delivery import (
    DeliveryAssignmentResponse,
    DeliveryLocationSource,
    DeliveryLocationUpdate,
    DeliveryOfferDeclineResponse,
    DeliveryRejectRequest,
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
    decline_available_order,
    get_available_partners_for_order,
    get_delivery_or_404,
    get_partner_for_user,
    record_location_update,
    reject_delivery_assignment,
    update_delivery_status,
)
from app.services.geo_service import calculate_distance_km, has_valid_coordinates
from app.api.v1.endpoints.orders import ORDER_RESPONSE_LOAD_OPTIONS, _order_to_response
from app.services.realtime_service import manager
from app.services.routing_service import get_route
from app.services.route_playback_service import route_playback_manager

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

    orders = (
        db.query(Order)
        .options(*ORDER_RESPONSE_LOAD_OPTIONS)
        .filter(Order.status == ModelOrderStatus.READY_FOR_PICKUP)
        .all()
    )
    candidate_partners = (
        db.query(DeliveryPartner)
        .filter(
            DeliveryPartner.is_available.is_(True),
            DeliveryPartner.current_lat.isnot(None),
            DeliveryPartner.current_lng.isnot(None),
        )
        .all()
    )
    delivery_ids = [order.delivery.id for order in orders if order.delivery]
    rejected_pairs = set()
    if delivery_ids:
        rejected_pairs = {
            (rejection.delivery_id, rejection.delivery_partner_id)
            for rejection in db.query(DeliveryRejection).filter(
                DeliveryRejection.delivery_id.in_(delivery_ids)
            )
        }

    def eligible_partners(order: Order) -> list[DeliveryPartner]:
        required = {"NORMAL"}
        for item in order.items:
            if item.product and item.product.requires_special_equipment:
                required.add(
                    "FROZEN_BOX"
                    if item.product.handling_type == "FROZEN"
                    else item.product.handling_type
                )
        delivery_id = order.delivery.id if order.delivery else None
        return [
            candidate
            for candidate in candidate_partners
            if has_valid_coordinates(candidate.current_lat, candidate.current_lng)
            and required.issubset({
                value.strip().upper()
                for value in (candidate.capabilities or "NORMAL").split(",")
                if value.strip()
            })
            and (delivery_id, candidate.id) not in rejected_pairs
            and calculate_distance_km(
                float(order.store.lat),
                float(order.store.lng),
                float(candidate.current_lat),
                float(candidate.current_lng),
            ) <= 5
        ]

    available = []
    pool_sizes: dict[int, int] = {}
    for order in orders:
        if order.delivery and order.delivery.delivery_partner_id is not None:
            continue
        if not order.store or not has_valid_coordinates(order.store.lat, order.store.lng):
            continue
        distance = calculate_distance_km(
            float(order.store.lat), float(order.store.lng),
            float(partner.current_lat), float(partner.current_lng),
        )
        if distance > 5:
            continue
        eligible = eligible_partners(order)
        if any(candidate.id == partner.id for candidate in eligible):
            available.append((distance, order))
            pool_sizes[order.id] = len(eligible)

    available.sort(key=lambda item: (item[0], item[1].created_at))
    responses = []
    for _, order in available:
        response = _order_to_response(order)
        responses.append(response.model_copy(update={
            "eligible_rider_pool_size": pool_sizes[order.id],
        }))
    return responses


@router.post(
    "/available-orders/{order_id}/decline",
    response_model=DeliveryOfferDeclineResponse,
    summary="Decline a ready order without claiming or cancelling it",
)
def decline_available_delivery_offer(
    order_id: int,
    payload: DeliveryRejectRequest,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    partner = get_partner_for_user(db, current_user.user_id)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery partner profile not found")
    decline_available_order(db, order_id, partner, payload.reason)
    return DeliveryOfferDeclineResponse(order_id=order_id)


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


@router.post("/{delivery_id}/reject", response_model=DeliveryResponse, summary="Reject an unaccepted delivery claim")
async def reject_delivery(
    delivery_id: int,
    payload: DeliveryRejectRequest,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    partner = get_partner_for_user(db, current_user.user_id)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery partner profile not found")
    delivery = reject_delivery_assignment(db, delivery_id, partner, payload.reason)
    await manager.broadcast(
        delivery.id,
        "delivery_available",
        {"delivery_id": delivery.id, "order_id": delivery.order_id, "status": delivery.status.value},
    )
    return _delivery_response(delivery)


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
    if payload.status == DeliveryStatus.PICKED_UP and settings.route_playback_enabled:
        updated = update_delivery_status(db, updated, ModelDeliveryStatus.OUT_FOR_DELIVERY)
    if updated.status in {ModelDeliveryStatus.ACCEPTED, ModelDeliveryStatus.OUT_FOR_DELIVERY}:
        await route_playback_manager.start(delivery_id)
    else:
        await route_playback_manager.stop(delivery_id)
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
    response_model_by_alias=False,
    summary="Record delivery partner location update",
)
async def update_delivery_location(
    delivery_id: int,
    payload: DeliveryLocationUpdate,
    current_user: UserContext = Depends(require_role(["delivery_partner"])),
    db: Session = Depends(get_db),
):
    source_disabled = (
        payload.source == DeliveryLocationSource.DEMO_SIMULATION
        and not settings.ENABLE_DEMO_ROUTE_PLAYBACK
    ) or (
        payload.source == DeliveryLocationSource.ROUTE_PLAYBACK
        and not settings.route_playback_enabled
    )
    if source_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Simulated locations are disabled on this backend",
        )
    delivery = get_delivery_or_404(db, delivery_id)
    partner = get_partner_for_user(db, current_user.user_id)
    if not partner or delivery.delivery_partner_id != partner.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this delivery",
        )
    update = record_location_update(
        db,
        delivery,
        partner,
        payload.latitude,
        payload.longitude,
        payload.accuracy_m,
        payload.captured_at,
        payload.source.value,
    )
    await manager.broadcast(
        delivery_id,
        "delivery_location_updated",
        {
            "delivery_id": delivery_id,
            "latitude": update.lat,
            "longitude": update.lng,
            "accuracy_m": update.accuracy_m,
            "source": update.source,
            "status": update.status.value if update.status else None,
            "recorded_at": update.recorded_at.replace(tzinfo=timezone.utc).isoformat(),
            "sequence": update.id,
            "delivery_partner_id": partner.id,
        },
    )
    response = DeliveryTrackingResponse.model_validate(update)
    response.sequence = update.id
    response.delivery_partner_id = partner.id
    return response


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
    partner = delivery.delivery_partner
    has_partner_location = partner and has_valid_coordinates(partner.current_lat, partner.current_lng)
    route_origin_lat = origin_lat if origin_lat is not None else (
        float(partner.current_lat) if has_partner_location else delivery.pickup_lat
    )
    route_origin_lng = origin_lng if origin_lng is not None else (
        float(partner.current_lng) if has_partner_location else delivery.pickup_lng
    )
    going_to_pickup = delivery.status in {
        ModelDeliveryStatus.ASSIGNED,
        ModelDeliveryStatus.ACCEPTED,
        ModelDeliveryStatus.PICKED_UP,
    }
    route_destination_lat = delivery.pickup_lat if going_to_pickup else delivery.destination_lat
    route_destination_lng = delivery.pickup_lng if going_to_pickup else delivery.destination_lng
    return RouteResponse(
        pickup_lat=route_origin_lat,
        pickup_lng=route_origin_lng,
        destination_lat=route_destination_lat,
        destination_lng=route_destination_lng,
        **get_route(
            route_origin_lat,
            route_origin_lng,
            route_destination_lat,
            route_destination_lng,
        )
    )


@router.get(
    "/{delivery_id}/tracking",
    response_model=DeliveryTrackingListResponse,
    response_model_by_alias=False,
    summary="Get delivery tracking history",
)
def get_delivery_tracking(
    delivery_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = get_delivery_or_404(db, delivery_id)
    authorize_delivery_access(db, delivery, current_user.user_id, current_user.role)
    updates: List[DeliveryTrackingResponse] = []
    for update in sorted(delivery.tracking_updates, key=lambda item: (item.recorded_at, item.id)):
        response = DeliveryTrackingResponse.model_validate(update)
        response.sequence = update.id
        response.delivery_partner_id = delivery.delivery_partner_id
        updates.append(response)
    return DeliveryTrackingListResponse(updates=updates)
