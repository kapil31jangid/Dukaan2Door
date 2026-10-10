import math
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect

from app.models.delivery_partner import DeliveryPartner
from app.services.geo_service import calculate_distance_km
from app.services.routing_service import get_route


def auth_headers(client, email, role, name, **extra):
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123",
            "role": role,
            "name": name,
            **extra,
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_product(client, retailer_headers, name="Rice", stock=10, available=True):
    response = client.post(
        "/api/products",
        json={
            "name": name,
            "description": "Backend integration test product",
            "category": "Groceries",
            "price": 50,
            "initial_stock": stock,
            "is_available": available,
        },
        headers=retailer_headers,
    )
    assert response.status_code == 201
    return response.json()


def create_ready_order(client, customer_headers, retailer_headers, product_id, quantity=1):
    order_response = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": product_id, "quantity": quantity}],
            "delivery_address": "Customer Address",
            "delivery_lat": 28.6139,
            "delivery_lng": 77.2090,
        },
        headers=customer_headers,
    )
    assert order_response.status_code == 201
    order_id = order_response.json()["id"]
    for next_status in ("ACCEPTED", "PREPARING", "READY_FOR_PICKUP"):
        response = client.patch(
            f"/api/orders/{order_id}/status",
            json={"status": next_status},
            headers=retailer_headers,
        )
        assert response.status_code == 200
    return order_id


def test_retailer_inventory_manual_confirmation_is_store_scoped_and_merges_exact_duplicates(client, retailer_headers):
    first = client.post(
        "/api/retailer/inventory/manual",
        json={"items": [{"product_name": "Parle-G 250g", "brand": "Parle", "quantity": 15, "unit": "pack", "price": 10, "category": "Snacks & Packaged Foods", "handling_type": "NORMAL", "requires_special_equipment": False, "low_stock_threshold": 5}]},
        headers=retailer_headers,
    )
    assert first.status_code == 201
    assert first.json()[0]["created"] is True
    assert first.json()[0]["quantity_after"] == 15

    second = client.post(
        "/api/retailer/inventory/manual",
        json={"items": [{"product_name": "Parle-G 250g", "brand": "Parle", "quantity": 20, "unit": "pack", "price": 10, "category": "Snacks & Packaged Foods", "handling_type": "NORMAL", "requires_special_equipment": False, "low_stock_threshold": 5}]},
        headers=retailer_headers,
    )
    assert second.status_code == 201
    assert second.json()[0]["created"] is False
    assert second.json()[0]["quantity_before"] == 15
    assert second.json()[0]["quantity_after"] == 35

    products = client.get("/api/retailers/me/products", headers=retailer_headers)
    assert products.status_code == 200
    assert len(products.json()) == 1
    assert products.json()[0]["quantity"] == 35
    history = client.get("/api/retailer/inventory/history", headers=retailer_headers)
    assert history.status_code == 200
    assert [row["delta"] for row in history.json()] == [20, 15]


def test_inventory_onboarding_requires_retailer_role_and_configured_ocr(client, customer_headers):
    unauthorized = client.post(
        "/api/retailer/inventory/manual",
        json={"items": [{"product_name": "Rice", "quantity": 1, "unit": "pack", "price": 50}]},
        headers=customer_headers,
    )
    assert unauthorized.status_code == 403
    no_ocr = client.post(
        "/api/retailer/inventory/analyze",
        files={"file": ("bill.png", b"not-a-real-image", "image/png")},
        headers=customer_headers,
    )
    assert no_ocr.status_code == 403


