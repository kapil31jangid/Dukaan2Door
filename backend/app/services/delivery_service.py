from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.delivery import Delivery, DeliveryRejection, DeliveryStatus, DeliveryTracking
from app.models.delivery_partner import DeliveryPartner
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.retailer import Retailer
from app.models.store import Store
from app.services.geo_service import calculate_distance_km, has_valid_coordinates, validate_coordinates


# Keep the named dashboard demo rider at a reproducible starting point for the
# next test order. The final delivery tracking point remains at the customer.
DEMO_RIDER_DEFAULTS = {
    "satellite.rider.arjun.3km@example.com": (23.0276, 72.5368),
}


VALID_DELIVERY_TRANSITIONS = {
    # PICKED_UP remains accepted here for compatibility with existing API clients.
    # New clients should use ACCEPTED before pickup.
    DeliveryStatus.ASSIGNED: {DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED},
    DeliveryStatus.ACCEPTED: {DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED},
    DeliveryStatus.PICKED_UP: {DeliveryStatus.OUT_FOR_DELIVERY},
    DeliveryStatus.OUT_FOR_DELIVERY: {DeliveryStatus.DELIVERED},
    DeliveryStatus.DELIVERED: set(),
    DeliveryStatus.CANCELLED: set(),
}

DELIVERY_ARRIVAL_RADIUS_M = 100.0
MAX_GPS_ACCURACY_ALLOWANCE_M = 100.0


@dataclass(frozen=True)
class DeliveryAssignmentResult:
    assigned: bool
    delivery: Optional[Delivery] = None
    distance_km: Optional[float] = None
    reason: Optional[str] = None


def get_partner_for_user(db: Session, user_id: int) -> Optional[DeliveryPartner]:
    return db.query(DeliveryPartner).filter(DeliveryPartner.user_id == user_id).first()


def partner_capabilities(partner: DeliveryPartner) -> set[str]:
    return {value.strip().upper() for value in (partner.capabilities or "NORMAL").split(",") if value.strip()}


def required_capabilities_for_order(db: Session, order: Order) -> set[str]:
    products = db.query(Product).join(OrderItem, OrderItem.product_id == Product.id).filter(OrderItem.order_id == order.id).all()
    required = {"NORMAL"}
    for product in products:
        if product.requires_special_equipment:
            required.add("FROZEN_BOX" if product.handling_type == "FROZEN" else product.handling_type)
    return required


def partner_can_fulfil_order(db: Session, partner: DeliveryPartner, order: Order) -> bool:
    return required_capabilities_for_order(db, order).issubset(partner_capabilities(partner))


def partner_declined_order(db: Session, partner: DeliveryPartner, order: Order) -> bool:
    if not order.delivery:
        return False
    return (
        db.query(DeliveryRejection)
        .filter(
            DeliveryRejection.delivery_id == order.delivery.id,
            DeliveryRejection.delivery_partner_id == partner.id,
        )
        .first()
        is not None
    )


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


def get_available_partners_for_order(db: Session, order_id: int) -> list[dict]:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or not order.store:
        return []
    store = order.store
    if store.lat is None or store.lng is None:
        return []
    
    partners = (
        db.query(DeliveryPartner)
        .filter(
            DeliveryPartner.is_available.is_(True),
            DeliveryPartner.current_lat.isnot(None),
            DeliveryPartner.current_lng.isnot(None),
        )
        .all()
    )
    results = []
    for partner in partners:
        if (
            not has_valid_coordinates(partner.current_lat, partner.current_lng)
            or not partner_can_fulfil_order(db, partner, order)
            or partner_declined_order(db, partner, order)
        ):
            continue
        dist = calculate_distance_km(float(store.lat), float(store.lng), float(partner.current_lat), float(partner.current_lng))
        if dist > 5:
            continue
        results.append({
            "id": partner.id,
            "name": partner.name,
            "phone": partner.phone,
            "vehicle_info": partner.vehicle_info or "Delivery Bike",
            "distance_km": round(dist, 2),
            "is_available": partner.is_available,
        })
    results.sort(key=lambda x: x["distance_km"])
    return results


