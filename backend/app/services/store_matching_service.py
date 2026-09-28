from dataclasses import dataclass
from typing import Iterable, List, Optional
from sqlalchemy import or_
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

    # 1. Fetch details of requested products
    catalog_products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    if not catalog_products:
        return StoreMatchResult(matched=False, reason="Requested products not found in catalog")

    product_names = {p.id: p.name.strip().lower() for p in catalog_products}
    req_names_list = list(product_names.values())

    # 2. Fetch all open stores with valid coordinates
    open_stores = (
        db.query(Store)
        .filter(
            Store.is_open.is_(True),
            Store.lat.isnot(None),
            Store.lng.isnot(None),
        )
        .all()
    )

    if not open_stores:
        return StoreMatchResult(matched=False, reason="No open stores available")

    # 3. Calculate distances and filter stores within 5 km
    nearby_stores: list[tuple[float, Store]] = []
    for store in open_stores:
        if store.lat is None or store.lng is None or not has_valid_coordinates(store.lat, store.lng):
            continue
        dist = calculate_distance_km(customer_lat, customer_lng, float(store.lat), float(store.lng))
        if dist <= 5.0:
            nearby_stores.append((dist, store))

    if not nearby_stores:
        return StoreMatchResult(matched=False, search_radius_km=5, reason="No eligible store within 5 km")

    # Sort by nearest store first
    nearby_stores.sort(key=lambda x: x[0])
    nearby_store_ids = [s.id for _, s in nearby_stores]

    # 4. Fetch inventory for requested product IDs / names across nearby stores in 1 fast query
    inventory_rows = (
        db.query(Inventory, Product)
        .join(Product, Product.id == Inventory.product_id)
        .filter(
            Inventory.store_id.in_(nearby_store_ids),
            # Never use a product from one store with inventory belonging to
            # another store. Legacy rows can otherwise make a nearby store
            # appear eligible and fail during the order's final stock lock.
            Product.store_id == Inventory.store_id,
            Inventory.is_available.is_(True),
            Inventory.quantity >= 1,
            Product.is_active.is_(True),
            or_(
                Product.id.in_(product_ids),
                Product.name.in_([p.name for p in catalog_products])
            ),
        )
        .all()
    )

    # Group by store_id -> {prod_id: qty, prod_name: qty}
    stock_by_store: dict[int, dict] = {}
    for inv, prod in inventory_rows:
        store_stock = stock_by_store.setdefault(inv.store_id, {"by_id": {}, "by_name": {}})
        store_stock["by_id"][prod.id] = inv.quantity
        store_stock["by_name"][prod.name.strip().lower()] = inv.quantity

    eligible_matches: list[tuple[float, Store]] = []
    for distance, store in nearby_stores:
        store_stock = stock_by_store.get(store.id, {"by_id": {}, "by_name": {}})
        can_fulfill_all = True
        
        for req_id, req_qty in required_by_product.items():
            req_name = product_names.get(req_id, "")
            avail = store_stock["by_id"].get(req_id, 0)
            if avail < req_qty:
                avail = store_stock["by_name"].get(req_name, 0)

            if avail < req_qty:
                can_fulfill_all = False
                break

        if can_fulfill_all:
            eligible_matches.append((distance, store))

    within_2km = [m for m in eligible_matches if m[0] <= 2.0]
    if within_2km:
        dist, store = within_2km[0]
        return StoreMatchResult(
            matched=True,
            store_id=store.id,
            search_radius_km=2,
            distance_km=round(dist, 3),
        )

    within_5km = [m for m in eligible_matches if m[0] <= 5.0]
    if within_5km:
        dist, store = within_5km[0]
        return StoreMatchResult(
            matched=True,
            store_id=store.id,
            search_radius_km=5,
            distance_km=round(dist, 3),
            reason="No eligible store within 2 km",
        )

    return StoreMatchResult(matched=False, search_radius_km=5, reason="No eligible store within 5 km")
