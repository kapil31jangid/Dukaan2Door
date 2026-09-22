import math

import pytest
from fastapi import HTTPException

from app.models.delivery_partner import DeliveryPartner
from app.services.geo_service import calculate_distance_km


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
            "description": "Backend 2 test product",
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


def test_geo_distance_same_coordinate_and_known_distance():
    assert calculate_distance_km(28.6139, 77.2090, 28.6139, 77.2090) == pytest.approx(0)
    delhi_to_noida = calculate_distance_km(28.6139, 77.2090, 28.5355, 77.3910)
    assert delhi_to_noida == pytest.approx(19.6, rel=0.15)


def test_geo_invalid_coordinate():
    with pytest.raises(HTTPException):
        calculate_distance_km(91, 77.2090, 28.5355, 77.3910)


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

    response = client.post(
        f"/api/deliveries/{delivery_id}/location",
        json={"latitude": 28.617, "longitude": 77.212},
        headers=partner_headers,
    )
    assert response.status_code == 200
    partner = db_session.query(DeliveryPartner).filter(DeliveryPartner.id == partner_id).first()
    assert math.isclose(partner.current_lat, 28.617)
    assert math.isclose(partner.current_lng, 77.212)
