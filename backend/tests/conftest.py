import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.db.base import Base
from app.main import app
from app.models import *  # noqa: F403
from app.services.auth_service import create_user_with_profile


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def customer_headers(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "customer@example.com",
            "password": "Password123",
            "role": "customer",
            "name": "Sample Customer",
            "phone": "9876543210",
            "delivery_address": "123 Main St",
            "lat": 28.6139,
            "lng": 77.2090,
        },
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def retailer_headers(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "retailer@example.com",
            "password": "Password123",
            "role": "retailer",
            "name": "Sample Retailer",
            "phone": "9876543211",
            "store_name": "Fresh Mart",
            "lat": 28.615,
            "lng": 77.21,
        },
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def delivery_partner_headers(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "delivery@example.com",
            "password": "Password123",
            "role": "delivery_partner",
            "name": "Sample Delivery Partner",
            "phone": "9876543212",
            "vehicle_info": "Honda Activa DL-01-AB-1234",
        },
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def seeded_product(client, retailer_headers):
    response = client.post(
        "/api/products",
        json={
            "name": "Fresh Product",
            "description": "Quality catalog item",
            "category": "Groceries",
            "price": 29.99,
            "initial_stock": 25,
            "is_available": True,
        },
        headers=retailer_headers,
    )
    return response.json()