def assign_delivery_partner(db: Session, order_id: int, partner_id: Optional[int] = None) -> DeliveryAssignmentResult:
    # The order row lock makes the rider claim a compare-and-set operation on
    # PostgreSQL: only the first rider can bind an unclaimed delivery.
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if order.status != OrderStatus.READY_FOR_PICKUP:
        return DeliveryAssignmentResult(False, reason="Only ready-for-pickup orders can be claimed")
    if order.delivery and order.delivery.delivery_partner_id is not None:
        return DeliveryAssignmentResult(False, delivery=order.delivery, reason="Delivery already assigned")

    store = order.store
    if not store or store.lat is None or store.lng is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Store pickup coordinates are missing")
    validate_coordinates(order.delivery_lat, order.delivery_lng)

    partner: Optional[DeliveryPartner] = None
    distance: float = 0.5

    if partner_id is not None:
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.id == partner_id).with_for_update().first()
        if not partner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified delivery partner not found")
        if not partner.is_available:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Specified delivery partner is unavailable")
        if not partner_can_fulfil_order(db, partner, order):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Partner does not have the equipment required for this order")
        if partner_declined_order(db, partner, order):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This delivery offer was declined by the partner")
        if partner.current_lat is not None and partner.current_lng is not None:
            distance = calculate_distance_km(float(store.lat), float(store.lng), float(partner.current_lat), float(partner.current_lng))
            if distance > 5:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Partner is outside the 5 km delivery offer radius",
                )
    else:
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
        for p in partners:
            if not has_valid_coordinates(p.current_lat, p.current_lng):
                continue
            if not partner_can_fulfil_order(db, p, order):
                continue
            if partner_declined_order(db, p, order):
                continue
            dist = calculate_distance_km(float(store.lat), float(store.lng), float(p.current_lat), float(p.current_lng))
            candidates.append((dist, p.id, p))

        if not candidates:
            return DeliveryAssignmentResult(False, reason="No available delivery partner with a valid location")
        else:
            distance, _, partner = sorted(candidates)[0]

    delivery = order.delivery
    if delivery is None:
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
    else:
        delivery.delivery_partner_id = partner.id
        delivery.status = DeliveryStatus.ASSIGNED
        delivery.assigned_at = datetime.utcnow()
    partner.is_available = False
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return DeliveryAssignmentResult(True, delivery=delivery, distance_km=round(distance, 3))


def decline_available_order(
    db: Session,
    order_id: int,
    partner: DeliveryPartner,
    reason: Optional[str] = None,
) -> None:
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.READY_FOR_PICKUP:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only ready delivery offers can be declined")
    if order.delivery and order.delivery.delivery_partner_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order has already been claimed")
    if not partner.is_available or not has_valid_coordinates(partner.current_lat, partner.current_lng):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Partner is not eligible for delivery offers")
    if not order.store or not has_valid_coordinates(order.store.lat, order.store.lng):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store pickup coordinates are unavailable")
    distance = calculate_distance_km(
        float(order.store.lat),
        float(order.store.lng),
        float(partner.current_lat),
        float(partner.current_lng),
    )
    if distance > 5 or not partner_can_fulfil_order(db, partner, order):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Partner is not eligible for this delivery offer")

    delivery = order.delivery
    if delivery is None:
        delivery = Delivery(
            order_id=order.id,
            delivery_partner_id=None,
            status=DeliveryStatus.ASSIGNED,
            pickup_address=order.store.address,
            pickup_lat=order.store.lat,
            pickup_lng=order.store.lng,
            destination_address=order.delivery_address,
            destination_lat=order.delivery_lat,
            destination_lng=order.delivery_lng,
        )
        db.add(delivery)
        db.flush()

    existing = (
        db.query(DeliveryRejection)
        .filter(
            DeliveryRejection.delivery_id == delivery.id,
            DeliveryRejection.delivery_partner_id == partner.id,
        )
        .first()
    )
    if not existing:
        db.add(
            DeliveryRejection(
                delivery_id=delivery.id,
                delivery_partner_id=partner.id,
                reason=reason,
            )
        )
    db.commit()


def reject_delivery_assignment(db: Session, delivery_id: int, partner: DeliveryPartner, reason: Optional[str] = None) -> Delivery:
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).with_for_update().first()
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found")
    if delivery.delivery_partner_id != partner.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this delivery")
    if delivery.status != DeliveryStatus.ASSIGNED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only an unaccepted delivery can be rejected")
    db.add(DeliveryRejection(delivery_id=delivery.id, delivery_partner_id=partner.id, reason=reason))
    delivery.delivery_partner_id = None
    partner.is_available = True
    db.commit()
    db.refresh(delivery)
    return delivery