def test_inventory_image_analysis_returns_review_drafts_without_writing_stock(client, retailer_headers, monkeypatch):
    from app.schemas.inventory import ExtractedInventoryItem
    from app.services.ocr_service import OCRTextLine

    def fake_analysis(self, content, filename, content_type):
        return (
            [ExtractedInventoryItem(product_name="Amul Milk", size="500ml", quantity=10, unit="pack", category="Dairy", handling_type="PERISHABLE", requires_special_equipment=False, confidence=0.8, warnings=["Price was not detected."])],
            [OCRTextLine(text="Amul Milk 500ml qty 10", confidence=0.8, bounding_box=[], page_index=0, order=0)],
        )

    monkeypatch.setattr("app.api.v1.endpoints.inventory.InventoryImageAnalyzer.analyze_image", fake_analysis)
    response = client.post(
        "/api/retailer/inventory/analyze",
        files={"file": ("bill.png", b"image", "image/png")},
        headers=retailer_headers,
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["product_name"] == "Amul Milk"
    assert response.json()["items"][0]["size"] == "500ml"
    assert response.json()["provider"] in ("Gemini AI", "PaddleOCR")
    assert client.get("/api/retailers/me/products", headers=retailer_headers).json() == []


def test_rider_claim_is_locked_and_rejected_delivery_returns_to_the_pool(client, customer_headers, retailer_headers, seeded_product):
    first_rider = auth_headers(client, "first-rider@example.com", "delivery_partner", "First Rider", lat=28.6151, lng=77.2101)
    second_rider = auth_headers(client, "second-rider@example.com", "delivery_partner", "Second Rider", lat=28.6152, lng=77.2102)
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])

    first_claim = client.post(f"/api/deliveries/available-orders/{order_id}/claim", headers=first_rider)
    assert first_claim.status_code == 200
    delivery_id = first_claim.json()["delivery"]["id"]
    assert client.post(f"/api/deliveries/available-orders/{order_id}/claim", headers=second_rider).status_code == 409

    rejected = client.post(f"/api/deliveries/{delivery_id}/reject", json={"reason": "Vehicle issue"}, headers=first_rider)
    assert rejected.status_code == 200
    assert rejected.json()["delivery_partner_id"] is None
    assert client.post(f"/api/deliveries/available-orders/{order_id}/claim", headers=second_rider).status_code == 200


def test_frozen_inventory_is_only_offered_to_capable_riders(client, customer_headers, retailer_headers):
    frozen_product = client.post(
        "/api/products",
        json={"name": "Ice Cream", "category": "Frozen", "price": 90, "initial_stock": 5, "is_available": True, "handling_type": "FROZEN", "requires_special_equipment": True},
        headers=retailer_headers,
    ).json()
    normal_rider = auth_headers(client, "normal-rider@example.com", "delivery_partner", "Normal Rider", lat=28.6151, lng=77.2101)
    equipped_rider = auth_headers(client, "frozen-rider@example.com", "delivery_partner", "Frozen Rider", lat=28.6152, lng=77.2102, capabilities="NORMAL,FROZEN_BOX")
    order_id = create_ready_order(client, customer_headers, retailer_headers, frozen_product["id"])

    assert client.get("/api/deliveries/available-orders", headers=normal_rider).json() == []
    available = client.get("/api/deliveries/available-orders", headers=equipped_rider)
    assert available.status_code == 200
    assert available.json()[0]["items"][0]["handling_type"] == "FROZEN"
    assert available.json()[0]["items"][0]["requires_special_equipment"] is True
    assert available.status_code == 200
    assert [order["id"] for order in available.json()] == [order_id]


def test_geo_distance_same_coordinate_and_known_distance():
    assert calculate_distance_km(28.6139, 77.2090, 28.6139, 77.2090) == pytest.approx(0)
    delhi_to_noida = calculate_distance_km(28.6139, 77.2090, 28.5355, 77.3910)
    assert delhi_to_noida == pytest.approx(19.6, rel=0.15)


def test_geo_invalid_coordinate():
    with pytest.raises(HTTPException):
        calculate_distance_km(91, 77.2090, 28.5355, 77.3910)
    with pytest.raises(HTTPException):
        calculate_distance_km(28.6139, float("nan"), 28.5355, 77.3910)
    with pytest.raises(HTTPException):
        calculate_distance_km(28.6139, 181, 28.5355, 77.3910)


