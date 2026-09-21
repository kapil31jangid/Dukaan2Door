import pytest
from fastapi.testclient import TestClient
from app.core.security import create_access_token
from app.main import app


@pytest.fixture
def client():
    """FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def customer_token():
    return create_access_token(subject=1, role="customer")


@pytest.fixture
def retailer_token():
    return create_access_token(subject=2, role="retailer")


@pytest.fixture
def delivery_partner_token():
    return create_access_token(subject=3, role="delivery_partner")


@pytest.fixture
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


@pytest.fixture
def retailer_headers(retailer_token):
    return {"Authorization": f"Bearer {retailer_token}"}


@pytest.fixture
def delivery_partner_headers(delivery_partner_token):
    return {"Authorization": f"Bearer {delivery_partner_token}"}