def update_delivery_status(db: Session, delivery: Delivery, target_status: DeliveryStatus) -> Delivery:
    allowed = VALID_DELIVERY_TRANSITIONS.get(delivery.status, set())
    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid delivery status transition from '{delivery.status.value}' to '{target_status.value}'",
        )

    if target_status == DeliveryStatus.PICKED_UP and settings.route_playback_enabled:
        pickup_arrival = (
            db.query(DeliveryTracking)
            .filter(
                DeliveryTracking.delivery_id == delivery.id,
                DeliveryTracking.source == "ROUTE_PLAYBACK",
                DeliveryTracking.status == DeliveryStatus.ACCEPTED,
            )
            .order_by(DeliveryTracking.recorded_at.desc(), DeliveryTracking.id.desc())
            .first()
        )
        if pickup_arrival is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The rider is still travelling to the pickup store",
            )
        pickup_distance_m = calculate_distance_km(
            pickup_arrival.lat,
            pickup_arrival.lng,
            delivery.pickup_lat,
            delivery.pickup_lng,
        ) * 1000
        if pickup_distance_m > DELIVERY_ARRIVAL_RADIUS_M:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The rider must reach the pickup store first ({round(pickup_distance_m)} m remaining)",
            )
    if target_status == DeliveryStatus.DELIVERED:
        journey_distance_m = calculate_distance_km(
            delivery.pickup_lat,
            delivery.pickup_lng,
            delivery.destination_lat,
            delivery.destination_lng,
        ) * 1000
        if journey_distance_m > DELIVERY_ARRIVAL_RADIUS_M:
            latest_position = (
                db.query(DeliveryTracking)
                .filter(
                    DeliveryTracking.delivery_id == delivery.id,
                    DeliveryTracking.source != "LIFECYCLE",
                )
                .order_by(DeliveryTracking.recorded_at.desc(), DeliveryTracking.id.desc())
                .first()
            )
            if latest_position is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A current rider location is required before marking the delivery complete",
                )
            distance_m = calculate_distance_km(
                latest_position.lat,
                latest_position.lng,
                delivery.destination_lat,
                delivery.destination_lng,
            ) * 1000
            accuracy_allowance_m = min(
                MAX_GPS_ACCURACY_ALLOWANCE_M,
                max(0.0, latest_position.accuracy_m or 0.0),
            )
            allowed_distance_m = DELIVERY_ARRIVAL_RADIUS_M + accuracy_allowance_m
            if distance_m > allowed_distance_m:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "The rider must reach the customer before marking the delivery complete "
                        f"({round(distance_m)} m remaining)"
                    ),
                )

    now = datetime.now(timezone.utc)
    delivery.status = target_status
    if target_status == DeliveryStatus.PICKED_UP:
        delivery.picked_up_at = now
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
            source="LIFECYCLE",
            status=target_status,
        )
    )
    if target_status == DeliveryStatus.DELIVERED and delivery.delivery_partner:
        email = getattr(delivery.delivery_partner.user, "email", None)
        default_location = DEMO_RIDER_DEFAULTS.get(email)
        if default_location:
            delivery.delivery_partner.current_lat, delivery.delivery_partner.current_lng = default_location
    db.commit()
    db.refresh(delivery)
    return delivery


def record_location_update(
    db: Session,
    delivery: Delivery,
    partner: DeliveryPartner,
    latitude: float,
    longitude: float,
    accuracy_m: Optional[float] = None,
    captured_at: Optional[datetime] = None,
    source: str = "GPS",
) -> DeliveryTracking:
    if delivery.status in {DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Location updates are not allowed after a delivery is complete",
        )
    if delivery.status not in {DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.OUT_FOR_DELIVERY}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Accept the delivery before sharing location",
        )

    validate_coordinates(latitude, longitude)
    if not partner or delivery.delivery_partner_id != partner.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the assigned delivery partner can update this location")

    now = datetime.now(timezone.utc)
    captured = captured_at or now
    if captured.tzinfo is None:
        captured = captured.replace(tzinfo=timezone.utc)
    captured = captured.astimezone(timezone.utc)
    if captured < now - timedelta(minutes=2):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stale location update")
    if captured > now + timedelta(minutes=1):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Location timestamp is in the future")

    # Lock the delivery row so concurrent requests cannot let an older capture
    # commit after a newer one. Lifecycle audit points must not participate in
    # movement ordering.
    db.query(Delivery).filter(Delivery.id == delivery.id).with_for_update().one()
    latest_gps = (
        db.query(DeliveryTracking)
        .filter(
            DeliveryTracking.delivery_id == delivery.id,
            DeliveryTracking.source != "LIFECYCLE",
        )
        .order_by(DeliveryTracking.recorded_at.desc(), DeliveryTracking.id.desc())
        .first()
    )
    captured_naive = captured.replace(tzinfo=None)
    if latest_gps and latest_gps.recorded_at >= captured_naive:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Out-of-order location update")

    partner.current_lat = latitude
    partner.current_lng = longitude
    update = DeliveryTracking(
        delivery_id=delivery.id,
        lat=latitude,
        lng=longitude,
        accuracy_m=accuracy_m,
        source=source,
        status=delivery.status,
        recorded_at=captured_naive,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return update
