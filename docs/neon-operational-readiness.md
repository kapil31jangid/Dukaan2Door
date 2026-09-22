# Neon Operational Readiness

This document records the current live Neon readiness state for the Dukaan2Door backend.

## Schema State

- Alembic repository head: `20260922_0002`
- Live Neon Alembic revision: `20260922_0002`
- Schema alignment method: non-destructive column/type/constraint alignment followed by Alembic stamp after model-column verification passed
- Destructive reset performed: no

The live schema was verified against the current SQLAlchemy metadata for the operational and source-data tables.

## Operational Demo Data

The operational demo dataset is fictional application data. It is used only to demonstrate the backend workflow and is not derived from the external Kaggle source datasets.

The seeded demo records cover:

- customer profiles with usable delivery coordinates
- retailer/store profiles with valid pickup coordinates
- product records scoped to stores
- inventory records with available and unavailable stock cases
- delivery partners with valid current coordinates

The demo inventory supports:

- eligible store within 2 km
- 5 km fallback when no 2 km store can fulfill an item
- nearby store/product combinations that fail due to unavailable inventory
- no-store-available behavior outside the fallback radius

## Source/Staging Data

The real external datasets remain in staging/source tables:

- `source_datasets`
- `source_products`
- `source_inventory`
- `source_orders`
- `source_order_items`

These tables preserve provenance from the real source datasets and are kept separate from operational application records because the datasets do not provide complete Dukaan2Door-compatible store, customer, retailer, delivery partner, and coordinate information.

## Verification Commands

```bash
cd backend
python -m alembic heads
python -m alembic current
cd ..
python scripts/seed_operational_demo.py
python scripts/verify_neon_demo_workflow.py
cd backend
python -m pytest -q
```

## Verified Workflow

The Neon-backed verification script exercises:

- customer login
- product/inventory lookup
- 2 km store matching
- 5 km fallback matching
- unavailable/no-store matching failures
- API order creation
- inventory decrement
- retailer status transitions
- delivery assignment
- delivery partner status transitions
- location tracking persistence
- final delivered order state

WebSocket event broadcasting is covered by the automated backend integration tests. Runtime broadcasting uses in-memory connection management and is suitable for a single Render service instance. A multi-instance deployment would require shared pub/sub infrastructure.

## Safety Notes

- No database drop, truncate, full reset, or destructive migration was used.
- Existing operational and source/staging rows were preserved.
- Secrets remain environment-driven and are not committed.
