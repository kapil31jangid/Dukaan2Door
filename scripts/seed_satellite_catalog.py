#!/usr/bin/env python3
"""Copy a controlled active catalog into the named Satellite demo stores.

Only existing active product names, prices, descriptions, categories, images,
and positive inventory quantities are reused. No synthetic product or quantity
is generated. Existing products, inventory, orders, and deliveries are not
deleted or modified.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.core.config import settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.inventory import Inventory  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.store import Store  # noqa: E402


TARGET_STORE_NAMES = {"Rahul Satellite Kirana", "Neha Satellite Daily Needs"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-remote", action="store_true", help="Allow writes to a non-SQLite database")
    parser.add_argument("--limit", type=int, default=30, help="Maximum existing catalog items copied per store")
    return parser.parse_args()


def seed(db, limit: int) -> tuple[int, int]:
    stores = db.query(Store).filter(Store.store_name.in_(TARGET_STORE_NAMES)).all()
    if not stores:
        raise RuntimeError("Satellite stores were not found. Run seed_dashboard_accounts.py first.")

    source_rows = (
        db.query(Product, Inventory)
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(
            Product.is_active.is_(True),
            Inventory.quantity > 0,
            Inventory.is_available.is_(True),
            Inventory.store_id == Product.store_id,
            ~Product.store_id.in_([store.id for store in stores]),
        )
        .order_by(Product.id)
        .all()
    )
    source_by_product = {}
    for source_product, source_inventory in source_rows:
        source_by_product.setdefault(source_product.id, (source_product, source_inventory))
    source_rows = list(source_by_product.values())[:limit]
    if not source_rows:
        raise RuntimeError("No existing active, in-stock catalog rows are available to reuse.")

    products_added = 0
    inventory_added = 0
    for store in stores:
        for source_product, source_inventory in source_rows:
            existing = (
                db.query(Product)
                .filter(Product.store_id == store.id, Product.name == source_product.name)
                .first()
            )
            if existing:
                product = existing
            else:
                product = Product(
                    store_id=store.id,
                    name=source_product.name,
                    description=source_product.description,
                    category=source_product.category,
                    price=source_product.price,
                    image_url=source_product.image_url,
                    is_active=True,
                )
                db.add(product)
                db.flush()
                products_added += 1

            inventory = (
                db.query(Inventory)
                .filter(Inventory.store_id == store.id, Inventory.product_id == product.id)
                .first()
            )
            if inventory is None:
                inventory = Inventory(
                    store_id=store.id,
                    product_id=product.id,
                    quantity=source_inventory.quantity,
                    is_available=True,
                )
                db.add(inventory)
                inventory_added += 1

    db.commit()
    return products_added, inventory_added


def main() -> int:
    args = parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be positive")
    if not args.allow_remote and not settings.DATABASE_URL.startswith("sqlite"):
        print("Refusing non-SQLite writes. Re-run with --allow-remote for the intentional demo setup.", file=sys.stderr)
        return 2
    db = SessionLocal()
    try:
        products_added, inventory_added = seed(db, args.limit)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print(f"Satellite catalog ready: products_added={products_added}, inventory_added={inventory_added}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
