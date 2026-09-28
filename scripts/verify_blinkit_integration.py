#!/usr/bin/env python3
"""Comprehensive end-to-end verification for BlinkIT dataset pipeline to Retailer UI."""

import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.source_data import SourceDataset, SourceProduct  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.inventory import Inventory  # noqa: E402
from app.models.store import Store  # noqa: E402
from app.models.retailer import Retailer  # noqa: E402
from app.models.user import User  # noqa: E402


def run_verifications():
    print("=================================================================")
    print("BLINKIT PIPELINE & RETAILER INTEGRATION VERIFICATION")
    print("=================================================================")

    db = SessionLocal()
    try:
        # 1. Database layer checks
        print("\n--- 1. Database Layer Staging & Operational Counts ---")
        blinkit_dataset = db.query(SourceDataset).filter(SourceDataset.platform == "blinkit").first()
        assert blinkit_dataset is not None, "BlinkIT source dataset record missing"
        print(f"[OK] Staging Dataset: {blinkit_dataset.platform} ({blinkit_dataset.dataset_handle})")

        staged_count = db.query(SourceProduct).filter(SourceProduct.source_platform == "blinkit").count()
        assert staged_count == 1559, f"Expected 1559 staged BlinkIT records, got {staged_count}"
        print(f"[OK] Staged BlinkIT Source Products: {staged_count}")

        user = db.query(User).filter(User.email == "demo.retailer.central@example.com").first()
        assert user is not None, "Demo retailer user not found"
        retailer = db.query(Retailer).filter(Retailer.user_id == user.id).first()
        assert retailer is not None, "Retailer profile not found"
        store = db.query(Store).filter(Store.retailer_id == retailer.id).first()
        assert store is not None, "Demo Central Mart store not found"
        print(f"[OK] Operational Store: ID {store.id} ('{store.store_name}'), Retailer: '{retailer.name}' ({user.email})")

        store_products = db.query(Product).filter(Product.store_id == store.id).all()
        blinkit_products = [p for p in store_products if "BlinkIT" in (p.description or "")]
        assert len(blinkit_products) == 1559, f"Expected 1559 BlinkIT products in store, got {len(blinkit_products)}"
        print(f"[OK] Operational Products for Store: {len(store_products)} total ({len(blinkit_products)} BlinkIT-derived)")

        inventory_items = (
            db.query(Inventory)
            .join(Product)
            .filter(Inventory.store_id == store.id, Product.description.like("%BlinkIT%"))
            .all()
        )
        assert len(inventory_items) == 1559, f"Expected 1559 inventory rows, got {len(inventory_items)}"
        available_count = sum(1 for inv in inventory_items if inv.is_available and inv.quantity > 0)
        assert available_count == 1559, f"Expected 1559 available inventory items, got {available_count}"
        print(f"[OK] Inventory Items for BlinkIT Products: {len(inventory_items)} synced (100% available with live stock)")

    finally:
        db.close()

    # 2. FastAPI API Client Integration
    print("\n--- 2. Retailer API Endpoints ---")
    client = TestClient(app)

    # Login as retailer
    login_res = client.post(
        "/api/auth/login",
        json={"email": "demo.retailer.central@example.com", "password": "DemoPassword123!"},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    role = login_res.json()["role"]
    assert role == "retailer", f"Expected retailer role, got {role}"
    print(f"[OK] Retailer Login Successful (Role: {role}, Token: {token[:12]}...)")

    headers = {"Authorization": f"Bearer {token}"}

    # Fetch retailer store
    store_res = client.get("/api/retailers/me/store", headers=headers)
    assert store_res.status_code == 200, f"Get store failed: {store_res.text}"
    store_data = store_res.json()
    print(f"[OK] Store Profile API: {store_data['store_name']} (ID: {store_data['id']})")

    # Fetch store products
    products_res = client.get("/api/retailers/me/products", headers=headers)
    assert products_res.status_code == 200, f"Get products failed: {products_res.text}"
    catalog = products_res.json()
    assert len(catalog) >= 1559, f"Expected >= 1559 products, got {len(catalog)}"
    print(f"[OK] Retailer Products API: {len(catalog)} products returned")

    # Verify sample BlinkIT items
    sample = next(p for p in catalog if "BlinkIT" in (p.get("description") or ""))
    print(f"     Sample Item: '{sample['name']}' | Cat: {sample['category']} | Price: Rs {sample['price']} | Stock: {sample['quantity']} | InStock: {sample['is_available']}")
    assert sample["price"] > 0, "Price should be strictly positive"
    assert sample["quantity"] > 0, "Stock quantity should be positive"
    assert sample["is_available"] is True, "Item should be available"

    # 3. Product availability toggle and stock modification test
    print("\n--- 3. Product & Inventory Management API ---")
    patch_res = client.patch(
        f"/api/products/{sample['id']}/availability",
        headers=headers,
        json={"is_available": True, "quantity": 42},
    )
    assert patch_res.status_code == 200, f"Patch availability failed: {patch_res.text}"
    patched = patch_res.json()
    assert patched["quantity"] == 42, f"Expected stock 42, got {patched['quantity']}"
    print(f"[OK] Updated stock quantity for '{patched['name']}' to {patched['quantity']} units")

    # 4. Search API
    print("\n--- 4. Search and Public Catalog API ---")
    search_res = client.get(f"/api/products/search?q={sample['name'][:5]}")
    assert search_res.status_code == 200, f"Search failed: {search_res.text}"
    search_data = search_res.json()
    assert search_data["total"] > 0, "Search should return matching items"
    print(f"[OK] Product Search for '{sample['name'][:5]}': Found {search_data['total']} matches")

    print("\n=================================================================")
    print("ALL BLINKIT INTEGRATION & RETAILER TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")


if __name__ == "__main__":
    run_verifications()