def test_store_matching_finds_store_within_2km(client):
    customer_headers = auth_headers(
        client,
        "match-customer@example.com",
        "customer",
        "Match Customer",
        lat=28.6139,
        lng=77.2090,
    )
    retailer_headers = auth_headers(
        client,
        "match-retailer@example.com",
        "retailer",
        "Match Retailer",
        store_name="Near Store",
        lat=28.6150,
        lng=77.2100,
    )
    product = create_product(client, retailer_headers)

    response = client.post(
        "/api/matching/store",
        json={"latitude": 28.6139, "longitude": 77.2090, "items": [{"product_id": product["id"], "quantity": 2}]},
        headers=customer_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched"] is True
    assert data["search_radius_km"] == 2


def test_store_matching_falls_back_to_5km(client):
    customer_headers = auth_headers(client, "fallback-customer@example.com", "customer", "Fallback Customer")
    retailer_headers = auth_headers(
        client,
        "fallback-retailer@example.com",
        "retailer",
        "Fallback Retailer",
        store_name="Fallback Store",
        lat=28.6439,
        lng=77.2090,
    )
    product = create_product(client, retailer_headers)

    response = client.post(
        "/api/matching/store",
        json={"latitude": 28.6139, "longitude": 77.2090, "items": [{"product_id": product["id"], "quantity": 1}]},
        headers=customer_headers,
    )
    assert response.status_code == 200
    assert response.json()["search_radius_km"] == 5
    assert response.json()["reason"] == "No eligible store within 2 km"


def test_store_matching_no_store_within_5km(client):
    customer_headers = auth_headers(client, "nomatch-customer@example.com", "customer", "No Match Customer")
    retailer_headers = auth_headers(
        client,
        "nomatch-retailer@example.com",
        "retailer",
        "No Match Retailer",
        store_name="Far Store",
        lat=28.7139,
        lng=77.2090,
    )
    product = create_product(client, retailer_headers)

    response = client.post(
        "/api/matching/store",
        json={"latitude": 28.6139, "longitude": 77.2090, "items": [{"product_id": product["id"], "quantity": 1}]},
        headers=customer_headers,
    )
    assert response.status_code == 404


def test_store_matching_rejects_closed_unavailable_and_insufficient_inventory(client):
    customer_headers = auth_headers(client, "blocked-customer@example.com", "customer", "Blocked Customer")
    retailer_headers = auth_headers(
        client,
        "blocked-retailer@example.com",
        "retailer",
        "Blocked Retailer",
        store_name="Blocked Store",
        lat=28.6150,
        lng=77.2100,
    )
    product = create_product(client, retailer_headers, stock=1)

    insufficient = client.post(
        "/api/matching/store",
        json={"latitude": 28.6139, "longitude": 77.2090, "items": [{"product_id": product["id"], "quantity": 2}]},
        headers=customer_headers,
    )
    assert insufficient.status_code == 404

    unavailable = client.patch(
        f"/api/products/{product['id']}/availability",
        json={"is_available": False, "quantity": 10},
        headers=retailer_headers,
    )
    assert unavailable.status_code == 200
    no_match = client.post(
        "/api/matching/store",
        json={"latitude": 28.6139, "longitude": 77.2090, "items": [{"product_id": product["id"], "quantity": 1}]},
        headers=customer_headers,
    )
    assert no_match.status_code == 404


def test_order_creation_uses_saved_customer_location_when_request_omits_coordinates(client, retailer_headers, seeded_product):
    customer_headers = auth_headers(
        client,
        "saved-location@example.com",
        "customer",
        "Saved Location Customer",
        delivery_address="Saved Address",
        lat=28.6139,
        lng=77.2090,
    )
    response = client.post(
        "/api/orders",
        json={"items": [{"product_id": seeded_product["id"], "quantity": 1}]},
        headers=customer_headers,
    )
    assert response.status_code == 201
    assert response.json()["delivery_address"] == "Saved Address"
    assert response.json()["delivery_lat"] == 28.6139
    assert response.json()["delivery_lng"] == 77.2090


def test_order_creation_requires_location_when_no_request_or_saved_coordinates(client, retailer_headers, seeded_product):
    customer_headers = auth_headers(client, "no-location@example.com", "customer", "No Location Customer")
    response = client.post(
        "/api/orders",
        json={"items": [{"product_id": seeded_product["id"], "quantity": 1}], "delivery_address": "Address only"},
        headers=customer_headers,
    )
    assert response.status_code == 400


def test_order_creation_uses_matching_and_decrements_inventory(client, customer_headers, retailer_headers, seeded_product):
    response = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": seeded_product["id"], "quantity": 3}],
            "delivery_address": "123 Test St",
            "delivery_lat": 28.6139,
            "delivery_lng": 77.2090,
        },
        headers=customer_headers,
    )
    assert response.status_code == 201
    assert response.json()["store_id"] == seeded_product["store_id"]

    product_response = client.get(f"/api/products/{seeded_product['id']}")
    assert product_response.json()["quantity"] == 22


