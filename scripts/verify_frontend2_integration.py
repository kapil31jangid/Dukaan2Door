#!/usr/bin/env python3
"""Automated end-to-end verification script for Dukaan2Door Frontend 2 (Retailer & Delivery Partner)."""

import json
import urllib.request
from typing import Any, Dict

API_BASE = "http://localhost:8080"
FRONTEND_BASE = "http://127.0.0.1:3000"


def http_request(url: str, method: str = "GET", data: Dict[str, Any] = None, token: str = None) -> Any:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
        try:
            return json.loads(content)
        except Exception:
            return content


def test_frontend_server():
    print("--- 1. Testing Frontend Static Server ---")
    with urllib.request.urlopen(FRONTEND_BASE) as resp:
        html = resp.read().decode("utf-8")
        assert resp.status == 200, "Frontend server status is not 200"
        assert '<div id="root"></div>' in html, "HTML missing root div"
        assert "leaflet.css" in html, "HTML missing Leaflet CSS"
        print("[OK] Frontend Vite server is serving application bundle at", FRONTEND_BASE)


def test_retailer_workflow():
    print("\n--- 2. Testing Retailer Workflow Integration ---")
    # Login as retailer
    login_res = http_request(
        f"{API_BASE}/api/auth/login",
        method="POST",
        data={"email": "demo.retailer.central@example.com", "password": "DemoPassword123!"},
    )
    token = login_res["access_token"]
    role = login_res["role"]
    assert role == "retailer", f"Expected retailer role, got {role}"
    print(f"[OK] Retailer login successful (Role: {role}, Token: {token[:12]}...)")

    # Get /me
    me = http_request(f"{API_BASE}/api/auth/me", token=token)
    print(f"[OK] Auth me metadata: {me['email']} ({me['role']})")

    # Get store details
    store = http_request(f"{API_BASE}/api/retailers/me/store", token=token)
    print(f"[OK] Store Profile: {store['store_name']} (ID: {store['id']}, Open: {store['is_open']}, Coords: {store['lat']}, {store['lng']})")

    # Get store products
    products = http_request(f"{API_BASE}/api/retailers/me/products", token=token)
    assert len(products) > 0, "No products returned for store"
    print(f"[OK] Products catalog retrieved: {len(products)} products found")
    sample = products[0]
    print(f"     Sample: {sample['name']} | Price: Rs {sample['price']} | Stock: {sample['quantity']}")

    # Get store orders
    orders = http_request(f"{API_BASE}/api/orders", token=token)
    print(f"[OK] Retailer orders retrieved: {len(orders)} orders found")


def test_delivery_workflow():
    print("\n--- 3. Testing Delivery Partner Workflow Integration ---")
    # Login as delivery partner
    login_res = http_request(
        f"{API_BASE}/api/auth/login",
        method="POST",
        data={"email": "demo.rider1@example.com", "password": "DemoPassword123!"},
    )
    token = login_res["access_token"]
    role = login_res["role"]
    assert role == "delivery_partner", f"Expected delivery_partner role, got {role}"
    print(f"[OK] Delivery partner login successful (Role: {role}, Token: {token[:12]}...)")

    # Get profile
    profile = http_request(f"{API_BASE}/api/delivery-partners/me", token=token)
    print(f"[OK] Partner Profile: {profile['name']} (Vehicle: {profile['vehicle_info']}, Available: {profile['is_available']}, Coords: {profile['current_lat']}, {profile['current_lng']})")

    # Get assigned orders
    assigned_orders = http_request(f"{API_BASE}/api/orders", token=token)
    print(f"[OK] Assigned orders count: {len(assigned_orders)}")


def main():
    print("==================================================")
    print("DUKAAN2DOOR FRONTEND 2 INTEGRATION VERIFICATION")
    print("==================================================")
    test_frontend_server()
    test_retailer_workflow()
    test_delivery_workflow()
    print("\n==================================================")
    print("ALL FRONTEND 2 INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    main()
