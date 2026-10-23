#!/usr/bin/env python3
"""Add a clean 50-product presentation catalogue to the Satellite demo stores."""

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


SATELLITE_STORES = {
    "Rahul Satellite Kirana",
    "Neha Satellite Daily Needs",
    "Priya Satellite Fresh Mart",
}

# The six core essentials shown in the customer storefront plus these 44 items
# make the same 50-product catalogue available at every Satellite demo store.
CORE_PRESENTATION_PRODUCTS = [
    ("Basmati Rice 1kg", "Staples", 125.0, 100, "catalog-basmati-rice-1kg.webp"),
    ("Toned Milk 1L", "Dairy", 62.0, 100, "catalog-toned-milk-1l.webp"),
    ("Wheat Bread", "Bakery", 45.0, 100, "catalog-wheat-bread.webp"),
    ("Sunflower Oil 1L", "Staples", 155.0, 100, "catalog-sunflower-oil-1l.webp"),
    ("Salt 1kg", "Staples", 28.0, 100, "catalog-salt-1kg.webp"),
    ("Bananas 1 Dozen", "Fresh Produce", 70.0, 100, "catalog-bananas-dozen.webp"),
]

PRESENTATION_PRODUCTS = [
    ("Basmati Rice 5kg", "Staples", 590.0, 36, "catalog-basmati-rice-5kg.webp"),
    ("Sona Masoori Rice 5kg", "Staples", 420.0, 40, "catalog-sona-masoori-rice-5kg.webp"),
    ("Whole Wheat Flour 5kg", "Staples", 275.0, 35, "catalog-whole-wheat-flour-5kg.webp"),
    ("Toor Dal 1kg", "Staples", 185.0, 32, "catalog-toor-dal-1kg.webp"),
    ("Moong Dal 1kg", "Staples", 170.0, 28, "catalog-moong-dal-1kg.webp"),
    ("Chana Dal 1kg", "Staples", 115.0, 34, "catalog-chana-dal-1kg.webp"),
    ("Poha 1kg", "Staples", 78.0, 30, "catalog-poha-1kg.webp"),
    ("Sugar 1kg", "Staples", 52.0, 45, "catalog-sugar-1kg.webp"),
    ("Besan 500g", "Staples", 68.0, 26, "catalog-besan-500g.webp"),
    ("Rava 1kg", "Staples", 62.0, 28, "catalog-rava-1kg.webp"),
    ("Turmeric Powder 200g", "Staples", 52.0, 30, "catalog-turmeric-powder-200g.webp"),
    ("Curd 400g", "Dairy", 45.0, 30, "catalog-curd-400g.webp"),
    ("Paneer 200g", "Dairy", 95.0, 24, "catalog-paneer-200g.webp"),
    ("Butter 100g", "Dairy", 58.0, 24, "catalog-butter-100g.webp"),
    ("Cheese Slices 200g", "Dairy", 140.0, 18, "catalog-cheese-slices-200g.webp"),
    ("Lassi 200ml", "Dairy", 30.0, 28, "catalog-lassi-200ml.webp"),
    ("Multigrain Bread", "Bakery", 55.0, 22, "catalog-multigrain-bread.webp"),
    ("Burger Buns Pack", "Bakery", 45.0, 20, "catalog-burger-buns-pack.webp"),
    ("Rusk 300g", "Bakery", 62.0, 20, "catalog-rusk-300g.webp"),
    ("Apples 1kg", "Fresh Produce", 180.0, 24, "catalog-apples-1kg.webp"),
    ("Leaf Tea 250g", "Beverages", 135.0, 25, "catalog-leaf-tea-250g.webp"),
    ("Instant Coffee 100g", "Beverages", 185.0, 20, "catalog-instant-coffee-100g.webp"),
    ("Green Tea 25 Bags", "Beverages", 155.0, 18, "catalog-green-tea-25-bags.webp"),
    ("Fruit Juice 1L", "Beverages", 110.0, 22, "catalog-fruit-juice-1l.webp"),
    ("Marie Biscuits 250g", "Snacks", 38.0, 32, "catalog-marie-biscuits-250g.webp"),
    ("Digestive Biscuits 400g", "Snacks", 75.0, 26, "catalog-digestive-biscuits-400g.webp"),
    ("Potato Chips 100g", "Snacks", 30.0, 34, "catalog-potato-chips-100g.webp"),
    ("Namkeen Mixture 250g", "Snacks", 65.0, 26, "catalog-namkeen-mixture-250g.webp"),
    ("Roasted Chana 200g", "Snacks", 45.0, 28, "catalog-roasted-chana-200g.webp"),
    ("Dark Chocolate 50g", "Snacks", 50.0, 25, "catalog-dark-chocolate-50g.webp"),
    ("Detergent Powder 1kg", "Household", 125.0, 25, "catalog-detergent-powder-1kg.webp"),
    ("Dishwash Bar 200g", "Household", 30.0, 30, "catalog-dishwash-bar-200g.webp"),
    ("Floor Cleaner 1L", "Household", 115.0, 20, "catalog-floor-cleaner-1l.webp"),
    ("Garbage Bags 30 Pack", "Household", 90.0, 18, "catalog-garbage-bags-30-pack.webp"),
    ("Kitchen Towel Roll", "Household", 75.0, 20, "catalog-kitchen-towel-roll.webp"),
    ("Bath Soap Pack", "Personal Care", 110.0, 28, "catalog-bath-soap-pack.webp"),
    ("Shampoo 180ml", "Personal Care", 145.0, 22, "catalog-shampoo-180ml.webp"),
    ("Toothpaste 100g", "Personal Care", 90.0, 26, "catalog-toothpaste-100g.webp"),
    ("Hand Wash 250ml", "Personal Care", 65.0, 24, "catalog-hand-wash-250ml.webp"),
    ("Toothbrush Pack", "Personal Care", 70.0, 20, "catalog-toothbrush-pack.webp"),
    ("Tissue Box", "Household", 55.0, 24, "catalog-tissue-box.webp"),
    ("Sanitary Pads Pack", "Personal Care", 135.0, 20, "catalog-sanitary-pads-pack.webp"),
    ("Face Wash 100g", "Personal Care", 125.0, 20, "catalog-face-wash-100g.webp"),
    ("Bathing Soap 125g", "Personal Care", 35.0, 36, "catalog-bathing-soap-125g.webp"),
]

