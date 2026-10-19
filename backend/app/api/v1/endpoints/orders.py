from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, false, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload
from app.core.deps import UserContext, get_current_user, get_db, require_role
from app.integrations.notifier import notify_order_status
from app.models.customer import Customer
from app.models.delivery import Delivery, DeliveryStatus as ModelDeliveryStatus
from app.models.delivery_partner import DeliveryPartner
from app.models.order import (
    Order,
    OrderItem,
    OrderStatus as ModelOrderStatus,
    RetailerOfferStatus,
    RetailerOrderOffer,
    RetailerOrderOfferItem,
)
from app.models.product import Product
from app.models.retailer import Retailer
from app.models.store import Store
from app.schemas.order import (
    OrderCreate,
    OrderItemResponse,
    OrderResponse,
    OrderStatus,
    OrderStatusHistoryItem,
    OrderStatusTrackingResponse,
    OrderStatusUpdate,
    OrderUpdate,
)
from app.services.order_service import (
    accept_retailer_offer,
    expire_retailer_offers,
    reject_retailer_offer,
    retailer_store_id,
    validate_status_transition,
)
from app.services.geo_service import validate_coordinates
from app.services.store_matching_service import RequestedItem, find_eligible_stores

router = APIRouter(prefix="/orders", tags=["Order Management & Lifecycle"])


ORDER_RESPONSE_LOAD_OPTIONS = (
    joinedload(Order.store),
    joinedload(Order.delivery).joinedload(Delivery.delivery_partner),
    selectinload(Order.items).joinedload(OrderItem.product),
    selectinload(Order.retailer_offers),
)


def _schema_status(model_status: ModelOrderStatus) -> OrderStatus:
    return OrderStatus(model_status.value)


def _model_status(schema_status: OrderStatus) -> ModelOrderStatus:
    return ModelOrderStatus(schema_status.value)


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _order_to_response(order: Order, retailer_store_id: Optional[int] = None) -> OrderResponse:
    partner = order.delivery.delivery_partner if order.delivery and order.delivery.delivery_partner else None
    store = order.store
    retailer_offer = next((offer for offer in order.retailer_offers if offer.store_id == retailer_store_id), None)
    return OrderResponse(
        id=order.id,
        customer_id=order.customer_id,
        store_id=order.store_id,
        store_name=store.store_name if store else None,
        store_address=store.address if store else None,
        store_lat=store.lat if store else None,
        store_lng=store.lng if store else None,
        status=_schema_status(order.status),
        total_amount=order.total_amount,
        delivery_address=order.delivery_address,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        delivery_partner_id=partner.id if partner else None,
        delivery_partner_name=partner.name if partner else None,
        delivery_partner_phone=partner.phone if partner else None,
        delivery_partner_vehicle=partner.vehicle_info if partner else None,
        delivery_id=order.delivery.id if order.delivery else None,
        notes=order.notes,
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
        items=[
            OrderItemResponse(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
                handling_type=item.product.handling_type if item.product else "NORMAL",
                requires_special_equipment=item.product.requires_special_equipment if item.product else False,
            )
            for item in order.items
        ],
        retailer_offer_status=retailer_offer.status.value if retailer_offer else None,
        retailer_offer_expires_at=retailer_offer.expires_at.isoformat() if retailer_offer else None,
        retailer_pool_size=len(order.retailer_offers),
    )


