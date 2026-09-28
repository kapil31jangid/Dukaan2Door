# Dukaan2Door Data Assets

Raw files are downloaded from the exact Kaggle dataset handles requested for this project and must not be edited.

Instamart dataset not included because no verified source URL was provided.

| Dataset | Source | License | Purpose | Imported Tables | Limitations |
| --- | --- | --- | --- | --- | --- |
| Zepto Inventory | `palvinder2006/zepto-inventory-dataset` | MIT | Product catalog plus available quantity fields | `source_datasets`, `source_products`, `source_inventory` | No store locations, no retailer identity, no customer/order/delivery data |
| BlinkIT Grocery Sales | `lavudyaswamy/blinkit-grocery-sales-dataset-excel` | CC0-1.0 | Grocery product catalog & outlet pricing | `source_datasets`, `source_products`, `products` (via import), `inventory` (via import) | Catalog and pricing data; imported into controlled demo store for operational testing |
| Instacart Market Basket Analysis | `psparks/instacart-market-basket-analysis` | CC0-1.0 | Real anonymized orders and order-product relationships | `source_datasets`, `source_products`, `source_orders`, `source_order_items` | No prices, no store locations, no delivery/customer address coordinates |
| BigBasket Products | `chinmayshanbhag/big-basket-products` | CC0-1.0 | Indian grocery product catalog | `source_datasets`, `source_products` | Product catalog only; package quantity is not stock quantity; no stores/orders/coordinates |

## Directory Layout

- `raw/`: original downloaded files; ignored by git.
- `staging/`: temporary working files; ignored by git.
- `processed/`: generated transformed files; ignored by git.
- `metadata/`: committed metadata and profiling reports.

## Commands

Download:

```bash
python scripts/download_datasets.py
```

Profile:

```bash
python scripts/profile_datasets.py
```

Ingest source/staging tables:

```bash
cd backend
python -m alembic upgrade head
cd ..
python scripts/ingest_all.py
```

Import BlinkIT catalog to operational store:

```bash
python scripts/import_blinkit_to_store.py
```

Verify:

```bash
python scripts/verify_ingestion.py
```

## Mapping Policy

External datasets are staged in `source_*` tables first. The BlinkIT product catalog is promoted to operational `products` and `inventory` using `scripts/import_blinkit_to_store.py` and mapped to the controlled demo store (`Demo Central Mart`, owned by `demo.retailer.central@example.com`), preserving full source provenance without creating fake geographic coordinates.

Operational demo records are separate application records used to exercise the live workflow. They are not sourced from Kaggle and are not presented as real stores, customers, or delivery partners.
