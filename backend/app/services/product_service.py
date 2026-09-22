from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.store import Store


def check_availability(db: Any, store_id: int, items: List[Dict[str, int]]) -> bool:
    """
    Service function exported for Kapil's store matching algorithm.
    Checks if a given store has sufficient available stock for all requested items.
    
    :param db: SQLAlchemy Session (or None in foundation mode)
    :param store_id: Target store ID
    :param items: List of dicts with keys 'product_id' and 'quantity'
    :return: True if all items are available in required quantities, False otherwise.
    """
    if db is None:
        return True
    for item in items:
        inventory = (
            db.query(Inventory)
            .join(Product)
            .filter(
                Inventory.store_id == store_id,
                Inventory.product_id == item["product_id"],
                Inventory.is_available.is_(True),
                Product.is_active.is_(True),
            )
            .first()
        )
        if not inventory or inventory.quantity < item["quantity"]:
            return False
    return True


def get_store_for_retailer_user(db: Session, user_id: int) -> Optional[Store]:
    return db.query(Store).join(Store.retailer).filter_by(user_id=user_id).first()


def product_to_response(product: Product):
    inventory = product.inventory
    return {
        "id": product.id,
        "store_id": product.store_id,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "price": product.price,
        "is_active": product.is_active,
        "quantity": inventory.quantity if inventory else 0,
        "is_available": inventory.is_available if inventory else False,
    }