def _get_authorized_order(db: Session, order_id: int, current_user: UserContext) -> Order:
    order = (
        db.query(Order)
        .options(*ORDER_RESPONSE_LOAD_OPTIONS)
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if current_user.role == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
        allowed = customer and order.customer_id == customer.id
    elif current_user.role == "retailer":
        retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
        allowed = bool(retailer and retailer.store and (
            order.store_id == retailer.store.id
            or any(
                offer.store_id == retailer.store.id and offer.status == RetailerOfferStatus.PENDING
                for offer in order.retailer_offers
            )
        ))
    elif current_user.role == "delivery_partner":
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.user_id).first()
        allowed = bool(order.delivery and partner and order.delivery.delivery_partner_id == partner.id)
    else:
        allowed = False

    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this order")
    return order


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new order (Customer only)",
)
def create_order(
    payload: OrderCreate,
    current_user: UserContext = Depends(require_role(["customer"])),
    db: Session = Depends(get_db),
):
    """
    Create a new customer order.
    Steps performed atomically:
      a) Validate items, address, coordinates, and quantities
      b) Find every store in the active service-radius tier that can fill the cart
      c) Create one order and one read-only opportunity per eligible store
      d) Take prices strictly from the database
      e) Defer stock mutation until one retailer atomically accepts
      f) Trigger the non-blocking order-status notification hook
    """
    customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")
    if payload.checkout_token:
        existing = db.query(Order).filter(
            Order.customer_id == customer.id,
            Order.checkout_token == payload.checkout_token,
        ).first()
        if existing:
            return _order_to_response(existing)

    delivery_lat = payload.delivery_lat if payload.delivery_lat is not None else customer.lat
    delivery_lng = payload.delivery_lng if payload.delivery_lng is not None else customer.lng
    delivery_address = payload.delivery_address or customer.delivery_address
    if delivery_address is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery address is required")
    if delivery_lat is None or delivery_lng is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Latitude and longitude are required")
    validate_coordinates(delivery_lat, delivery_lng)

    requested: dict[int, int] = {}
    for item in payload.items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity

    matches = find_eligible_stores(
        db,
        float(delivery_lat),
        float(delivery_lng),
        [RequestedItem(product_id=product_id, quantity=quantity) for product_id, quantity in requested.items()],
    )
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No eligible store found for this order",
        )

    try:
        products = (
            db.query(Product)
            .filter(
                Product.id.in_(requested.keys()),
                Product.is_active.is_(True),
            )
            .all()
        )
        if len(products) != len(requested):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Some requested products are no longer available")

        total_amount = 0.0
        order = Order(
            customer_id=customer.id,
            store_id=None,
            status=ModelOrderStatus.RECEIVED,
            total_amount=0.0,
            delivery_address=delivery_address,
            delivery_lat=delivery_lat,
            delivery_lng=delivery_lng,
            notes=payload.notes,
            checkout_token=payload.checkout_token,
        )
        db.add(order)
        db.flush()

        order_items_by_requested_product: dict[int, OrderItem] = {}
        for product in products:
            quantity = requested[product.id]
            subtotal = round(product.price * quantity, 2)
            total_amount += subtotal
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=product.price,
                subtotal=subtotal,
            )
            db.add(order_item)
            db.flush()
            order_items_by_requested_product[product.id] = order_item

        expires_at = datetime.utcnow() + timedelta(minutes=15)
        for match in matches:
            offer = RetailerOrderOffer(
                order_id=order.id,
                store_id=match.store_id,
                status=RetailerOfferStatus.PENDING,
                distance_km=match.distance_km,
                expires_at=expires_at,
            )
            db.add(offer)
            db.flush()
            for matched_item in match.items:
                db.add(RetailerOrderOfferItem(
                    offer_id=offer.id,
                    order_item_id=order_items_by_requested_product[matched_item.requested_product_id].id,
                    product_id=matched_item.product_id,
                    inventory_id=matched_item.inventory_id,
                    quantity=matched_item.quantity,
                ))

        order.total_amount = round(total_amount, 2)
        db.commit()
        db.refresh(order)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        if payload.checkout_token:
            existing = db.query(Order).filter(
                Order.customer_id == customer.id,
                Order.checkout_token == payload.checkout_token,
            ).first()
            if existing:
                return _order_to_response(existing)
        raise

    notify_order_status(order.id, OrderStatus.RECEIVED.value)
    return _order_to_response(order)