def test_order_creation_rejects_no_matching_store(client, customer_headers):
    retailer_headers = auth_headers(
        client,
        "far-order-retailer@example.com",
        "retailer",
        "Far Retailer",
        store_name="Far Order Store",
        lat=28.7139,
        lng=77.2090,
    )
    product = create_product(client, retailer_headers)
    response = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "delivery_address": "123 Test St",
            "delivery_lat": 28.6139,
            "delivery_lng": 77.2090,
        },
        headers=customer_headers,
    )
    assert response.status_code == 404
    product_after = client.get(f"/api/products/{product['id']}")
    assert product_after.json()["quantity"] == 10


def test_delivery_assignment_status_tracking_and_route(client, customer_headers, retailer_headers, seeded_product, monkeypatch):
    near_partner_headers = auth_headers(
        client,
        "near-partner@example.com",
        "delivery_partner",
        "Near Partner",
        lat=28.6151,
        lng=77.2101,
    )
    far_partner_headers = auth_headers(
        client,
        "far-partner@example.com",
        "delivery_partner",
        "Far Partner",
        lat=28.6500,
        lng=77.2500,
    )
    near_partner = client.get("/api/delivery-partners/me", headers=near_partner_headers).json()
    far_partner = client.get("/api/delivery-partners/me", headers=far_partner_headers).json()
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])

    assignment = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert assignment.status_code == 200
    data = assignment.json()
    assert data["assigned"] is True
    assert data["delivery"]["delivery_partner_id"] == near_partner["id"]
    assert data["delivery"]["delivery_partner_id"] != far_partner["id"]
    delivery_id = data["delivery"]["id"]

    order_bypass = client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "OUT_FOR_DELIVERY"},
        headers=near_partner_headers,
    )
    assert order_bypass.status_code == 409

    invalid = client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "DELIVERED"},
        headers=near_partner_headers,
    )
    assert invalid.status_code == 409

    picked_up = client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "PICKED_UP"},
        headers=near_partner_headers,
    )
    assert picked_up.status_code == 200
    assert picked_up.json()["status"] == "PICKED_UP"

    bad_location = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 100, "longitude": 77.22},
        headers=near_partner_headers,
    )
    assert bad_location.status_code == 400

    location = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.616, "longitude": 77.211},
        headers=near_partner_headers,
    )
    assert location.status_code == 200

    tracking = client.get(f"/api/deliveries/{delivery_id}/tracking", headers=near_partner_headers)
    assert tracking.status_code == 200
    assert len(tracking.json()["updates"]) >= 2

    class MockResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"routes": [{"distance": 4200, "duration": 750, "geometry": {"type": "LineString"}}]}

    monkeypatch.setattr("app.services.routing_service.httpx.get", lambda *args, **kwargs: MockResponse())
    route = client.get(f"/api/deliveries/{delivery_id}/route", headers=near_partner_headers)
    assert route.status_code == 200
    assert route.json()["distance_km"] == 4.2
    assert route.json()["duration_minutes"] == 12.5
    assert route.json()["pickup_lat"] == pytest.approx(28.616)
    assert route.json()["destination_lat"] == pytest.approx(28.6139)

    out_for_delivery = client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "OUT_FOR_DELIVERY"},
        headers=near_partner_headers,
    )
    assert out_for_delivery.status_code == 200
    assert out_for_delivery.json()["status"] == "OUT_FOR_DELIVERY"

    delivered = client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "DELIVERED"},
        headers=near_partner_headers,
    )
    assert delivered.status_code == 200
    assert delivered.json()["status"] == "DELIVERED"
    assert client.get(f"/api/orders/{order_id}", headers=customer_headers).json()["status"] == "DELIVERED"
    assert client.get("/api/delivery-partners/me", headers=near_partner_headers).json()["is_available"] is True


