#!/usr/bin/env python3
"""Exercise a Neon-backed Dukaan2Door workflow through API endpoints."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.main import app  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.inventory import Inventory  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.retailer import Retailer  # noqa: E402
from app.models.store import Store  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.delivery_partner import DeliveryPartner  # noqa: E402


DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "DemoPassword123!")
API = "/api"


def login(client: TestClient, email: str) -> str:
    response = client.post(f"{API}/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    response.raise_for_status()
    return response.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def find_product(retailer_email: str, store_name: str, product_name: str) -> tuple[int, int]:
    db = SessionLocal()
    try:
        product = (
            db.query(Product)
            .join(Store)
            .join(Retailer, Store.retailer_id == Retailer.id)
            .join(User, Retailer.user_id == User.id)
            .filter(User.email == retailer_email, Store.store_name == store_name, Product.name == product_name)
            .first()
        )
        if not product:
            raise RuntimeError(f"Missing demo product: {store_name} / {product_name}")
        inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
        if not inventory:
            raise RuntimeError(f"Missing inventory for product id {product.id}")
        return product.id, inventory.quantity
    finally:
        db.close()


def find_delivery_partner_email(partner_id: int) -> str:
    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .join(DeliveryPartner, DeliveryPartner.user_id == User.id)
            .filter(DeliveryPartner.id == partner_id)
            .first()
        )
        if not user:
            raise RuntimeError(f"Missing assigned delivery partner id {partner_id}")
        return user.email
    finally:
        db.close()


def assert_matching_cases(client: TestClient, token: str) -> None:
    west_id, _ = find_product("demo.retailer.west@example.com", "Demo West Grocery", "Demo West Rice 1kg")
    east_id, _ = find_product("demo.retailer.east@example.com", "Demo East Wholesale", "Demo East Rice 1kg")
    out_id, _ = find_product("demo.retailer.outofstock@example.com", "Demo Out Of Stock Store", "Demo Out Rice 1kg")

    fallback = client.post(
        f"{API}/matching/store",
        headers=bearer(token),
        json={"latitude": 23.0225, "longitude": 72.5714, "items": [{"product_id": west_id, "quantity": 1}]},
    )
    fallback.raise_for_status()
    if fallback.json().get("search_radius_km") != 5:
        raise RuntimeError(f"Expected 5 km fallback match, got {fallback.json()}")

    unavailable = client.post(
        f"{API}/matching/store",
        headers=bearer(token),
        json={"latitude": 23.0225, "longitude": 72.5714, "items": [{"product_id": out_id, "quantity": 1}]},
    )
    if unavailable.status_code != 404:
        raise RuntimeError(f"Expected out-of-stock product to fail matching, got {unavailable.status_code}")

    no_store = client.post(
        f"{API}/matching/store",
        headers=bearer(token),
        json={"latitude": 23.0225, "longitude": 72.5714, "items": [{"product_id": east_id, "quantity": 1}]},
    )
    if no_store.status_code != 404:
        raise RuntimeError(f"Expected no store within 5 km, got {no_store.status_code}")


def main() -> None:
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")

    client = TestClient(app)

    customer_token = login(client, "demo.customer@example.com")
    retailer_token = login(client, "demo.retailer.central@example.com")
    assert_matching_cases(client, customer_token)

    rice_id, rice_before = find_product(
        "demo.retailer.central@example.com",
        "Demo Central Mart",
        "Demo Basmati Rice 1kg",
    )
    milk_id, milk_before = find_product(
        "demo.retailer.central@example.com",
        "Demo Central Mart",
        "Demo Toned Milk 1L",
    )

    match_response = client.post(
        f"{API}/matching/store",
        headers=bearer(customer_token),
        json={
            "latitude": 23.0225,
            "longitude": 72.5714,
            "items": [{"product_id": rice_id, "quantity": 1}, {"product_id": milk_id, "quantity": 1}],
        },
    )
    match_response.raise_for_status()
    match_payload = match_response.json()
    if not match_payload.get("matched") or match_payload.get("search_radius_km") != 2:
        raise RuntimeError(f"Expected 2 km store match, got {match_payload}")

    order_response = client.post(
        f"{API}/orders",
        headers=bearer(customer_token),
        json={
            "delivery_address": "Demo customer address, Navrangpura, Ahmedabad",
            "delivery_lat": 23.0225,
            "delivery_lng": 72.5714,
            "notes": "Automated Neon workflow verification",
            "items": [{"product_id": rice_id, "quantity": 1}, {"product_id": milk_id, "quantity": 1}],
        },
    )
    order_response.raise_for_status()
    order = order_response.json()
    order_id = order["id"]
    if order["status"] != "RECEIVED":
        raise RuntimeError(f"Expected RECEIVED order, got {order['status']}")

    for status in ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP"]:
        response = client.patch(f"{API}/orders/{order_id}/status", headers=bearer(retailer_token), json={"status": status})
        response.raise_for_status()

    delivery_response = client.post(f"{API}/deliveries/{order_id}/assign", headers=bearer(retailer_token))
    delivery_response.raise_for_status()
    assignment = delivery_response.json()
    if not assignment.get("assigned"):
        raise RuntimeError(f"Expected delivery assignment, got {assignment}")
    delivery_id = assignment["delivery"]["id"]
    assigned_partner_id = assignment["delivery"]["delivery_partner_id"]
    rider_token = login(client, find_delivery_partner_email(assigned_partner_id))

    response = client.patch(
        f"{API}/deliveries/{delivery_id}/status",
        headers=bearer(rider_token),
        json={"status": "PICKED_UP"},
    )
    response.raise_for_status()

    response = client.patch(
        f"{API}/deliveries/{delivery_id}/status",
        headers=bearer(rider_token),
        json={"status": "OUT_FOR_DELIVERY"},
    )
    response.raise_for_status()

    location_response = client.post(
        f"{API}/deliveries/{delivery_id}/location",
        headers=bearer(rider_token),
        json={"latitude": 23.0228, "longitude": 72.5718},
    )
    location_response.raise_for_status()

    response = client.patch(
        f"{API}/deliveries/{delivery_id}/status",
        headers=bearer(rider_token),
        json={"status": "DELIVERED"},
    )
    response.raise_for_status()
    delivery = response.json()
    if delivery["status"] != "DELIVERED":
        raise RuntimeError(f"Expected delivered delivery, got {delivery['status']}")

    order_final = client.get(f"{API}/orders/{order_id}", headers=bearer(customer_token))
    order_final.raise_for_status()
    if order_final.json()["status"] != "DELIVERED":
        raise RuntimeError(f"Expected delivered order, got {order_final.json()['status']}")

    tracking = client.get(f"{API}/deliveries/{delivery_id}/tracking", headers=bearer(customer_token))
    tracking.raise_for_status()
    if not tracking.json()["updates"]:
        raise RuntimeError("Expected tracking records")

    _, rice_after = find_product(
        "demo.retailer.central@example.com",
        "Demo Central Mart",
        "Demo Basmati Rice 1kg",
    )
    _, milk_after = find_product(
        "demo.retailer.central@example.com",
        "Demo Central Mart",
        "Demo Toned Milk 1L",
    )
    if rice_after != rice_before - 1 or milk_after != milk_before - 1:
        raise RuntimeError("Expected inventory decrement after API-created order")

    print(
        "Workflow verified:",
        {
            "order_id": order_id,
            "delivery_id": delivery_id,
            "matched_store_id": order["store_id"],
            "tracking_updates": len(tracking.json()["updates"]),
        },
    )


if __name__ == "__main__":
    main()
