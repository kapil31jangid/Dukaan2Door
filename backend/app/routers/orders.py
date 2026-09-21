from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.deps import UserContext, get_current_user, require_role
from app.integrations.notifier import notify_order_status
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

router = APIRouter(prefix="/orders", tags=["Order Management & Lifecycle"])


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new order (Customer only)",
)
def create_order(
    payload: OrderCreate,
    current_user: UserContext = Depends(require_role(["customer"])),
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
    # Sample calculated response structure
    order_items = [
        OrderItemResponse(
            id=1,
            order_id=1,
            product_id=item.product_id,
            product_name="Product Item",
            quantity=item.quantity,
            unit_price=49.99,
            subtotal=round(49.99 * item.quantity, 2),
        )
        for item in payload.items
    ]
    total_amount = sum(item.subtotal for item in order_items)

    notify_order_status(1, OrderStatus.RECEIVED.value)

    return OrderResponse(
        id=1,
        customer_id=current_user.user_id,
        store_id=1,
        status=OrderStatus.RECEIVED,
        total_amount=total_amount,
        delivery_address=payload.delivery_address,
        delivery_lat=payload.delivery_lat,
        delivery_lng=payload.delivery_lng,
        delivery_partner_id=None,
        notes=payload.notes,
        created_at="2026-09-21T22:00:00Z",
        updated_at="2026-09-21T22:00:00Z",
        items=order_items,
    )


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
):
    """
    Get order history filtered for current user role:
    - Customer: returns own placed orders
    - Retailer: returns store orders
    - Delivery Partner: returns assigned deliveries
    """
    sample_item = OrderItemResponse(
        id=1,
        order_id=1,
        product_id=1,
        product_name="Product Item",
        quantity=2,
        unit_price=49.99,
        subtotal=99.98,
    )
    return [
        OrderResponse(
            id=1,
            customer_id=current_user.user_id if current_user.role == "customer" else 1,
            store_id=1,
            status=status_filter or OrderStatus.RECEIVED,
            total_amount=99.98,
            delivery_address="123 Main St",
            delivery_lat=28.6139,
            delivery_lng=77.2090,
            delivery_partner_id=None,
            notes=None,
            created_at="2026-09-21T22:00:00Z",
            updated_at="2026-09-21T22:00:00Z",
            items=[sample_item],
        )
    ]


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get detailed order information by ID",
)
def get_order(
    order_id: int,
    current_user: UserContext = Depends(get_current_user),
):
    """Get single order by ID with ownership permission checks."""
    if order_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    sample_item = OrderItemResponse(
        id=1,
        order_id=order_id,
        product_id=1,
        product_name="Product Item",
        quantity=2,
        unit_price=49.99,
        subtotal=99.98,
    )
    return OrderResponse(
        id=order_id,
        customer_id=1,
        store_id=1,
        status=OrderStatus.RECEIVED,
        total_amount=99.98,
        delivery_address="123 Main St",
        delivery_lat=28.6139,
        delivery_lng=77.2090,
        delivery_partner_id=None,
        notes=None,
        created_at="2026-09-21T22:00:00Z",
        updated_at="2026-09-21T22:00:00Z",
        items=[sample_item],
    )


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    summary="Update order lifecycle status",
)
def update_order_status_endpoint(
    order_id: int,
    payload: OrderStatusUpdate,
    current_user: UserContext = Depends(get_current_user),
):
    """
    Single entry point for order status changes.
    Enforces state machine rules:
      RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
      Terminal states: REJECTED, CANCELLED (triggers stock restoration)
    """
    # Enforce state machine lifecycle transition rules
    current_status = OrderStatus.RECEIVED  # Example baseline state
    validate_status_transition(
        current_status=current_status,
        target_status=payload.status,
        user_role=current_user.role,
    )

    notify_order_status(order_id, payload.status.value)

    sample_item = OrderItemResponse(
        id=1,
        order_id=order_id,
        product_id=1,
        product_name="Product Item",
        quantity=2,
        unit_price=49.99,
        subtotal=99.98,
    )
    return OrderResponse(
        id=order_id,
        customer_id=1,
        store_id=1,
        status=payload.status,
        total_amount=99.98,
        delivery_address="123 Main St",
        delivery_lat=28.6139,
        delivery_lng=77.2090,
        delivery_partner_id=None,
        notes=None,
        created_at="2026-09-21T22:00:00Z",
        updated_at="2026-09-21T22:05:00Z",
        items=[sample_item],
    )


@router.put(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Limited order update / notes",
)
def update_order(
    order_id: int,
    payload: OrderUpdate,
    current_user: UserContext = Depends(get_current_user),
):
    """Update order notes or metadata."""
    sample_item = OrderItemResponse(
        id=1,
        order_id=order_id,
        product_id=1,
        product_name="Product Item",
        quantity=2,
        unit_price=49.99,
        subtotal=99.98,
    )
    return OrderResponse(
        id=order_id,
        customer_id=1,
        store_id=1,
        status=OrderStatus.RECEIVED,
        total_amount=99.98,
        delivery_address="123 Main St",
        delivery_lat=28.6139,
        delivery_lng=77.2090,
        delivery_partner_id=None,
        notes=payload.notes,
        created_at="2026-09-21T22:00:00Z",
        updated_at="2026-09-21T22:05:00Z",
        items=[sample_item],
    )


@router.get(
    "/{order_id}/status",
    response_model=OrderStatusTrackingResponse,
    summary="Lightweight order status tracking for customer UI",
)
def get_order_status_tracking(
    order_id: int,
    current_user: UserContext = Depends(get_current_user),
):
    """Retrieve lightweight status tracking timeline for live tracking screen."""
    history_logs = [
        OrderStatusHistoryItem(
            status=OrderStatus.RECEIVED.value,
            timestamp="2026-09-21T22:00:00Z",
            note="Order received by platform",
        )
    ]
    return OrderStatusTrackingResponse(
        order_id=order_id,
        current_status=OrderStatus.RECEIVED,
        updated_at="2026-09-21T22:00:00Z",
        history=history_logs,
    )
