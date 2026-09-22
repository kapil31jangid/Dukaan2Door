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

BlinkIT is preserved as source data because it does not provide real order IDs and does not provide product names in the downloaded file. The downloaded file has repeated `Item Identifier` values across outlet/sales rows, so ingestion stages one row per unique source item identifier and treats repeats as duplicates.

Instacart:

`products.csv` + `aisles.csv` + `departments.csv` -> `source_products`

`orders.csv` -> `source_orders`

`order_products__prior.csv` and `order_products__train.csv` -> `source_order_items`

## Instacart Subset

The full Instacart order-product data is large. The ingestion script selects a deterministic subset:

- first 10,000 rows from `orders.csv` in original file order
- matching order-product rows from `order_products__prior.csv` and `order_products__train.csv`
- all product catalog rows from `products.csv`

No new orders, users, products, prices, coordinates, stores, or relationships are generated.

## Application Table Mapping

The current ingestion does not insert external rows into Dukaan2Door application tables such as:

- `products`
- `inventory`
- `stores`
- `customers`
- `orders`
- `order_items`

Reason: the downloaded sources do not contain enough real Dukaan2Door-compatible store/customer/location data. Inserting into application tables would require inventing retailers, stores, store coordinates, customers, or delivery addresses, which is not allowed.

## Commands

Apply migrations:

```bash
cd backend
python -m alembic upgrade head
```

Ingest:

```bash
cd ..
python scripts/ingest_all.py
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

Backend 2 must not fabricate geographic coordinates from these datasets.
