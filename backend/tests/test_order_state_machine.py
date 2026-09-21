import pytest
from fastapi import HTTPException
from app.schemas.order import OrderStatus
from app.services.order_service import validate_status_transition


def test_valid_retailer_transitions():
    # Retailer transitions
    validate_status_transition(OrderStatus.RECEIVED, OrderStatus.ACCEPTED, "retailer")
    validate_status_transition(OrderStatus.RECEIVED, OrderStatus.REJECTED, "retailer")
    validate_status_transition(OrderStatus.ACCEPTED, OrderStatus.PREPARING, "retailer")
    validate_status_transition(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, "retailer")


def test_valid_delivery_partner_transitions():
    # Delivery partner transitions
    validate_status_transition(OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY, "delivery_partner")
    validate_status_transition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, "delivery_partner")


def test_valid_customer_cancellation():
    # Customer cancellation from RECEIVED
    validate_status_transition(OrderStatus.RECEIVED, OrderStatus.CANCELLED, "customer")


def test_invalid_skipped_transition():
    with pytest.raises(HTTPException) as exc_info:
        validate_status_transition(OrderStatus.RECEIVED, OrderStatus.OUT_FOR_DELIVERY, "delivery_partner")
    assert exc_info.value.status_code == 409


def test_invalid_role_permission():
    # Customer trying to move to PREPARING
    with pytest.raises(HTTPException) as exc_info:
        validate_status_transition(OrderStatus.ACCEPTED, OrderStatus.PREPARING, "customer")
    assert exc_info.value.status_code == 403


def test_terminal_state_rejection():
    # Updating from DELIVERED should raise 409
    with pytest.raises(HTTPException) as exc_info:
        validate_status_transition(OrderStatus.DELIVERED, OrderStatus.RECEIVED, "retailer")
    assert exc_info.value.status_code == 409
