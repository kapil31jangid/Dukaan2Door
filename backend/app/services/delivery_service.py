from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.delivery import Delivery, DeliveryStatus, DeliveryTracking
from app.models.delivery_partner import DeliveryPartner
from app.models.order import Order, OrderStatus
from app.models.retailer import Retailer
from app.models.store import Store
from app.services.geo_service import calculate_distance_km, has_valid_coordinates, validate_coordinates


VALID_DELIVERY_TRANSITIONS = {
    DeliveryStatus.ASSIGNED: {DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED},
    DeliveryStatus.PICKED_UP: {DeliveryStatus.OUT_FOR_DELIVERY},
    DeliveryStatus.OUT_FOR_DELIVERY: {DeliveryStatus.DELIVERED},
    DeliveryStatus.DELIVERED: set(),
    DeliveryStatus.CANCELLED: set(),
}


@dataclass(frozen=True)
class DeliveryAssignmentResult:
    assigned: bool
    delivery: Optional[Delivery] = None
    distance_km: Optional[float] = None
    reason: Optional[str] = None


def get_partner_for_user(db: Session, user_id: int) -> Optional[DeliveryPartner]:
    return db.query(DeliveryPartner).filter(DeliveryPartner.user_id == user_id).first()


def get_delivery_or_404(db: Session, delivery_id: int) -> Delivery:
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found")
    return delivery


def authorize_delivery_access(db: Session, delivery: Delivery, user_id: int, role: str, write: bool = False) -> None:
    if role == "customer":
        if write:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customers cannot modify deliveries")
        customer = db.query(Customer).filter(Customer.user_id == user_id).first()
        allowed = customer and delivery.order.customer_id == customer.id
    elif role == "retailer":
        retailer = db.query(Retailer).filter(Retailer.user_id == user_id).first()
        allowed = retailer and retailer.store and delivery.order.store_id == retailer.store.id
    elif role == "delivery_partner":
        partner = get_partner_for_user(db, user_id)
        allowed = partner and delivery.delivery_partner_id == partner.id
    else:
        allowed = False

    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this delivery")


def assign_delivery_partner(db: Session, order_id: int) -> DeliveryAssignmentResult:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.READY_FOR_PICKUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order must be READY_FOR_PICKUP before assigning delivery",
        )
    if order.delivery:
        return DeliveryAssignmentResult(False, delivery=order.delivery, reason="Delivery already assigned")

    store = order.store
    if not store or store.lat is None or store.lng is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Store pickup coordinates are missing")
    validate_coordinates(order.delivery_lat, order.delivery_lng)

    partners = (
        db.query(DeliveryPartner)
        .filter(
            DeliveryPartner.is_available.is_(True),
            DeliveryPartner.current_lat.isnot(None),
            DeliveryPartner.current_lng.isnot(None),
        )
        .all()
    )
    candidates: list[tuple[float, int, DeliveryPartner]] = []
    for partner in partners:
        if not has_valid_coordinates(partner.current_lat, partner.current_lng):
            continue
        distance = calculate_distance_km(store.lat, store.lng, partner.current_lat, partner.current_lng)
        candidates.append((distance, partner.id, partner))

    if not candidates:
        return DeliveryAssignmentResult(False, reason="No delivery partner available")

    distance, _, partner = sorted(candidates)[0]
    delivery = Delivery(
        order_id=order.id,
        delivery_partner_id=partner.id,
        status=DeliveryStatus.ASSIGNED,
        pickup_address=store.address,
        pickup_lat=store.lat,
        pickup_lng=store.lng,
        destination_address=order.delivery_address,
        destination_lat=order.delivery_lat,
        destination_lng=order.delivery_lng,
    )
    partner.is_available = False
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return DeliveryAssignmentResult(True, delivery=delivery, distance_km=round(distance, 3))


def update_delivery_status(db: Session, delivery: Delivery, target_status: DeliveryStatus) -> Delivery:
    allowed = VALID_DELIVERY_TRANSITIONS.get(delivery.status, set())
    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid delivery status transition from '{delivery.status.value}' to '{target_status.value}'",
        )

    now = datetime.now(timezone.utc)
    delivery.status = target_status
    if target_status == DeliveryStatus.PICKED_UP:
        delivery.picked_up_at = now
        delivery.order.status = OrderStatus.OUT_FOR_DELIVERY
    elif target_status == DeliveryStatus.OUT_FOR_DELIVERY:
        delivery.order.status = OrderStatus.OUT_FOR_DELIVERY
    elif target_status == DeliveryStatus.DELIVERED:
        delivery.delivered_at = now
        delivery.order.status = OrderStatus.DELIVERED
        if delivery.delivery_partner:
            delivery.delivery_partner.is_available = True
    elif target_status == DeliveryStatus.CANCELLED and delivery.delivery_partner:
        delivery.delivery_partner.is_available = True

    db.add(
        DeliveryTracking(
            delivery_id=delivery.id,
            lat=delivery.delivery_partner.current_lat if delivery.delivery_partner else delivery.pickup_lat,
            lng=delivery.delivery_partner.current_lng if delivery.delivery_partner else delivery.pickup_lng,
            status=target_status,
        )
    )
    db.commit()
    db.refresh(delivery)
    return delivery


def record_location_update(
    db: Session,
    delivery: Delivery,
    partner: DeliveryPartner,
    latitude: float,
    longitude: float,
) -> DeliveryTracking:
    validate_coordinates(latitude, longitude)
    partner.current_lat = latitude
    partner.current_lng = longitude
    update = DeliveryTracking(
        delivery_id=delivery.id,
        lat=latitude,
        lng=longitude,
        status=delivery.status,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return update
