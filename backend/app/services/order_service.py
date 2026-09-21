from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from app.integrations.notifier import notify_order_status
from app.schemas.order import OrderStatus, VALID_ORDER_TRANSITIONS


def validate_status_transition(
    current_status: OrderStatus,
    target_status: OrderStatus,
    user_role: str,
) -> None:
    """
    Enforce state machine rules for order status updates.
    Raises HTTPException (409 Conflict or 403 Forbidden) if transition is illegal.
    """
    if current_status not in VALID_ORDER_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order is in a terminal state '{current_status}' and cannot be updated.",
        )

    allowed_next_states = VALID_ORDER_TRANSITIONS[current_status]
    if target_status not in allowed_next_states:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid status transition from '{current_status}' to '{target_status}'. Allowed: {[s.value for s in allowed_next_states]}",
        )

    # Role permission guards
    if user_role == "customer":
        if target_status != OrderStatus.CANCELLED or current_status != OrderStatus.RECEIVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Customers can only cancel orders while status is 'RECEIVED'.",
            )
    elif user_role == "retailer":
        allowed_retailer_transitions = {
            (OrderStatus.RECEIVED, OrderStatus.ACCEPTED),
            (OrderStatus.RECEIVED, OrderStatus.REJECTED),
            (OrderStatus.ACCEPTED, OrderStatus.PREPARING),
            (OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP),
        }
        if (current_status, target_status) not in allowed_retailer_transitions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Retailers are not authorized to transition order from '{current_status}' to '{target_status}'.",
            )
    elif user_role == "delivery_partner":
        allowed_delivery_transitions = {
            (OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY),
            (OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED),
        }
        if (current_status, target_status) not in allowed_delivery_transitions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Delivery partners are not authorized to transition order from '{current_status}' to '{target_status}'.",
            )
