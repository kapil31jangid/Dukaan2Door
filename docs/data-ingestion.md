# Data Ingestion

This project uses real data only from the exact Kaggle sources listed below:

1. Zepto Inventory: `palvinder2006/zepto-inventory-dataset`
2. BlinkIT Grocery Sales: `lavudyaswamy/blinkit-grocery-sales-dataset-excel`
3. Instacart Market Basket Analysis: `psparks/instacart-market-basket-analysis`
4. BigBasket Products: `chinmayshanbhag/big-basket-products`

Instamart dataset not included because no verified source URL was provided.

## Download Process

Use the official Kaggle CLI:

```bash
python scripts/download_datasets.py
```

Do not commit Kaggle credentials, raw CSV/XLSX files, or ZIP archives.

## Raw Data Structure

Raw files are stored under:

- `data/raw/zepto`
- `data/raw/blinkit`
- `data/raw/instacart`
- `data/raw/bigbasket`

Raw files are immutable and git-ignored.

## Profiling

Run:

```bash
python scripts/profile_datasets.py
```

Outputs:

- `data/metadata/datasets.json`
- `data/metadata/dataset_profile.md`
- `data/metadata/instacart_subset.md`

## Staging Structure

The ingestion layer uses source/staging tables:

- `source_datasets`
- `source_products`
- `source_inventory`
- `source_orders`
- `source_order_items`

These preserve:

- `source_platform`
- `source_dataset`
- original source IDs
- raw source row data

## Database Mapping

Zepto:

`zepto_v2.csv` -> `source_products`, `source_inventory`

BigBasket:

`BigBasket.csv` -> `source_products`

BlinkIT:

`BlinkIT Grocery Data Excel (1).xlsx` -> `source_products`

The BlinkIT grocery dataset contains 1,559 unique item catalog items (identified by `Item Identifier` such as `FDX32`, `NCB42`, `FDR28`, etc.) with categories (`Item Type`), fat content, item weights, and prices (`Sales`). Ingestion stages one record per unique item identifier with normalized name `Category (Item Identifier)`, price, unit weight, and raw metadata.

## Application Table Mapping & Retailer Integration

To expose the BlinkIT catalog in the Dukaan2Door operational application without inventing fake stores or locations:

- The normalization script `scripts/import_blinkit_to_store.py` promotes the 1,559 BlinkIT staged records from `source_products` into operational application `products` and `inventory` tables.
- The imported catalog is associated with the project's existing controlled operational demo store (`Demo Central Mart`, owned by `demo.retailer.central@example.com`).
- Each product preserves source provenance in its description: `"Imported catalog item originating from BlinkIT dataset ({source_product_id}). Associated with {store_name} for operational testing."`
- Initial controlled inventory stock (25 units, `is_available = True`) is created in the `inventory` table.
- The import is completely idempotent: re-running updates existing records without creating duplicates.

> **Important Architecture Rule:**
> BlinkIT source data is used as product/catalog source data. It does not represent actual BlinkIT operational stores, customers, or delivery partners within Dukaan2Door.

## Commands

Apply migrations:

```bash
cd backend
python -m alembic upgrade head
```

Ingest source/staging tables:

```bash
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

The latest ingestion summary is stored in:

- `data/metadata/ingestion_report.json`
- `data/metadata/ingestion_report.md`

Run backend tests:

```bash
cd backend
python -m pytest -q
```

## Store Matching Compatibility

The staged datasets can support product and inventory analysis, but they cannot directly support 2 km -> 5 km geographic store matching because:

- Zepto file has product category/name/price/available quantity fields, but no store latitude/longitude.
- BigBasket file has product catalog fields, but no store latitude/longitude.
- BlinkIT file has outlet identifiers and outlet location type tiers, but no coordinates.
- Instacart has anonymized user/order/product relationships, but no store/customer coordinates.

The backend must not fabricate geographic coordinates from these datasets.
