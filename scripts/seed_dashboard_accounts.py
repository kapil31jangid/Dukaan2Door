#!/usr/bin/env python3
"""Create/update the named dashboard test accounts without deleting data.

This script changes only the allowlisted test users and their profiles/stores.
It does not create products, inventory, orders, deliveries, or delete rows.
For a non-SQLite database, --allow-remote is required explicitly.
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
from app.core.security import get_password_hash  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.delivery_partner import DeliveryPartner  # noqa: E402
from app.models.retailer import Retailer  # noqa: E402
from app.models.store import Store  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


PASSWORD = "DemoPassword123!"

CUSTOMERS = [
    {
        "email": "rahul@example.com",
        "name": "Rahul Sharma",
        "phone": "9000000003",
        "address": "Satellite Road, Ramdev Nagar, Ahmedabad 380015",
        "lat": 23.0276,
        "lng": 72.5076,
    },
]

RETAILERS = [
    {
        "email": "satellite.retailer.rahul@example.com",
        "name": "Rahul Satellite Retailer",
        "phone": "+91 98250 11006",
        "store_name": "Rahul Satellite Kirana",
        "address": "Satellite Road, Ramdev Nagar, Ahmedabad 380015",
        "lat": 23.0276,
        "lng": 72.5076,
    },
    {
        "email": "satellite.retailer.neha@example.com",
        "name": "Neha Satellite Retailer",
        "phone": "+91 98250 11007",
        "store_name": "Neha Satellite Daily Needs",
        "address": "Jodhpur Cross Road, Satellite, Ahmedabad 380015",
        "lat": 23.0285,
        "lng": 72.5090,
    },
]

PARTNERS = [
    {
        "email": "satellite.rider.rahul@example.com",
        "name": "Rider Rahul (Satellite)",
        "phone": "+91 98250 20006",
        "vehicle": "Hero Splendor (GJ-01-KL-1006)",
        "lat": 23.0276,
        "lng": 72.5076,
    },
    {
        "email": "satellite.rider.arjun.3km@example.com",
        "name": "Rider Arjun (3 km from Satellite)",
        "phone": "+91 98250 20007",
        "vehicle": "TVS Jupiter (GJ-01-MN-1007)",
        # Approximately 3 km east of the Satellite store.
        "lat": 23.0276,
        "lng": 72.5368,
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Allow writes to a non-SQLite database such as Neon",
    )
    return parser.parse_args()


def get_or_create_user(db, email: str, role: UserRole) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, hashed_password=get_password_hash(PASSWORD), role=role, is_active=True)
        db.add(user)
        db.flush()
    else:
        user.hashed_password = get_password_hash(PASSWORD)
        user.role = role
        user.is_active = True
    return user


def seed(db) -> None:
    for item in CUSTOMERS:
        user = get_or_create_user(db, item["email"], UserRole.CUSTOMER)
        profile = db.query(Customer).filter(Customer.user_id == user.id).first()
        if profile is None:
            profile = Customer(user_id=user.id)
            db.add(profile)
        profile.name = item["name"]
        profile.phone = item["phone"]
        profile.delivery_address = item["address"]
        profile.lat = item["lat"]
        profile.lng = item["lng"]

    for item in RETAILERS:
        user = get_or_create_user(db, item["email"], UserRole.RETAILER)
        profile = db.query(Retailer).filter(Retailer.user_id == user.id).first()
        if profile is None:
            profile = Retailer(user_id=user.id, name=item["name"])
            db.add(profile)
            db.flush()
        profile.name = item["name"]
        profile.phone = item["phone"]
        store = db.query(Store).filter(Store.retailer_id == profile.id).first()
        if store is None:
            store = Store(retailer_id=profile.id)
            db.add(store)
        store.store_name = item["store_name"]
        store.address = item["address"]
        store.lat = item["lat"]
        store.lng = item["lng"]
        store.operating_hours = "08:00 AM - 10:00 PM"
        store.is_open = True

    for item in PARTNERS:
        user = get_or_create_user(db, item["email"], UserRole.DELIVERY_PARTNER)
        profile = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == user.id).first()
        if profile is None:
            profile = DeliveryPartner(user_id=user.id)
            db.add(profile)
        profile.name = item["name"]
        profile.phone = item["phone"]
        profile.vehicle_info = item["vehicle"]
        profile.current_lat = item["lat"]
        profile.current_lng = item["lng"]
        profile.is_available = True

    db.commit()


def main() -> int:
    args = parse_args()
    if not args.allow_remote and not settings.DATABASE_URL.startswith("sqlite"):
        print("Refusing non-SQLite writes. Re-run with --allow-remote for the intentional test-account setup.", file=sys.stderr)
        return 2
    db = SessionLocal()
    try:
        seed(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print("Dashboard test accounts are ready.")
    print("Password: DemoPassword123!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