def test_delivery_duplicate_assignment_prevented(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "duplicate-partner@example.com",
        "delivery_partner",
        "Duplicate Partner",
        lat=28.6151,
        lng=77.2101,
    )
    assert partner_headers
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    first = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert first.status_code == 200
    second = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert second.status_code == 200
    assert second.json()["assigned"] is False
    assert second.json()["reason"] == "Delivery already assigned"


def test_delivery_location_updates_partner_current_location(client, db_session, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "location-partner@example.com",
        "delivery_partner",
        "Location Partner",
        lat=28.6151,
        lng=77.2101,
    )
    partner_id = client.get("/api/delivery-partners/me", headers=partner_headers).json()["id"]
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery_id = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers).json()["delivery"]["id"]
    assert client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "ACCEPTED"},
        headers=partner_headers,
    ).status_code == 200

    response = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.617, "longitude": 77.212},
        headers=partner_headers,
    )
    assert response.status_code == 200
    assert response.json()["latitude"] == pytest.approx(28.617)
    assert response.json()["longitude"] == pytest.approx(77.212)
    assert "lat" not in response.json()
    assert "lng" not in response.json()
    partner = db_session.query(DeliveryPartner).filter(DeliveryPartner.id == partner_id).first()
    assert math.isclose(partner.current_lat, 28.617)
    assert math.isclose(partner.current_lng, 77.212)


def test_out_of_order_rider_location_is_rejected_without_overwriting_position(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "ordered-location-partner@example.com",
        "delivery_partner",
        "Ordered Location Partner",
        lat=28.6151,
        lng=77.2101,
    )
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery_id = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers).json()["delivery"]["id"]
    assert client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "ACCEPTED"},
        headers=partner_headers,
    ).status_code == 200
    now = datetime.now(timezone.utc)

    newer = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.617, "longitude": 77.212, "accuracy_m": 8, "captured_at": now.isoformat()},
        headers=partner_headers,
    )
    assert newer.status_code == 200
    assert newer.json()["recorded_at"].endswith("Z")
    older = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.610, "longitude": 77.205, "accuracy_m": 9, "captured_at": (now - timedelta(seconds=10)).isoformat()},
        headers=partner_headers,
    )
    assert older.status_code == 409
    profile = client.get("/api/delivery-partners/me", headers=partner_headers).json()
    assert profile["current_lat"] == pytest.approx(28.617)
    assert profile["current_lng"] == pytest.approx(77.212)


def test_route_target_follows_delivery_stage_and_osrm_uses_lng_lat_order(client, customer_headers, retailer_headers, seeded_product, monkeypatch):
    partner_headers = auth_headers(
        client,
        "stage-route-partner@example.com",
        "delivery_partner",
        "Stage Route Partner",
        lat=28.6200,
        lng=77.2200,
    )
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers).json()["delivery"]
    requested_urls = []

    class MockResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"routes": [{"distance": 1000, "duration": 300, "geometry": {"type": "LineString", "coordinates": []}}]}

    def fake_get(url, **kwargs):
        requested_urls.append(url)
        return MockResponse()

    monkeypatch.setattr("app.services.routing_service.httpx.get", fake_get)
    to_store = client.get(f"/api/deliveries/{delivery['id']}/route", headers=partner_headers)
    assert to_store.status_code == 200
    assert to_store.json()["pickup_lat"] == pytest.approx(28.6200)
    assert to_store.json()["destination_lat"] == pytest.approx(delivery["pickup_lat"])
    assert "77.22,28.62" in requested_urls[-1]

    assert client.patch(
        f"/api/deliveries/{delivery['id']}/status",
        json={"status": "PICKED_UP"},
        headers=partner_headers,
    ).status_code == 200
    captured_at = datetime.now(timezone.utc).isoformat()
    assert client.post(
        f"/api/deliveries/{delivery['id']}/location",
        json={"latitude": 28.618, "longitude": 77.215, "accuracy_m": 7, "captured_at": captured_at},
        headers=partner_headers,
    ).status_code == 200
    to_customer = client.get(f"/api/deliveries/{delivery['id']}/route", headers=customer_headers)
    assert to_customer.status_code == 200
    assert to_customer.json()["pickup_lat"] == pytest.approx(28.618)
    assert to_customer.json()["destination_lat"] == pytest.approx(delivery["destination_lat"])
    assert "77.215,28.618" in requested_urls[-1]


