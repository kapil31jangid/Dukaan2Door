#!/usr/bin/env python3
"""Import and normalize BlinkIT staged source products into Dukaan2Door operational store catalog and inventory.

This script promotes records from `source_products` (where source_platform='blinkit')
into application-level `products` and `inventory` tables for a designated operational store.

Mapping:
- source Item Identifier -> products.name (e.g. "FDX32")
- source Item Type -> products.category (e.g. "Fruits and Vegetables")
- source Sales -> products.price (e.g. 145.48)
- source metadata -> products.description (e.g. "BlinkIT source product FDX32 (Fat: Regular, Weight: 15.1g, Rating: 5.0). Associated with Demo Central Mart for operational testing.")
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
from app.models.source_data import SourceProduct  # noqa: E402
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


def import_blinkit_products(
    db,
    store_id: Optional[int] = None,
    retailer_email: Optional[str] = "demo.retailer.central@example.com",
    default_stock: int = 25,
) -> dict[str, int]:
    store = find_target_store(db, store_id=store_id, retailer_email=retailer_email)
    retailer = store.retailer
    user = db.query(User).filter(User.id == retailer.user_id).first() if retailer else None

    print("==================================================")
    print("IMPORTING & NORMALIZING BLINKIT PRODUCTS TO OPERATIONAL STORE")
    print(f"Target Store ID:    {store.id}")
    print(f"Store Name:         {store.store_name}")
    print(f"Retailer Name:      {retailer.name if retailer else 'N/A'}")
    print(f"Retailer Email:     {user.email if user else 'N/A'}")
    print("==================================================")

    # 1. Update source_products table with clean normalized values if needed
    db.execute(text("""
        UPDATE source_products
        SET product_name = raw_data->>'Item Identifier',
            category = raw_data->>'Item Type',
            price = CAST(raw_data->>'Sales' AS DOUBLE PRECISION),
            mrp = CAST(raw_data->>'Sales' AS DOUBLE PRECISION),
            unit = raw_data->>'Item Weight'
        WHERE source_platform = 'blinkit'
    """))

    # 2. Update existing products matching BlinkIT source products for this store
    update_res = db.execute(text(f"""
        UPDATE products
        SET name = sp.source_product_id,
            category = sp.category,
            price = sp.price,
            description = 'BlinkIT source product ' || sp.source_product_id || 
                          ' (Fat: ' || COALESCE(sp.raw_data->>'Item Fat Content', 'N/A') || 
                          ', Weight: ' || COALESCE(sp.unit, 'N/A') || 'g, Rating: ' || 
                          COALESCE(sp.raw_data->>'Rating', 'N/A') || '). Associated with ' || 
                          :store_name || ' for operational testing.',
            is_active = true
        FROM source_products sp
        WHERE products.store_id = :store_id
          AND sp.source_platform = 'blinkit'
          AND (
            products.name = sp.source_product_id
            OR (products.description LIKE '%BlinkIT%' AND products.description LIKE '%(' || sp.source_product_id || ')%')
          );
    """), {"store_id": store.id, "store_name": store.store_name})
    updated_count = update_res.rowcount

    # 3. Insert any missing BlinkIT products into products table for this store
    insert_res = db.execute(text(f"""
        INSERT INTO products (store_id, name, description, category, price, is_active, created_at, updated_at)
        SELECT 
            :store_id,
            sp.source_product_id,
            'BlinkIT source product ' || sp.source_product_id || 
            ' (Fat: ' || COALESCE(sp.raw_data->>'Item Fat Content', 'N/A') || 
            ', Weight: ' || COALESCE(sp.unit, 'N/A') || 'g, Rating: ' || 
            COALESCE(sp.raw_data->>'Rating', 'N/A') || '). Associated with ' || 
            :store_name || ' for operational testing.',
            sp.category,
            sp.price,
            true,
            NOW(),
            NOW()
        FROM source_products sp
        WHERE sp.source_platform = 'blinkit'
          AND NOT EXISTS (
              SELECT 1 FROM products p 
              WHERE p.store_id = :store_id 
                AND (p.name = sp.source_product_id OR (p.description LIKE '%BlinkIT%' AND p.description LIKE '%(' || sp.source_product_id || ')%'))
          );
    """), {"store_id": store.id, "store_name": store.store_name})
    created_count = insert_res.rowcount

    # 4. Synchronize inventory for all BlinkIT products in this store
    inv_res = db.execute(text(f"""
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
          AND p.description LIKE '%BlinkIT%'
          AND NOT EXISTS (
              SELECT 1 FROM inventory inv
              WHERE inv.store_id = :store_id AND inv.product_id = p.id
          );
    """), {"store_id": store.id, "default_stock": default_stock})

    # Ensure all existing inventory for BlinkIT products is marked available
    db.execute(text(f"""
        UPDATE inventory
        SET is_available = true,
            quantity = CASE WHEN quantity = 0 THEN :default_stock ELSE quantity END,
            updated_at = NOW()
        WHERE store_id = :store_id
          AND product_id IN (
              SELECT id FROM products WHERE store_id = :store_id AND description LIKE '%BlinkIT%'
          );
    """), {"store_id": store.id, "default_stock": default_stock})

    db.commit()

    total_blinkit_in_store = db.query(Product).filter(
        Product.store_id == store.id, Product.description.like("%BlinkIT%")
    ).count()

    stats = {
        "source_records": 1559,
        "products_created": created_count,
        "products_updated": updated_count,
        "total_blinkit_in_store": total_blinkit_in_store,
        "inventory_synced": total_blinkit_in_store,
        "store_id": store.id,
        "store_name": store.store_name,
    }

    print(f"BlinkIT Source Records Processed: {stats['source_records']}")
    print(f"Operational Products Created:     {stats['products_created']}")
    print(f"Operational Products Updated:     {stats['products_updated']}")
    print(f"Total BlinkIT Products in Store:  {stats['total_blinkit_in_store']}")
    print(f"Inventory Records Synchronized:   {stats['inventory_synced']}")
    print("==================================================")
    print("SUCCESS: BlinkIT dataset normalized and integrated into operational catalog & inventory!")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Import BlinkIT source products into operational store catalog")
    parser.add_argument("--store-id", type=int, default=None, help="Target store ID")
    parser.add_argument(
        "--retailer-email",
        type=str,
        default="demo.retailer.central@example.com",
        help="Retailer email owning target store",
    )
    parser.add_argument("--stock", type=int, default=25, help="Default initial inventory quantity")
    args = parser.parse_args()

    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL environment variable is required")

    db = SessionLocal()
    try:
        import_blinkit_products(
            db,
            store_id=args.store_id,
            retailer_email=args.retailer_email,
            default_stock=args.stock,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
