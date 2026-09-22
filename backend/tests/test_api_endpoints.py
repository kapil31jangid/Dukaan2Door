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


def test_auth_duplicate_email_rejected(client):
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123",
        "role": "customer",
        "name": "Test User",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 409


def test_login_verifies_database_password(client):
    payload = {
        "email": "login@example.com",
        "password": "Password123",
        "role": "customer",
        "name": "Login User",
    }
    register_response = client.post("/api/auth/register", json=payload)
    assert register_response.status_code == 201

    bad_response = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "WrongPassword"},
    )
    assert bad_response.status_code == 401

    good_response = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "Password123"},
    )
    assert good_response.status_code == 200
    assert good_response.json()["user_id"] == register_response.json()["user_id"]


def test_auth_me_loads_actual_user(client, customer_headers):
    response = client.get("/api/auth/me", headers=customer_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "customer@example.com"
    assert data["name"] == "Sample Customer"


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


def test_product_search(client, seeded_product):
    response = client.get("/api/products/search?q=apple")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0

    response = client.get("/api/products/search?q=Fresh")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1


def test_order_creation(client, customer_headers, seeded_product):
    response = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": seeded_product["id"], "quantity": 2}],
            "delivery_address": "123 Test St",
            "delivery_lat": 28.61,
            "delivery_lng": 77.20,
        },
        headers=customer_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "RECEIVED"
    assert data["items"][0]["product_id"] == seeded_product["id"]


def test_order_status_uses_actual_database_status(client, customer_headers, retailer_headers, seeded_product):
    order_response = client.post(
        "/api/orders",
        json={
            "items": [{"product_id": seeded_product["id"], "quantity": 1}],
            "delivery_address": "123 Test St",
            "delivery_lat": 28.61,
            "delivery_lng": 77.20,
        },
        headers=customer_headers,
    )
    order_id = order_response.json()["id"]

    accepted = client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "ACCEPTED"},
        headers=retailer_headers,
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "ACCEPTED"

    delivered = client.patch(
        f"/api/orders/{order_id}/status",
        json={"status": "DELIVERED"},
        headers=retailer_headers,
    )
    assert delivered.status_code == 409
