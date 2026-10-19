from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.inventory_adjustment import InventoryAdjustment
from app.models.order import Order, OrderStatus as ModelOrderStatus, RetailerOfferStatus, RetailerOrderOffer
from app.models.retailer import Retailer
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


def retailer_store_id(db: Session, user_id: int) -> int:
    retailer = db.query(Retailer).filter(Retailer.user_id == user_id).first()
    if not retailer or not retailer.store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")
    return retailer.store.id


def expire_retailer_offers(db: Session, order_id: int | None = None) -> None:
    now = datetime.utcnow()
    query = db.query(RetailerOrderOffer).filter(
        RetailerOrderOffer.status == RetailerOfferStatus.PENDING,
        RetailerOrderOffer.expires_at <= now,
    )
    if order_id is not None:
        query = query.filter(RetailerOrderOffer.order_id == order_id)
    expired = query.all()
    if not expired:
        return
    affected_order_ids = {offer.order_id for offer in expired}
    for offer in expired:
        offer.status = RetailerOfferStatus.EXPIRED
        offer.responded_at = now
    db.flush()
    for affected_order_id in affected_order_ids:
        order = db.query(Order).filter(Order.id == affected_order_id).first()
        pending = db.query(RetailerOrderOffer.id).filter(
            RetailerOrderOffer.order_id == affected_order_id,
            RetailerOrderOffer.status == RetailerOfferStatus.PENDING,
        ).first()
        if order and order.status == ModelOrderStatus.RECEIVED and order.store_id is None and not pending:
            order.status = ModelOrderStatus.REJECTED
    db.commit()


def accept_retailer_offer(db: Session, order_id: int, store_id: int, actor_user_id: int) -> Order:
    """Atomically claim an order and commit only the winning store's stock."""
    try:
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        if order.store_id == store_id and order.status in {
            ModelOrderStatus.ACCEPTED,
            ModelOrderStatus.PREPARING,
            ModelOrderStatus.READY_FOR_PICKUP,
            ModelOrderStatus.OUT_FOR_DELIVERY,
            ModelOrderStatus.DELIVERED,
        }:
            return order
        if order.store_id is not None or order.status != ModelOrderStatus.RECEIVED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order opportunity is no longer available")

        offer = db.query(RetailerOrderOffer).filter(
            RetailerOrderOffer.order_id == order_id,
            RetailerOrderOffer.store_id == store_id,
        ).with_for_update().first()
        if not offer or offer.status != RetailerOfferStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Retailer offer is no longer available")
        now = datetime.utcnow()
        if offer.expires_at <= now:
            offer.status = RetailerOfferStatus.EXPIRED
            offer.responded_at = now
            db.commit()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Retailer offer has expired")

        inventory_ids = [item.inventory_id for item in offer.items]
        locked_inventory = {
            row.id: row
            for row in db.query(Inventory).filter(Inventory.id.in_(inventory_ids)).with_for_update().all()
        }
        if len(locked_inventory) != len(inventory_ids):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Offer inventory is no longer available")

        for offer_item in offer.items:
            inventory = locked_inventory[offer_item.inventory_id]
            if (
                inventory.store_id != store_id
                or inventory.product_id != offer_item.product_id
                or not inventory.is_available
                or inventory.quantity < offer_item.quantity
            ):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store no longer has sufficient inventory")

        for offer_item in offer.items:
            inventory = locked_inventory[offer_item.inventory_id]
            inventory.quantity -= offer_item.quantity
            db.add(InventoryAdjustment(
                inventory_id=inventory.id,
                store_id=store_id,
                product_id=inventory.product_id,
                delta=-offer_item.quantity,
                quantity_after=inventory.quantity,
                source="ORDER",
                actor_user_id=actor_user_id,
                note=f"Order #{order.id} retailer acceptance",
            ))
            offer_item.order_item.product_id = offer_item.product_id
            offer_item.order_item.product_name = offer_item.product.name

        order.store_id = store_id
        order.status = ModelOrderStatus.ACCEPTED
        offer.status = RetailerOfferStatus.ACCEPTED
        offer.responded_at = now
        db.query(RetailerOrderOffer).filter(
            RetailerOrderOffer.order_id == order.id,
            RetailerOrderOffer.id != offer.id,
            RetailerOrderOffer.status == RetailerOfferStatus.PENDING,
        ).update(
            {RetailerOrderOffer.status: RetailerOfferStatus.LOST, RetailerOrderOffer.responded_at: now},
            synchronize_session=False,
        )
        db.commit()
        db.refresh(order)
        return order
    except HTTPException:
        if db.in_transaction():
            db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def reject_retailer_offer(db: Session, order_id: int, store_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.store_id is not None or order.status != ModelOrderStatus.RECEIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order opportunity is no longer available")
    offer = db.query(RetailerOrderOffer).filter(
        RetailerOrderOffer.order_id == order_id,
        RetailerOrderOffer.store_id == store_id,
    ).with_for_update().first()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer offer not found")
    if offer.status == RetailerOfferStatus.REJECTED:
        return order
    if offer.status != RetailerOfferStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Retailer offer is no longer available")
    offer.status = RetailerOfferStatus.REJECTED
    offer.responded_at = datetime.utcnow()
    db.flush()
    pending = db.query(RetailerOrderOffer.id).filter(
        RetailerOrderOffer.order_id == order_id,
        RetailerOrderOffer.status == RetailerOfferStatus.PENDING,
    ).first()
    if not pending:
        order.status = ModelOrderStatus.REJECTED
    db.commit()
    db.refresh(order)
    return order
