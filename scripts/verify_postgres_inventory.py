#!/usr/bin/env python3
"""Verify inventory migration behavior against an explicitly isolated PostgreSQL database."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.deps import get_db  # noqa: E402
from app.main import app  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        default=os.getenv("TEST_DATABASE_URL"),
        help="Isolated PostgreSQL URL. Prefer TEST_DATABASE_URL to keep credentials out of shell history.",
    )
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Explicitly permit a remote test database, such as a disposable Neon branch.",
    )
    return parser.parse_args()


def require_isolated_target(database_url: str | None, allow_remote: bool) -> str:
    if not database_url:
        raise SystemExit("TEST_DATABASE_URL is required.")
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgresql", "postgresql+psycopg2"}:
        raise SystemExit("The verification target must be PostgreSQL.")
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"} and not allow_remote:
        raise SystemExit("Refusing a remote database without --allow-remote. Use only an approved disposable branch.")
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return database_url


def main() -> int:
    args = parse_args()
    database_url = require_isolated_target(args.database_url, args.allow_remote)
    engine = create_engine(database_url, pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    schema = inspect(engine)
    columns = {column["name"]: column for column in schema.get_columns("inventory_adjustments")}
    indexes = {index["name"] for index in schema.get_indexes("inventory_adjustments")}
    assert "batch_id" in columns and columns["batch_id"]["nullable"] is True
    assert "actor_user_id" in columns and columns["actor_user_id"]["nullable"] is True
    assert "ix_inventory_adjustments_store_batch" in indexes
    assert "ix_inventory_adjustments_actor_user_id" in indexes
    with engine.connect() as connection:
        assert connection.execute(text("select version_num from alembic_version")).scalar_one() == "20261012_0008"

    app.dependency_overrides[get_db] = override_get_db
    suffix = uuid4().hex[:10]
    try:
        with TestClient(app) as client:
            def register_retailer(label: str) -> dict[str, str]:
                response = client.post(
                    "/api/auth/register",
                    json={
                        "email": f"pg-{label}-{suffix}@example.com",
                        "password": "AcceptanceOnly123!",
                        "role": "retailer",
                        "name": f"Postgres {label} Retailer",
                        "phone": f"90000{suffix[:5]}",
                        "store_name": f"Postgres {label} Store {suffix}",
                        "lat": 28.615,
                        "lng": 77.21,
                    },
                )
                assert response.status_code == 201, response.text
                return {"Authorization": f"Bearer {response.json()['access_token']}"}

            owner = register_retailer("owner")
            other = register_retailer("other")

            legacy = client.post(
                "/api/retailer/inventory/manual",
                headers=owner,
                json={
                    "items": [{
                        "product_name": f"Legacy Readable Rice {suffix}",
                        "quantity": 3,
                        "unit": "pack",
                        "price": 80,
                        "category": "Groceries",
                    }]
                },
            )
            assert legacy.status_code == 201, legacy.text
            assert client.get("/api/retailer/inventory/history", headers=owner).status_code == 200

            confirmation_id = f"pg-replay-{suffix}"
            replay_payload = {
                "confirmation_id": confirmation_id,
                "items": [{
                    "product_name": f"Retry Safe Atta {suffix}",
                    "quantity": 7,
                    "unit": "bag",
                    "price": 240,
                    "category": "Groceries",
                }],
            }
            first = client.post("/api/retailer/inventory/confirm", headers=owner, json=replay_payload)
            replay = client.post("/api/retailer/inventory/confirm", headers=owner, json=replay_payload)
            assert first.status_code == 201 and replay.status_code == 201
            assert replay.json() == first.json()
            product_id = first.json()[0]["product_id"]
            products = client.get("/api/retailers/me/products", headers=owner).json()
            assert next(row for row in products if row["id"] == product_id)["quantity"] == 7

            cross_store = client.post(
                "/api/retailer/inventory/confirm",
                headers=other,
                json={
                    "confirmation_id": f"pg-isolation-{suffix}",
                    "items": [{
                        "product_name": f"Foreign Product {suffix}",
                        "existing_product_id": product_id,
                        "quantity": 5,
                        "unit": "pack",
                        "price": 10,
                    }],
                },
            )
            assert cross_store.status_code == 404

            adjustment_payload = {
                "product_id": product_id,
                "direction": "ADD",
                "quantity": 4,
                "reason": "NEW_STOCK_RECEIVED",
                "source": "PRODUCT_PHOTO",
                "confirmation_id": f"pg-adjust-{suffix}",
            }
            adjusted = client.post("/api/retailer/inventory/adjust", headers=owner, json=adjustment_payload)
            replayed_adjustment = client.post("/api/retailer/inventory/adjust", headers=owner, json=adjustment_payload)
            assert adjusted.status_code == 200 and replayed_adjustment.status_code == 200
            assert adjusted.json() == replayed_adjustment.json()
            assert adjusted.json()["quantity_before"] == 7
            assert adjusted.json()["quantity_after"] == 11

            insufficient = client.post(
                "/api/retailer/inventory/adjust",
                headers=owner,
                json={
                    "product_id": product_id,
                    "direction": "REDUCE",
                    "quantity": 12,
                    "reason": "DAMAGED_PRODUCT",
                    "confirmation_id": f"pg-insufficient-{suffix}",
                },
            )
            assert insufficient.status_code == 409
            products_after_insufficient = client.get("/api/retailers/me/products", headers=owner).json()
            assert next(row for row in products_after_insufficient if row["id"] == product_id)["quantity"] == 11

            isolated_adjustment = client.post(
                "/api/retailer/inventory/adjust",
                headers=other,
                json={
                    "product_id": product_id,
                    "direction": "ADD",
                    "quantity": 1,
                    "reason": "MANUAL_CORRECTION",
                    "confirmation_id": f"pg-adjust-isolation-{suffix}",
                },
            )
            assert isolated_adjustment.status_code == 404

            rollback_name = f"Rollback Marker {suffix}"
            rollback = client.post(
                "/api/retailer/inventory/confirm",
                headers=owner,
                json={
                    "confirmation_id": f"pg-rollback-{suffix}",
                    "items": [
                        {"product_name": rollback_name, "quantity": 2, "unit": "pack", "price": 20},
                        {
                            "product_name": f"Missing Match {suffix}",
                            "existing_product_id": 2147483647,
                            "quantity": 1,
                            "unit": "pack",
                            "price": 20,
                        },
                    ],
                },
            )
            assert rollback.status_code == 404
            products_after = client.get("/api/retailers/me/products", headers=owner).json()
            assert all(row["name"] != rollback_name for row in products_after)
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()

    print("PostgreSQL inventory verification passed: schema, actor audit, replay, adjustment safety, isolation, and rollback.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