@router.get(
    "",
    response_model=List[OrderResponse],
    summary="Get user order history",
)
def get_order_history(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    created_from: Optional[datetime] = Query(None),
    created_before: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get order history filtered for current user role:
    - Customer: returns own placed orders
    - Retailer: returns store orders
    - Delivery Partner: returns assigned deliveries
    """
    query = db.query(Order).options(*ORDER_RESPONSE_LOAD_OPTIONS)
    retailer = None
    if current_user.role == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
        query = query.filter(Order.customer_id == customer.id) if customer else query.filter(false())
    elif current_user.role == "retailer":
        retailer = (
            db.query(Retailer)
            .options(joinedload(Retailer.store))
            .filter(Retailer.user_id == current_user.user_id)
            .first()
        )
        if retailer and retailer.store:
            expire_retailer_offers(db)
            query = query.outerjoin(RetailerOrderOffer).filter(or_(
                Order.store_id == retailer.store.id,
                and_(
                    RetailerOrderOffer.store_id == retailer.store.id,
                    RetailerOrderOffer.status == RetailerOfferStatus.PENDING,
                ),
            )).distinct()
        else:
            query = query.filter(false())
    elif current_user.role == "delivery_partner":
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.user_id).first()
        query = query.join(Order.delivery).filter(Delivery.delivery_partner_id == partner.id) if partner else query.filter(false())

    if status_filter:
        query = query.filter(Order.status == _model_status(status_filter))

    start = _utc_naive(created_from) if created_from else None
    end = _utc_naive(created_before) if created_before else None
    if start and end and end <= start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="created_before must be later than created_from",
        )
    if start:
        query = query.filter(Order.created_at >= start)
    if end:
        query = query.filter(Order.created_at < end)

    orders = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    response_store_id = retailer.store.id if current_user.role == "retailer" and retailer and retailer.store else None
    return [_order_to_response(order, response_store_id) for order in orders]


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get detailed order information by ID",
)
def get_order(
    order_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single order by ID with ownership permission checks."""
    order = _get_authorized_order(db, order_id, current_user)
    response_store_id = retailer_store_id(db, current_user.user_id) if current_user.role == "retailer" else None
    return _order_to_response(order, response_store_id)


@router.post(
    "/{order_id}/retailer-accept",
    response_model=OrderResponse,
    summary="Atomically accept a retailer order opportunity",
)
def accept_order_opportunity(
    order_id: int,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    store_id = retailer_store_id(db, current_user.user_id)
    order = accept_retailer_offer(db, order_id, store_id, current_user.user_id)
    notify_order_status(order.id, OrderStatus.ACCEPTED.value)
    return _order_to_response(order, store_id)


@router.post(
    "/{order_id}/retailer-reject",
    response_model=OrderResponse,
    summary="Reject this retailer's order opportunity",
)
def reject_order_opportunity(
    order_id: int,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    store_id = retailer_store_id(db, current_user.user_id)
    order = reject_retailer_offer(db, order_id, store_id)
    if order.status == ModelOrderStatus.REJECTED:
        notify_order_status(order.id, OrderStatus.REJECTED.value)
    return _order_to_response(order, store_id)


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    summary="Update order lifecycle status",
)
def update_order_status_endpoint(
    order_id: int,
    payload: OrderStatusUpdate,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Single entry point for order status changes.
    Enforces state machine rules:
      RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
      Terminal states: REJECTED, CANCELLED. Customer cancellation is limited to
      RECEIVED, before any retailer acceptance or stock deduction.
    """
    order = _get_authorized_order(db, order_id, current_user)
    retailer_store = None
    if current_user.role == "retailer":
        retailer_store = retailer_store_id(db, current_user.user_id)
        if order.status != ModelOrderStatus.RECEIVED and order.store_id != retailer_store:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the retailer that accepted this order can update its fulfilment status",
            )
    if current_user.role == "retailer" and order.status == ModelOrderStatus.RECEIVED:
        if payload.status == OrderStatus.ACCEPTED:
            order = accept_retailer_offer(db, order_id, retailer_store, current_user.user_id)
            notify_order_status(order.id, payload.status.value)
            return _order_to_response(order, retailer_store)
        if payload.status == OrderStatus.REJECTED:
            order = reject_retailer_offer(db, order_id, retailer_store)
            if order.status == ModelOrderStatus.REJECTED:
                notify_order_status(order.id, payload.status.value)
            return _order_to_response(order, retailer_store)
    current_status = _schema_status(order.status)
    validate_status_transition(
        current_status=current_status,
        target_status=payload.status,
        user_role=current_user.role,
    )

    if current_user.role == "delivery_partner" and order.delivery:
        if payload.status == OrderStatus.OUT_FOR_DELIVERY and order.delivery.status not in {
            ModelDeliveryStatus.PICKED_UP,
            ModelDeliveryStatus.OUT_FOR_DELIVERY,
        }:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Delivery must be picked up before order can move out for delivery",
            )
        if payload.status == OrderStatus.DELIVERED and order.delivery.status != ModelDeliveryStatus.DELIVERED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Delivery must be delivered before order can be marked delivered",
            )

    order.status = _model_status(payload.status)
    if payload.status == OrderStatus.CANCELLED:
        db.query(RetailerOrderOffer).filter(
            RetailerOrderOffer.order_id == order.id,
            RetailerOrderOffer.status == RetailerOfferStatus.PENDING,
        ).update({RetailerOrderOffer.status: RetailerOfferStatus.LOST}, synchronize_session=False)
    db.commit()
    db.refresh(order)
    notify_order_status(order_id, payload.status.value)
    return _order_to_response(order)


@router.put(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Limited order update / notes",
)
def update_order(
    order_id: int,
    payload: OrderUpdate,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update order notes or metadata."""
    order = _get_authorized_order(db, order_id, current_user)
    if payload.notes is not None:
        order.notes = payload.notes
    db.commit()
    db.refresh(order)
    return _order_to_response(order)


@router.get(
    "/{order_id}/status",
    response_model=OrderStatusTrackingResponse,
    summary="Detailed order status tracking for customer UI",
)
def get_order_status_tracking(
    order_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve detailed status tracking timeline for live tracking screen."""
    order = _get_authorized_order(db, order_id, current_user)
    partner = order.delivery.delivery_partner if order.delivery and order.delivery.delivery_partner else None
    store = order.store

    ordered_stages = [
        ("RECEIVED", "Order received by Dukaan2Door"),
        ("ACCEPTED", "Order accepted by store"),
        ("PREPARING", "Store is packing your grocery items"),
        ("READY_FOR_PICKUP", "Order packed & delivery partner assigned"),
        ("OUT_FOR_DELIVERY", "Rider is on the way with your order"),
        ("DELIVERED", "Order delivered at your doorstep"),
    ]
    status_order = [s[0] for s in ordered_stages]
    curr_idx = status_order.index(order.status.value) if order.status.value in status_order else 0

    history_logs = []
    for i in range(curr_idx + 1):
        st, label = ordered_stages[i]
        history_logs.append(
            OrderStatusHistoryItem(
                status=st,
                timestamp=order.updated_at.isoformat() if i == curr_idx else order.created_at.isoformat(),
                note=label,
            )
        )

    return OrderStatusTrackingResponse(
        order_id=order_id,
        current_status=_schema_status(order.status),
        store_id=order.store_id,
        store_name=store.store_name if store else None,
        store_address=store.address if store else None,
        store_lat=store.lat if store else None,
        store_lng=store.lng if store else None,
        delivery_address=order.delivery_address,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        delivery_id=order.delivery.id if order.delivery else None,
        delivery_partner_id=partner.id if partner else None,
        delivery_partner_name=partner.name if partner else None,
        delivery_partner_phone=partner.phone if partner else None,
        delivery_partner_vehicle=partner.vehicle_info if partner else None,
        partner_lat=partner.current_lat if partner else None,
        partner_lng=partner.current_lng if partner else None,
        total_amount=order.total_amount,
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
        items=[
            OrderItemResponse(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
                handling_type=item.product.handling_type if item.product else "NORMAL",
                requires_special_equipment=item.product.requires_special_equipment if item.product else False,
            )
            for item in order.items
        ],
        history=history_logs,
    )
