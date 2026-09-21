def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_auth_register(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "Password123",
            "role": "customer",
            "name": "Test User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "customer"


def test_customer_me_unauthorized(client):
    response = client.get("/api/customers/me")
    assert response.status_code == 401


def test_customer_me_authorized(client, customer_headers):
    response = client.get("/api/customers/me", headers=customer_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Sample Customer"


def test_customer_role_guard_on_retailer_route(client, customer_headers):
    response = client.get("/api/retailers/me", headers=customer_headers)
    assert response.status_code == 403


def test_product_search(client):
    response = client.get("/api/products/search?q=apple")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


def test_order_creation(client, customer_headers):
    response = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": 1, "quantity": 2}],
            "delivery_address": "123 Test St",
            "delivery_lat": 28.61,
            "delivery_lng": 77.20,
        },
        headers=customer_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "RECEIVED"