def test_completed_delivery_rejects_late_location_updates(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "completed-location-partner@example.com",
        "delivery_partner",
        "Completed Location Partner",
        lat=28.6151,
        lng=77.2101,
    )
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery_id = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers).json()["delivery"]["id"]

    assert client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "PICKED_UP"},
        headers=partner_headers,
    ).status_code == 200
    assert client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "OUT_FOR_DELIVERY"},
        headers=partner_headers,
    ).status_code == 200
    assert client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "DELIVERED"},
        headers=partner_headers,
    ).status_code == 200

    late_location = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.617, "longitude": 77.212},
        headers=partner_headers,
    )
    assert late_location.status_code == 409


def test_delivery_assignment_ignores_unavailable_and_coordinate_missing_partners(client, customer_headers, retailer_headers, seeded_product):
    unavailable_headers = auth_headers(
        client,
        "unavailable-partner@example.com",
        "delivery_partner",
        "Unavailable Partner",
        lat=28.6151,
        lng=77.2101,
    )
    missing_location_headers = auth_headers(
        client,
        "missing-location-partner@example.com",
        "delivery_partner",
        "Missing Location Partner",
    )
    usable_headers = auth_headers(
        client,
        "usable-partner@example.com",
        "delivery_partner",
        "Usable Partner",
        lat=28.6200,
        lng=77.2100,
    )
    client.put("/api/delivery-partners/me", json={"is_available": False}, headers=unavailable_headers)
    missing_location_partner = client.get("/api/delivery-partners/me", headers=missing_location_headers).json()
    usable_partner = client.get("/api/delivery-partners/me", headers=usable_headers).json()
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])

    response = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert response.status_code == 200
    assert response.json()["delivery"]["delivery_partner_id"] == usable_partner["id"]
    assert response.json()["delivery"]["delivery_partner_id"] != missing_location_partner["id"]


def test_delivery_assignment_returns_conflict_when_no_partner_available(client, customer_headers, retailer_headers, seeded_product):
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    response = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert response.status_code == 409


def test_unauthorized_tracking_rejected(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "authz-partner@example.com",
        "delivery_partner",
        "Authorized Partner",
        lat=28.6151,
        lng=77.2101,
    )
    other_customer_headers = auth_headers(client, "other-customer@example.com", "customer", "Other Customer")
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery_id = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers).json()["delivery"]["id"]
    assert partner_headers

    response = client.get(f"/api/deliveries/{delivery_id}/tracking", headers=other_customer_headers)
    assert response.status_code == 403


