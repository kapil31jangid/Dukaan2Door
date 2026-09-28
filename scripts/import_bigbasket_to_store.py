#!/usr/bin/env python3
"""Replace BlinkIT products with BigBasket products in the operational store catalog.

BigBasket dataset has real product names, brands, categories, sub-categories and prices.
This script:
  1. Removes all BlinkIT-derived products from the operational store (products + inventory).
  2. Promotes BigBasket source_products into products + inventory for the same store.

Mapping:
  source product_name          -> products.name
  source category              -> products.category
  source subcategory           -> products.description (sub-category tag line)
  source brand                 -> products.description (brand included)
  source price (DiscountPrice) -> products.price
  source mrp  (Price)          -> products.description (MRP shown)
  source unit (Quantity)       -> products.description (pack size)

Performance: uses bulk SQL INSERT...SELECT — no per-row ORM flush round-trips.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.db.session import SessionLocal  # noqa: E402
from app.models.inventory import Inventory  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.retailer import Retailer  # noqa: E402
from app.models.store import Store  # noqa: E402
from app.models.user import User  # noqa: E402


def find_target_store(
    db,
    store_id: Optional[int] = None,
    retailer_email: Optional[str] = "demo.retailer.central@example.com",
) -> Store:
    if store_id:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise ValueError(f"Store ID {store_id} not found")
        return store

    if retailer_email:
        user = db.query(User).filter(User.email == retailer_email).first()
        if user:
            retailer = db.query(Retailer).filter(Retailer.user_id == user.id).first()
            if retailer:
                store = db.query(Store).filter(Store.retailer_id == retailer.id).first()
                if store:
                    return store

    store = db.query(Store).filter(Store.store_name == "Demo Central Mart").first()
    if not store:
        store = db.query(Store).first()
    if not store:
        raise ValueError("No operational store found in database")
    return store


def import_bigbasket_products(
    db,
    store_id: Optional[int] = None,
    retailer_email: Optional[str] = "demo.retailer.central@example.com",
    default_stock: int = 30,
) -> dict[str, int]:
    store = find_target_store(db, store_id=store_id, retailer_email=retailer_email)
    retailer = store.retailer
    user = db.query(User).filter(User.id == retailer.user_id).first() if retailer else None

    print("==================================================")
    print("REPLACING BLINKIT -> BIGBASKET IN OPERATIONAL STORE")
    print(f"Target Store ID:    {store.id}")
    print(f"Store Name:         {store.store_name}")
    print(f"Retailer Email:     {user.email if user else 'N/A'}")
    print("==================================================")

    # ------------------------------------------------------------------
    # Step 1: Remove any remaining BlinkIT-derived products + inventory
    # ------------------------------------------------------------------
    print("\n[1/4] Removing any remaining BlinkIT-derived products...")
    inv_del = db.execute(text("""
        DELETE FROM inventory
        WHERE store_id = :store_id
          AND product_id IN (
              SELECT id FROM products
              WHERE store_id = :store_id AND description LIKE '%BlinkIT%'
          )
    """), {"store_id": store.id})
    prod_del = db.execute(text("""
        DELETE FROM products
        WHERE store_id = :store_id AND description LIKE '%BlinkIT%'
    """), {"store_id": store.id})
    print(f"  Removed {prod_del.rowcount} BlinkIT products + {inv_del.rowcount} inventory rows")
    db.commit()

    # ------------------------------------------------------------------
    # Step 2: Bulk INSERT BigBasket products via SQL INSERT...SELECT
    #         DISTINCT ON (product_name) deduplicates within the source
    # ------------------------------------------------------------------
    print("\n[2/4] Bulk inserting BigBasket products (SQL INSERT...SELECT)...")
    insert_products = db.execute(text("""
        INSERT INTO products (store_id, name, description, category, price, image_url, is_active, created_at, updated_at)
        SELECT DISTINCT ON (sp.product_name)
            :store_id,
            sp.product_name,
            CONCAT_WS(' | ',
                CASE WHEN sp.brand IS NOT NULL THEN 'Brand: ' || sp.brand ELSE NULL END,
                CASE WHEN sp.subcategory IS NOT NULL THEN 'Sub-category: ' || sp.subcategory ELSE NULL END,
                CASE WHEN sp.unit IS NOT NULL THEN 'Pack: ' || sp.unit ELSE NULL END,
                CASE WHEN sp.mrp IS NOT NULL AND sp.price IS NOT NULL AND sp.mrp != sp.price
                     THEN 'MRP: Rs.' || ROUND(sp.mrp::numeric, 2)::text ELSE NULL END,
                '[BigBasket source: ' || sp.source_product_id || ']'
            ),
            COALESCE(sp.category, 'General'),
            COALESCE(ROUND(sp.price::numeric, 2), 0.00),
            sp.raw_data->>'Image_Url',
            true,
            NOW(),
            NOW()
        FROM source_products sp
        WHERE sp.source_platform = 'bigbasket'
          AND sp.product_name IS NOT NULL
          AND sp.product_name != ''
          AND NOT EXISTS (
              SELECT 1 FROM products p
              WHERE p.store_id = :store_id AND p.name = sp.product_name
          )
        ORDER BY sp.product_name, sp.id
    """), {"store_id": store.id})
    created_count = insert_products.rowcount
    db.commit()
    print(f"  Inserted {created_count} BigBasket products")

    # ------------------------------------------------------------------
    # Step 3: Bulk INSERT inventory for all new BigBasket products
    # ------------------------------------------------------------------
    print("\n[3/4] Syncing inventory for BigBasket products...")
    insert_inventory = db.execute(text("""
        INSERT INTO inventory (store_id, product_id, quantity, is_available, created_at, updated_at)
        SELECT
            p.store_id,
            p.id,
            :default_stock,
            true,
            NOW(),
            NOW()
        FROM products p
        WHERE p.store_id = :store_id
          AND p.description LIKE '%[BigBasket source%'
          AND NOT EXISTS (
              SELECT 1 FROM inventory inv
              WHERE inv.store_id = :store_id AND inv.product_id = p.id
          )
    """), {"store_id": store.id, "default_stock": default_stock})
    db.commit()
    print(f"  Synced {insert_inventory.rowcount} inventory rows")

    # ------------------------------------------------------------------
    # Step 4: Summary
    # ------------------------------------------------------------------
    print("\n[4/4] Final store catalog summary...")
    total_products = db.query(Product).filter(Product.store_id == store.id).count()
    total_bb = db.query(Product).filter(
        Product.store_id == store.id,
        Product.description.like("%[BigBasket source%"),
    ).count()
    total_inventory = db.query(Inventory).filter(Inventory.store_id == store.id).count()

    stats = {
        "products_created": created_count,
        "total_products_in_store": total_products,
        "total_bigbasket_in_store": total_bb,
        "total_inventory_rows": total_inventory,
        "store_id": store.id,
        "store_name": store.store_name,
    }

    print(f"  Total products in store:         {stats['total_products_in_store']}")
    print(f"  BigBasket products:              {stats['total_bigbasket_in_store']}")
    print(f"  Inventory rows:                  {stats['total_inventory_rows']}")
    print("==================================================")
    print("SUCCESS: Store catalog now powered by BigBasket real product data!")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replace BlinkIT products with BigBasket products in the operational store"
    )
    parser.add_argument("--store-id", type=int, default=None, help="Target store ID")
    parser.add_argument(
        "--retailer-email",
        type=str,
        default="demo.retailer.central@example.com",
        help="Retailer email owning target store",
    )
    parser.add_argument("--stock", type=int, default=30, help="Default initial inventory quantity")
    args = parser.parse_args()

    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL environment variable is required")

    db = SessionLocal()
    try:
        import_bigbasket_products(
            db,
            store_id=args.store_id,
            retailer_email=args.retailer_email,
            default_stock=args.stock,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
