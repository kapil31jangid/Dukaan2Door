"""Run a complete Dukaan2Door customer-to-delivery API story.

This creates isolated demo users and one demo order through the public API. It is
intended for a local backend only; use --allow-remote explicitly for a non-local
environment. The script never deletes or resets data.

Run from the repository root while the backend is running:

    python scripts/run_story.py
"""

from __future__ import annotations

import argparse
import sys
import uuid
from typing import Any

import httpx


PASSWORD = "StoryPassword123!"
CUSTOMER_LOCATION = (23.0258, 72.5873)
STORE_LOCATION = (23.0260, 72.5875)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080", help="Running backend URL")
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Allow writes to a non-local backend; omitted by default for safety",
    )
    return parser.parse_args()


def fail(response: httpx.Response, action: str) -> None:
    try:
        detail: Any = response.json()
    except ValueError:
        detail = response.text
    raise RuntimeError(f"{action} failed ({response.status_code}): {detail}")


def expect(response: httpx.Response, status_code: int, action: str) -> dict[str, Any]:
    if response.status_code != status_code:
        fail(response, action)
    return response.json()


def register(client: httpx.Client, email: str, role: str, name: str, **extra: Any) -> str:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "role": role,
            "name": name,
            **extra,
        },
    )
    return expect(response, 201, f"register {role}")["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    if not args.allow_remote and not (base_url.startswith("http://127.0.0.1") or base_url.startswith("http://localhost")):
        print("Refusing non-local writes. Re-run with --allow-remote only for an intentional demo environment.", file=sys.stderr)
        return 2

    story_id = uuid.uuid4().hex[:10]
    customer_email = f"story.customer.{story_id}@example.com"
    retailer_email = f"story.retailer.{story_id}@example.com"
    partner_email = f"story.partner.{story_id}@example.com"

    with httpx.Client(base_url=base_url, timeout=20.0) as client:
        expect(client.get("/health"), 200, "health check")
        print("1/10 backend is healthy")

        customer_token = register(
            client,
            customer_email,
            "customer",
            "Story Customer",
            delivery_address="Story Customer Address",
            lat=CUSTOMER_LOCATION[0],
            lng=CUSTOMER_LOCATION[1],
        )
        retailer_token = register(
            client,
            retailer_email,
            "retailer",
            "Story Store",
            store_name=f"Story Store {story_id}",
            operating_hours="08:00 AM - 10:00 PM",
            lat=STORE_LOCATION[0],
            lng=STORE_LOCATION[1],
        )
        partner_token = register(
            client,
            partner_email,
            "delivery_partner",
            "Story Delivery Partner",
            vehicle_info="Demo bicycle",
            lat=STORE_LOCATION[0],
            lng=STORE_LOCATION[1],
        )
        print("2/10 customer, retailer, and partner registered")

        product = expect(
            client.post(
                "/api/products",
                headers=auth(retailer_token),
                json={
                    "name": f"Story Grocery {story_id}",
                    "description": "Isolated end-to-end story product",
                    "category": "Groceries",
                    "price": 49.0,
                    "initial_stock": 5,
                    "is_available": True,
                },
            ),
            201,
            "create retailer product",
        )
        product_id = product["id"]
        print(f"3/10 retailer product created: #{product_id}")

        order = expect(
            client.post(
                "/api/orders",
                headers=auth(customer_token),
                json={
                    "items": [{"product_id": product_id, "quantity": 1}],
                    "delivery_address": "Story Customer Address",
                    "delivery_lat": CUSTOMER_LOCATION[0],
                    "delivery_lng": CUSTOMER_LOCATION[1],
                },
            ),
            201,
            "customer order and automatic store matching",
        )
        order_id = order["id"]
        assert order["status"] == "RECEIVED"
        assert order["store_id"] == product["store_id"]
        print(f"4/10 customer order created and matched to store #{order['store_id']}")

        for next_status in ("ACCEPTED", "PREPARING", "READY_FOR_PICKUP"):
            order = expect(
                client.patch(
                    f"/api/orders/{order_id}/status",
                    headers=auth(retailer_token),
                    json={"status": next_status},
                ),
                200,
                f"retailer status {next_status}",
            )
            assert order["status"] == next_status
        print("5/10 retailer accepted, prepared, and marked the order ready")

        assignment = expect(
            client.post(f"/api/deliveries/{order_id}/assign", headers=auth(retailer_token)),
            200,
            "assign delivery partner",
        )
        delivery = assignment["delivery"]
        delivery_id = delivery["id"]
        assert assignment["assigned"] is True
        print(f"6/10 delivery assigned: #{delivery_id}")

        for next_status in ("ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"):
            delivery = expect(
                client.patch(
                    f"/api/deliveries/{delivery_id}/status",
                    headers=auth(partner_token),
                    json={"status": next_status},
                ),
                200,
                f"partner status {next_status}",
            )
            assert delivery["status"] == next_status
        print("7/10 partner accepted assignment, picked up, and started delivery")

        tracking = expect(
            client.post(
                f"/api/deliveries/{delivery_id}/location",
                headers=auth(partner_token),
                json={"latitude": 23.0259, "longitude": 72.5874, "accuracy_m": 8.0},
            ),
            200,
            "send partner GPS update",
        )
        assert tracking["accuracy_m"] == 8.0
        customer_tracking = expect(
            client.get(f"/api/deliveries/{delivery_id}/tracking", headers=auth(customer_token)),
            200,
            "customer tracking history",
        )
        assert customer_tracking["updates"][-1]["accuracy_m"] == 8.0
        print("8/10 customer received a persisted GPS update with accuracy")

        delivery = expect(
            client.patch(
                f"/api/deliveries/{delivery_id}/status",
                headers=auth(partner_token),
                json={"status": "DELIVERED"},
            ),
            200,
            "complete delivery",
        )
        assert delivery["status"] == "DELIVERED"
        final_order = expect(client.get(f"/api/orders/{order_id}", headers=auth(customer_token)), 200, "customer final order")
        assert final_order["status"] == "DELIVERED"
        assert final_order["delivery_id"] == delivery_id
        print("9/10 delivery and customer order are DELIVERED")

        retailer_orders = expect(client.get("/api/orders", headers=auth(retailer_token)), 200, "retailer order screen")
        partner_orders = expect(client.get("/api/orders", headers=auth(partner_token)), 200, "partner order screen")
        customer_orders = expect(client.get("/api/orders", headers=auth(customer_token)), 200, "customer order screen")
        assert any(item["id"] == order_id for item in retailer_orders)
        assert any(item["id"] == order_id for item in partner_orders)
        assert any(item["id"] == order_id for item in customer_orders)
        print("10/10 customer, retailer, and partner order screens can read the same lifecycle")
        print(f"STORY PASSED: order={order_id}, delivery={delivery_id}, source={story_id}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (httpx.HTTPError, RuntimeError, AssertionError) as exc:
        print(f"STORY FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