def test_routing_service_error_handling(monkeypatch):
    monkeypatch.setattr(
        "app.services.routing_service.httpx.get",
        lambda *args, **kwargs: (_ for _ in ()).throw(httpx.TimeoutException("timeout")),
    )
    with pytest.raises(HTTPException) as timeout_error:
        get_route(28.6139, 77.2090, 28.615, 77.21)
    assert timeout_error.value.status_code == 503

    class BadStatusResponse:
        def raise_for_status(self):
            raise httpx.HTTPStatusError("bad", request=httpx.Request("GET", "http://test"), response=httpx.Response(500))

    monkeypatch.setattr("app.services.routing_service.httpx.get", lambda *args, **kwargs: BadStatusResponse())
    with pytest.raises(HTTPException) as http_error:
        get_route(28.6139, 77.2090, 28.615, 77.21)
    assert http_error.value.status_code == 503

    class MalformedResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"routes": [{"distance": "bad"}]}

    monkeypatch.setattr("app.services.routing_service.httpx.get", lambda *args, **kwargs: MalformedResponse())
    with pytest.raises(HTTPException) as malformed_error:
        get_route(28.6139, 77.2090, 28.615, 77.21)
    assert malformed_error.value.status_code == 503

    with pytest.raises(HTTPException) as coordinate_error:
        get_route(91, 77.2090, 28.615, 77.21)
    assert coordinate_error.value.status_code == 400


def test_websocket_auth_and_delivery_events(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "socket-partner@example.com",
        "delivery_partner",
        "Socket Partner",
        lat=28.6151,
        lng=77.2101,
    )
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery_id = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers).json()["delivery"]["id"]
    token = partner_headers["Authorization"].split(" ", 1)[1]

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/ws/deliveries/{delivery_id}?token=bad-token"):
            pass

    with client.websocket_connect(f"/api/ws/deliveries/{delivery_id}?token={token}") as websocket:
        status_response = client.patch(
            f"/api/deliveries/{delivery_id}/status",
            json={"status": "PICKED_UP"},
            headers=partner_headers,
        )
        assert status_response.status_code == 200
        status_event = websocket.receive_json()
        assert status_event["event"] == "delivery_status_updated"
        assert status_event["data"]["status"] == "PICKED_UP"

        location_response = client.post(
            f"/api/deliveries/{delivery_id}/location",
            json={"latitude": 28.616, "longitude": 77.211, "source": "DEMO_SIMULATION"},
            headers=partner_headers,
        )
        assert location_response.status_code == 200
        assert location_response.json()["source"] == "DEMO_SIMULATION"
        location_event = websocket.receive_json()
        assert location_event["event"] == "delivery_location_updated"
        assert location_event["data"]["source"] == "DEMO_SIMULATION"

        client.patch(
            f"/api/deliveries/{delivery_id}/status",
            json={"status": "OUT_FOR_DELIVERY"},
            headers=partner_headers,
        )
        websocket.receive_json()
        delivered = client.patch(
            f"/api/deliveries/{delivery_id}/status",
            json={"status": "DELIVERED"},
            headers=partner_headers,
        )
        assert delivered.status_code == 200
        delivered_status = websocket.receive_json()
        completed = websocket.receive_json()
        assert delivered_status["event"] == "delivery_status_updated"
        assert completed["event"] == "delivery_completed"


