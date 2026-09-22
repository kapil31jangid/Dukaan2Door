from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.deps import UserContext, get_current_user, get_db, require_role
from app.integrations.notifier import notify_order_status
from app.models.customer import Customer
from app.models.delivery import Delivery, DeliveryStatus as ModelDeliveryStatus
from app.models.delivery_partner import DeliveryPartner
from app.models.inventory import Inventory
from app.models.order import Order, OrderItem, OrderStatus as ModelOrderStatus
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
from app.services.order_service import validate_status_transition
from app.services.store_matching_service import RequestedItem, find_matching_store

router = APIRouter(prefix="/orders", tags=["Order Management & Lifecycle"])


def _schema_status(model_status: ModelOrderStatus) -> OrderStatus:
    return OrderStatus(model_status.value)


def _model_status(schema_status: OrderStatus) -> ModelOrderStatus:
    return ModelOrderStatus(schema_status.value)


def _order_to_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        customer_id=order.customer_id,
        store_id=order.store_id,
        status=_schema_status(order.status),
        total_amount=order.total_amount,
        delivery_address=order.delivery_address,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        delivery_partner_id=order.delivery.delivery_partner_id if order.delivery else None,
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
            )
            for item in order.items
        ],
    )


def _get_authorized_order(db: Session, order_id: int, current_user: UserContext) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if current_user.role == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
        allowed = customer and order.customer_id == customer.id
    elif current_user.role == "retailer":
        retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
        allowed = retailer and retailer.store and order.store_id == retailer.store.id
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
      a) Validate items and non-negative quantities
      b) Call store matching algorithm (Kapil's integration)
      c) Lock inventory rows & verify stock
      d) Take prices strictly from DB
      e) Create order record with status 'RECEIVED'
      f) Trigger non-blocking order status notification
    """
    customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")

    requested: dict[int, int] = {}
    for item in payload.items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity

    match = find_matching_store(
        db,
        payload.delivery_lat,
        payload.delivery_lng,
        [RequestedItem(product_id=product_id, quantity=quantity) for product_id, quantity in requested.items()],
    )
    if not match.matched or match.store_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=match.reason or "No eligible store found for this order",
        )

    store_id = match.store_id
    try:
        products = (
            db.query(Product)
            .filter(
                Product.id.in_(requested.keys()),
                Product.store_id == store_id,
                Product.is_active.is_(True),
            )
            .all()
        )
        if len(products) != len(requested):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Matched store cannot fulfill all items")

        inventory_by_product = {
            inventory.product_id: inventory
            for inventory in (
                db.query(Inventory)
                .filter(
                    Inventory.store_id == store_id,
                    Inventory.product_id.in_(requested.keys()),
                )
                .with_for_update()
                .all()
            )
        }

        total_amount = 0.0
        order = Order(
            customer_id=customer.id,
            store_id=store_id,
            status=ModelOrderStatus.RECEIVED,
            total_amount=0.0,
            delivery_address=payload.delivery_address,
            delivery_lat=payload.delivery_lat,
            delivery_lng=payload.delivery_lng,
            notes=payload.notes,
        )
        db.add(order)
        db.flush()

        for product in products:
            quantity = requested[product.id]
            inventory = inventory_by_product.get(product.id)
            if not inventory or not inventory.is_available or inventory.quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for {product.name}",
                )
            subtotal = round(product.price * quantity, 2)
            total_amount += subtotal
            inventory.quantity -= quantity
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    quantity=quantity,
                    unit_price=product.price,
                    subtotal=subtotal,
                )
            )

        order.total_amount = round(total_amount, 2)
        db.commit()
        db.refresh(order)
    except HTTPException:
        db.rollback()
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
    query = db.query(Order)
    if current_user.role == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user.user_id).first()
        query = query.filter(Order.customer_id == customer.id) if customer else query.filter(False)
    elif current_user.role == "retailer":
        retailer = db.query(Retailer).filter(Retailer.user_id == current_user.user_id).first()
        query = query.filter(Order.store_id == retailer.store.id) if retailer and retailer.store else query.filter(False)
    elif current_user.role == "delivery_partner":
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == current_user.user_id).first()
        query = query.join(Order.delivery).filter(Delivery.delivery_partner_id == partner.id) if partner else query.filter(False)

    if status_filter:
        query = query.filter(Order.status == _model_status(status_filter))

    orders = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [_order_to_response(order) for order in orders]


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
    return _order_to_response(_get_authorized_order(db, order_id, current_user))


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
      Terminal states: REJECTED, CANCELLED (triggers stock restoration)
    """
    order = _get_authorized_order(db, order_id, current_user)
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
    summary="Lightweight order status tracking for customer UI",
)
def get_order_status_tracking(
    order_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve lightweight status tracking timeline for live tracking screen."""
    order = _get_authorized_order(db, order_id, current_user)
    history_logs = [
        OrderStatusHistoryItem(
            status=order.status.value,
            timestamp=order.updated_at.isoformat(),
            note="Current order status",
        )
    ]
    return OrderStatusTrackingResponse(
        order_id=order_id,
        current_status=_schema_status(order.status),
        updated_at=order.updated_at.isoformat(),
        history=history_logs,
    )
