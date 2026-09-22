from dataclasses import dataclass
from typing import Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.product import Product
from app.models.store import Store
from app.services.geo_service import calculate_distance_km, has_valid_coordinates, validate_coordinates


@dataclass(frozen=True)
class RequestedItem:
    product_id: int
    quantity: int


@dataclass(frozen=True)
class StoreMatchResult:
    matched: bool
    store_id: Optional[int] = None
    search_radius_km: Optional[int] = None
    distance_km: Optional[float] = None
    reason: Optional[str] = None


def _normalize_items(items: Iterable[RequestedItem]) -> List[RequestedItem]:
    normalized = [RequestedItem(product_id=item.product_id, quantity=item.quantity) for item in items]
    if not normalized:
        return []
    requested: dict[int, int] = {}
    for item in normalized:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity
    return [RequestedItem(product_id=product_id, quantity=quantity) for product_id, quantity in requested.items()]


def find_matching_store(
    db: Session,
    customer_lat: float,
    customer_lng: float,
    items: Iterable[RequestedItem],
) -> StoreMatchResult:
    validate_coordinates(customer_lat, customer_lng)
    requested_items = _normalize_items(items)
    if not requested_items:
        return StoreMatchResult(matched=False, reason="No order items supplied")

    product_ids = [item.product_id for item in requested_items]
    required_by_product = {item.product_id: item.quantity for item in requested_items}

    rows = (
        db.query(Store, Inventory, Product)
        .join(Inventory, Inventory.store_id == Store.id)
        .join(Product, Product.id == Inventory.product_id)
        .filter(
            Store.is_open.is_(True),
        Store.lat.isnot(None),
        Store.lng.isnot(None),
            Product.id.in_(product_ids),
            Product.is_active.is_(True),
            Product.store_id == Store.id,
            Inventory.is_available.is_(True),
            Inventory.quantity >= 1,
        )
        .all()
    )

    inventory_by_store: dict[int, dict[int, Inventory]] = {}
    stores: dict[int, Store] = {}
    for store, inventory, product in rows:
        stores[store.id] = store
        if inventory.quantity >= required_by_product.get(product.id, 0):
            inventory_by_store.setdefault(store.id, {})[product.id] = inventory

    eligible: list[tuple[float, int]] = []
    for store_id, inventory_by_product in inventory_by_store.items():
        if not all(product_id in inventory_by_product for product_id in product_ids):
            continue
        store = stores[store_id]
        if not has_valid_coordinates(store.lat, store.lng):
            continue
        distance = calculate_distance_km(customer_lat, customer_lng, store.lat, store.lng)
        eligible.append((distance, store_id))

    within_2km = sorted((distance, store_id) for distance, store_id in eligible if distance <= 2)
    if within_2km:
        distance, store_id = within_2km[0]
        return StoreMatchResult(True, store_id=store_id, search_radius_km=2, distance_km=round(distance, 3))

    within_5km = sorted((distance, store_id) for distance, store_id in eligible if distance <= 5)
    if within_5km:
        distance, store_id = within_5km[0]
        return StoreMatchResult(
            True,
            store_id=store_id,
            search_radius_km=5,
            distance_km=round(distance, 3),
            reason="No eligible store within 2 km",
        )

    return StoreMatchResult(False, search_radius_km=5, reason="No eligible store within 5 km")
