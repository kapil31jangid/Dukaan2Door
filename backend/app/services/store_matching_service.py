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
class MatchedStoreItem:
    requested_product_id: int
    product_id: int
    inventory_id: int
    quantity: int


@dataclass(frozen=True)
class EligibleStoreMatch:
    store_id: int
    search_radius_km: int
    distance_km: float
    items: tuple[MatchedStoreItem, ...]


@dataclass(frozen=True)
class StoreMatchResult:
    matched: bool
    store_id: Optional[int] = None
    search_radius_km: Optional[int] = None
    distance_km: Optional[float] = None
    reason: Optional[str] = None


def _normalize_items(items: Iterable[RequestedItem]) -> List[RequestedItem]:
    requested: dict[int, int] = {}
    for item in items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity
    return [RequestedItem(product_id=product_id, quantity=quantity) for product_id, quantity in requested.items()]


def _identity(product: Product) -> tuple[str, str, str]:
    return (
        product.name.strip().casefold(),
        (product.brand or "").strip().casefold(),
        (product.handling_type or "NORMAL").strip().upper(),
    )


def find_eligible_stores(
    db: Session,
    customer_lat: float,
    customer_lng: float,
    items: Iterable[RequestedItem],
) -> list[EligibleStoreMatch]:
    """Find all stores in the active 2 km tier, falling back to the 5 km tier."""
    validate_coordinates(customer_lat, customer_lng)
    requested_items = _normalize_items(items)
    if not requested_items or any(item.quantity <= 0 for item in requested_items):
        return []

    requested_products = {
        product.id: product
        for product in db.query(Product).filter(
            Product.id.in_([item.product_id for item in requested_items]),
            Product.is_active.is_(True),
        ).all()
    }
    if len(requested_products) != len(requested_items):
        return []

    nearby: list[tuple[float, Store]] = []
    for store in db.query(Store).filter(
        Store.is_open.is_(True),
        Store.lat.isnot(None),
        Store.lng.isnot(None),
    ).all():
        if not has_valid_coordinates(store.lat, store.lng):
            continue
        distance = calculate_distance_km(customer_lat, customer_lng, float(store.lat), float(store.lng))
        if distance <= 5:
            nearby.append((distance, store))
    nearby.sort(key=lambda candidate: (candidate[0], candidate[1].id))
    if not nearby:
        return []

    store_ids = [store.id for _, store in nearby]
    rows = db.query(Inventory, Product).join(
        Product, Product.id == Inventory.product_id
    ).filter(
        Inventory.store_id.in_(store_ids),
        Product.store_id == Inventory.store_id,
        Inventory.is_available.is_(True),
        Product.is_active.is_(True),
    ).all()
    stock_by_store: dict[int, dict[tuple[str, str, str], list[tuple[Inventory, Product]]]] = {}
    for inventory, product in rows:
        stock_by_store.setdefault(inventory.store_id, {}).setdefault(_identity(product), []).append((inventory, product))

    matches: list[tuple[float, Store, tuple[MatchedStoreItem, ...]]] = []
    for distance, store in nearby:
        matched_items: list[MatchedStoreItem] = []
        store_stock = stock_by_store.get(store.id, {})
        for requested in requested_items:
            source_product = requested_products[requested.product_id]
            candidates = store_stock.get(_identity(source_product), [])
            exact = [row for row in candidates if row[1].id == requested.product_id]
            candidate_rows = sorted(exact or candidates, key=lambda row: row[1].id)
            selected = next((row for row in candidate_rows if row[0].quantity >= requested.quantity), None)
            if selected is None:
                matched_items = []
                break
            inventory, product = selected
            matched_items.append(MatchedStoreItem(
                requested_product_id=requested.product_id,
                product_id=product.id,
                inventory_id=inventory.id,
                quantity=requested.quantity,
            ))
        if matched_items:
            matches.append((distance, store, tuple(matched_items)))

    active_radius = 2 if any(distance <= 2 for distance, _, _ in matches) else 5
    return [
        EligibleStoreMatch(
            store_id=store.id,
            search_radius_km=active_radius,
            distance_km=round(distance, 3),
            items=matched_items,
        )
        for distance, store, matched_items in matches
        if distance <= active_radius
    ]


def find_matching_store(
    db: Session,
    customer_lat: float,
    customer_lng: float,
    items: Iterable[RequestedItem],
) -> StoreMatchResult:
    matches = find_eligible_stores(db, customer_lat, customer_lng, items)
    if matches:
        first = matches[0]
        return StoreMatchResult(
            matched=True,
            store_id=first.store_id,
            search_radius_km=first.search_radius_km,
            distance_km=first.distance_km,
            reason="No eligible store within 2 km" if first.search_radius_km == 5 else None,
        )
    return StoreMatchResult(matched=False, search_radius_km=5, reason="No eligible store within 5 km")
