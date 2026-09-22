#!/usr/bin/env python3
"""Seed controlled demo operational data for the Dukaan2Door Neon database.

This script intentionally seeds fictional application/demo records only. It does
not copy external source datasets into operational tables and does not create
orders or deliveries directly.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.core.security import get_password_hash  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.delivery_partner import DeliveryPartner  # noqa: E402
from app.models.inventory import Inventory  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.retailer import Retailer  # noqa: E402
from app.models.store import Store  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "DemoPassword123!")

CUSTOMERS = [
    {
        "email": "demo.customer@example.com",
        "name": "Demo Customer",
        "phone": "9000000001",
        "delivery_address": "Demo customer address, Navrangpura, Ahmedabad",
        "lat": 23.0225,
        "lng": 72.5714,
    },
    {
        "email": "demo.customer.fallback@example.com",
        "name": "Demo Fallback Customer",
        "phone": "9000000002",
        "delivery_address": "Demo fallback address, Ambawadi, Ahmedabad",
        "lat": 23.0272,
        "lng": 72.5604,
    },
]

STORES = [
    {
        "email": "demo.retailer.central@example.com",
        "retailer_name": "Demo Central Retailer",
        "phone": "9100000001",
        "store_name": "Demo Central Mart",
        "address": "Demo Central Mart, Navrangpura, Ahmedabad",
        "lat": 23.0230,
        "lng": 72.5720,
        "operating_hours": "08:00-22:00",
        "is_open": True,
        "products": [
            ("Demo Basmati Rice 1kg", "Staples", 125.0, 40, True),
            ("Demo Toned Milk 1L", "Dairy", 62.0, 35, True),
            ("Demo Whole Wheat Bread", "Bakery", 45.0, 25, True),
            ("Demo Sunflower Oil 1L", "Staples", 155.0, 22, True),
            ("Demo Tata Salt 1kg", "Staples", 28.0, 50, True),
            ("Demo Bananas 1 Dozen", "Fresh Produce", 70.0, 18, True),
        ],
    },
    {
        "email": "demo.retailer.west@example.com",
        "retailer_name": "Demo West Retailer",
        "phone": "9100000002",
        "store_name": "Demo West Grocery",
        "address": "Demo West Grocery, Naranpura, Ahmedabad",
        "lat": 23.0490,
        "lng": 72.5580,
        "operating_hours": "08:00-22:00",
        "is_open": True,
        "products": [
            ("Demo West Rice 1kg", "Staples", 120.0, 30, True),
            ("Demo West Milk 1L", "Dairy", 61.0, 24, True),
            ("Demo West Bread", "Bakery", 42.0, 20, True),
            ("Demo West Tea 250g", "Beverages", 145.0, 15, True),
            ("Demo West Sugar 1kg", "Staples", 48.0, 18, True),
            ("Demo West Apples 1kg", "Fresh Produce", 160.0, 16, True),
        ],
    },
    {
        "email": "demo.retailer.partial@example.com",
        "retailer_name": "Demo Partial Retailer",
        "phone": "9100000003",
        "store_name": "Demo Partial Corner",
        "address": "Demo Partial Corner, Navrangpura, Ahmedabad",
        "lat": 23.0235,
        "lng": 72.5730,
        "operating_hours": "09:00-21:00",
        "is_open": True,
        "products": [
            ("Demo Partial Rice 1kg", "Staples", 122.0, 12, True),
            ("Demo Partial Milk 1L", "Dairy", 63.0, 8, True),
            ("Demo Partial Biscuits", "Snacks", 35.0, 0, False),
            ("Demo Partial Detergent 500g", "Household", 80.0, 10, True),
            ("Demo Partial Soap Pack", "Personal Care", 55.0, 7, True),
        ],
    },
    {
        "email": "demo.retailer.closed@example.com",
        "retailer_name": "Demo Closed Retailer",
        "phone": "9100000004",
        "store_name": "Demo Closed Store",
        "address": "Demo Closed Store, Navrangpura, Ahmedabad",
        "lat": 23.0218,
        "lng": 72.5707,
        "operating_hours": "Closed for demo",
        "is_open": False,
        "products": [
            ("Demo Closed Rice 1kg", "Staples", 119.0, 50, True),
            ("Demo Closed Milk 1L", "Dairy", 60.0, 50, True),
            ("Demo Closed Bread", "Bakery", 41.0, 50, True),
        ],
    },
    {
        "email": "demo.retailer.outofstock@example.com",
        "retailer_name": "Demo Stock Retailer",
        "phone": "9100000005",
        "store_name": "Demo Out Of Stock Store",
        "address": "Demo Out Of Stock Store, Navrangpura, Ahmedabad",
        "lat": 23.0240,
        "lng": 72.5718,
        "operating_hours": "08:00-22:00",
        "is_open": True,
        "products": [
            ("Demo Out Rice 1kg", "Staples", 118.0, 0, False),
            ("Demo Out Milk 1L", "Dairy", 60.0, 0, False),
            ("Demo Out Bread", "Bakery", 40.0, 0, False),
        ],
    },
    {
        "email": "demo.retailer.east@example.com",
        "retailer_name": "Demo East Retailer",
        "phone": "9100000006",
        "store_name": "Demo East Wholesale",
        "address": "Demo East Wholesale, Vastral, Ahmedabad",
        "lat": 23.0100,
        "lng": 72.6350,
        "operating_hours": "07:00-23:00",
        "is_open": True,
        "products": [
            ("Demo East Rice 1kg", "Staples", 116.0, 30, True),
            ("Demo East Milk 1L", "Dairy", 59.0, 25, True),
            ("Demo East Bread", "Bakery", 39.0, 20, True),
            ("Demo East Flour 5kg", "Staples", 260.0, 10, True),
        ],
    },
]

DELIVERY_PARTNERS = [
    ("demo.rider1@example.com", "Demo Rider One", "9200000001", "Demo Bike GJ-01-D-1001", 23.0232, 72.5722, True),
    ("demo.rider2@example.com", "Demo Rider Two", "9200000002", "Demo Scooter GJ-01-D-1002", 23.0495, 72.5585, True),
    ("demo.rider3@example.com", "Demo Rider Three", "9200000003", "Demo Bike GJ-01-D-1003", 23.0105, 72.6335, True),
    ("demo.rider4@example.com", "Demo Rider Four", "9200000004", "Demo Cycle GJ-01-D-1004", 23.0280, 72.5660, True),
]


def get_or_create_user(db, email: str, role: UserRole) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.role = role
        user.is_active = True
        return user

    user = User(email=email, hashed_password=get_password_hash(DEMO_PASSWORD), role=role, is_active=True)
    db.add(user)
    db.flush()
    return user


def upsert_customers(db) -> None:
    for item in CUSTOMERS:
        user = get_or_create_user(db, item["email"], UserRole.CUSTOMER)
        customer = db.query(Customer).filter(Customer.user_id == user.id).first()
        if not customer:
            customer = Customer(
                user_id=user.id,
                name=item["name"],
                phone=item["phone"],
                delivery_address=item["delivery_address"],
                lat=item["lat"],
                lng=item["lng"],
            )
            db.add(customer)
        customer.name = item["name"]
        customer.phone = item["phone"]
        customer.delivery_address = item["delivery_address"]
        customer.lat = item["lat"]
        customer.lng = item["lng"]


def upsert_stores(db) -> None:
    for item in STORES:
        user = get_or_create_user(db, item["email"], UserRole.RETAILER)
        retailer = db.query(Retailer).filter(Retailer.user_id == user.id).first()
        if not retailer:
            retailer = Retailer(user_id=user.id, name=item["retailer_name"], phone=item["phone"])
            db.add(retailer)
            db.flush()
        retailer.name = item["retailer_name"]
        retailer.phone = item["phone"]

        store = db.query(Store).filter(Store.retailer_id == retailer.id).first()
        if not store:
            store = Store(
                retailer_id=retailer.id,
                store_name=item["store_name"],
                address=item["address"],
                lat=item["lat"],
                lng=item["lng"],
                operating_hours=item["operating_hours"],
                is_open=item["is_open"],
            )
            db.add(store)
            db.flush()
        store.store_name = item["store_name"]
        store.address = item["address"]
        store.lat = item["lat"]
        store.lng = item["lng"]
        store.operating_hours = item["operating_hours"]
        store.is_open = item["is_open"]

        for name, category, price, quantity, available in item["products"]:
            product = (
                db.query(Product)
                .filter(Product.store_id == store.id, Product.name == name)
                .first()
            )
            if not product:
                product = Product(
                    store_id=store.id,
                    name=name,
                    description=f"Fictional demo product for {store.store_name}.",
                    category=category,
                    price=price,
                    is_active=True,
                )
                db.add(product)
                db.flush()
            product.description = f"Fictional demo product for {store.store_name}."
            product.category = category
            product.price = price
            product.is_active = True

            inventory = (
                db.query(Inventory)
                .filter(Inventory.store_id == store.id, Inventory.product_id == product.id)
                .first()
            )
            if not inventory:
                inventory = Inventory(store_id=store.id, product_id=product.id)
                db.add(inventory)
            inventory.quantity = quantity
            inventory.is_available = available


def upsert_delivery_partners(db) -> None:
    obsolete_demo_partners = (
        db.query(DeliveryPartner)
        .join(User)
        .filter(User.email.like("%@dukaan2door.test"))
        .all()
    )
    for partner in obsolete_demo_partners:
        partner.is_available = False

    for email, name, phone, vehicle, lat, lng, available in DELIVERY_PARTNERS:
        user = get_or_create_user(db, email, UserRole.DELIVERY_PARTNER)
        partner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == user.id).first()
        if not partner:
            partner = DeliveryPartner(user_id=user.id, name=name, phone=phone)
            db.add(partner)
        partner.name = name
        partner.phone = phone
        partner.vehicle_info = vehicle
        partner.current_lat = lat
        partner.current_lng = lng
        partner.is_available = available


def main() -> None:
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")

    db = SessionLocal()
    try:
        upsert_customers(db)
        upsert_stores(db)
        upsert_delivery_partners(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("Seeded fictional operational demo data.")
    print("Demo accounts use DEMO_PASSWORD from the environment, or DemoPassword123! by default.")


if __name__ == "__main__":
    main()