ALL_PRESENTATION_PRODUCTS = CORE_PRESENTATION_PRODUCTS + PRESENTATION_PRODUCTS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-remote", action="store_true", help="Allow writes to a non-SQLite database")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.allow_remote and not settings.DATABASE_URL.startswith("sqlite"):
        print("Refusing non-SQLite writes. Re-run with --allow-remote for the intentional presentation catalogue update.")
        return 2

    db = SessionLocal()
    try:
        stores = db.query(Store).filter(Store.store_name.in_(SATELLITE_STORES)).all()
        if len(stores) != len(SATELLITE_STORES):
            missing = ", ".join(sorted(SATELLITE_STORES - {store.store_name for store in stores}))
            raise RuntimeError(f"Satellite demo stores are missing: {missing}")

        existing_products = db.query(Product).filter(Product.store_id.in_([store.id for store in stores])).all()
        product_by_store_and_name = {(product.store_id, product.name): product for product in existing_products}

        added = 0
        for store in stores:
            for name, category, price, quantity, image_name in ALL_PRESENTATION_PRODUCTS:
                product = product_by_store_and_name.get((store.id, name))
                if product is None:
                    product = Product(
                        store_id=store.id,
                        name=name,
                        description=f"Presentation catalogue product for {store.store_name}.",
                        category=category,
                        price=price,
                        image_url=f"/images/products/{image_name}",
                        is_active=True,
                    )
                    db.add(product)
                    product_by_store_and_name[(store.id, name)] = product
                    added += 1
                product.description = f"Presentation catalogue product for {store.store_name}."
                product.category = category
                product.price = price
                product.image_url = f"/images/products/{image_name}"
                product.is_active = True

        db.flush()
        inventory_by_store_and_product = {
            (inventory.store_id, inventory.product_id): inventory
            for inventory in db.query(Inventory).filter(Inventory.store_id.in_([store.id for store in stores])).all()
        }
        for store in stores:
            for name, _category, _price, quantity, _image_name in ALL_PRESENTATION_PRODUCTS:
                product = product_by_store_and_name[(store.id, name)]
                inventory = inventory_by_store_and_product.get((store.id, product.id))
                if inventory is None:
                    inventory = Inventory(store_id=store.id, product_id=product.id)
                    db.add(inventory)
                inventory.quantity = quantity
                inventory.is_available = True
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Presentation catalogue ready: stores={len(stores)}, products_per_store=50, products_added={added}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