def test_complete_backend_lifecycle(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "e2e-partner@example.com",
        "delivery_partner",
        "E2E Partner",
        lat=28.6151,
        lng=77.2101,
    )
    order = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": seeded_product["id"], "quantity": 2}],
            "delivery_address": "Lifecycle Address",
            "delivery_lat": 28.6139,
            "delivery_lng": 77.2090,
        },
        headers=customer_headers,
    )
    assert order.status_code == 201
    order_id = order.json()["id"]
    assert order.json()["status"] == "RECEIVED"

    for next_status in ("ACCEPTED", "PREPARING", "READY_FOR_PICKUP"):
        response = client.patch(
            f"/api/orders/{order_id}/status",
            json={"status": next_status},
            headers=retailer_headers,
        )
        assert response.status_code == 200

    delivery = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert delivery.status_code == 200
    delivery_id = delivery.json()["delivery"]["id"]
    assert client.get("/api/delivery-partners/me", headers=partner_headers).json()["is_available"] is False

    token = partner_headers["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/api/ws/deliveries/{delivery_id}?token={token}") as websocket:
        assert client.patch(
            f"/api/deliveries/{delivery_id}/status",
            json={"status": "PICKED_UP"},
            headers=partner_headers,
        ).status_code == 200
        assert websocket.receive_json()["event"] == "delivery_status_updated"
        assert client.patch(
            f"/api/deliveries/{delivery_id}/status",
            json={"status": "OUT_FOR_DELIVERY"},
            headers=partner_headers,
        ).status_code == 200
        assert websocket.receive_json()["event"] == "delivery_status_updated"
        assert client.post(
            f"/api/deliveries/{delivery_id}/location",
            json={"latitude": 28.616, "longitude": 77.211},
            headers=partner_headers,
        ).status_code == 200
        assert websocket.receive_json()["event"] == "delivery_location_updated"
        assert client.patch(
            f"/api/deliveries/{delivery_id}/status",
            json={"status": "DELIVERED"},
            headers=partner_headers,
        ).status_code == 200
        assert websocket.receive_json()["event"] == "delivery_status_updated"
        assert websocket.receive_json()["event"] == "delivery_completed"

    final_order = client.get(f"/api/orders/{order_id}", headers=customer_headers)
    assert final_order.status_code == 200
    assert final_order.json()["status"] == "DELIVERED"
    assert client.get("/api/delivery-partners/me", headers=partner_headers).json()["is_available"] is True
    tracking = client.get(f"/api/deliveries/{delivery_id}/tracking", headers=customer_headers)
    assert tracking.status_code == 200
    assert len(tracking.json()["updates"]) >= 4


def test_delivery_partner_acceptance_and_gps_accuracy(client, customer_headers, retailer_headers, seeded_product):
    partner_headers = auth_headers(
        client,
        "accuracy-partner@example.com",
        "delivery_partner",
        "Accuracy Partner",
        lat=28.6151,
        lng=77.2101,
    )
    order_id = create_ready_order(client, customer_headers, retailer_headers, seeded_product["id"])
    delivery = client.post(f"/api/deliveries/{order_id}/assign", headers=retailer_headers)
    assert delivery.status_code == 200
    delivery_id = delivery.json()["delivery"]["id"]

    accepted = client.patch(
        f"/api/deliveries/{delivery_id}/status",
        json={"status": "ACCEPTED"},
        headers=partner_headers,
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "ACCEPTED"

    location = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.616, "longitude": 77.211, "accuracy_m": 7.25},
        headers=partner_headers,
    )
    assert location.status_code == 200
    assert location.json()["accuracy_m"] == pytest.approx(7.25)

    tracking = client.get(f"/api/deliveries/{delivery_id}/tracking", headers=customer_headers)
    assert tracking.status_code == 200
    assert tracking.json()["updates"][-1]["accuracy_m"] == pytest.approx(7.25)
    assert tracking.json()["updates"][-1]["latitude"] == pytest.approx(28.616)
    assert tracking.json()["updates"][-1]["longitude"] == pytest.approx(77.211)


def test_retailer_order_history_supports_daily_date_bounds(
    client,
    customer_headers,
    retailer_headers,
    seeded_product,
):
    created = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": seeded_product["id"], "quantity": 1}],
            "delivery_address": "Daily dashboard address",
            "delivery_lat": 28.6139,
            "delivery_lng": 77.2090,
        },
        headers=customer_headers,
    )
    assert created.status_code == 201
    order_id = created.json()["id"]

    matching = client.get(
        "/api/orders",
        params={
            "created_from": "2000-01-01T00:00:00Z",
            "created_before": "2100-01-01T00:00:00Z",
        },
        headers=retailer_headers,
    )
    assert matching.status_code == 200
    assert order_id in {order["id"] for order in matching.json()}

    future = client.get(
        "/api/orders",
        params={
            "created_from": "2100-01-01T00:00:00Z",
            "created_before": "2101-01-01T00:00:00Z",
        },
        headers=retailer_headers,
    )
    assert future.status_code == 200
    assert future.json() == []

    invalid = client.get(
        "/api/orders",
        params={
            "created_from": "2026-10-09T00:00:00Z",
            "created_before": "2026-10-08T00:00:00Z",
        },
        headers=retailer_headers,
    )
    assert invalid.status_code == 422
