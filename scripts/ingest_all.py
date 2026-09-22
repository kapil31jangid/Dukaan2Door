import csv
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))

from app.db.session import SessionLocal  # noqa: E402
from app.models.source_data import (  # noqa: E402
    SourceDataset,
    SourceInventory,
    SourceOrder,
    SourceOrderItem,
    SourceProduct,
)
from dataset_sources import DATASETS, INSTACART_SUBSET_ORDER_LIMIT  # noqa: E402


def clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value):
        return None
    return value


def to_float(value: Any) -> Optional[float]:
    value = clean(value)
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def to_int(value: Any) -> Optional[int]:
    number = to_float(value)
    if number is None:
        return None
    return int(number)


def row_dicts_csv(path: Path, encoding: str = "utf-8-sig") -> Iterable[dict[str, Any]]:
    with path.open(newline="", encoding=encoding) as fh:
        yield from csv.DictReader(fh)


def upsert_dataset(db, key: str) -> None:
    dataset = DATASETS[key]
    record = db.query(SourceDataset).filter(SourceDataset.platform == dataset["platform"]).first()
    values = {
        "platform": dataset["platform"],
        "provider": dataset["provider"],
        "dataset_handle": dataset["handle"],
        "source_url": dataset["url"],
        "license": dataset["license"],
        "downloaded_at": datetime.now(timezone.utc).replace(tzinfo=None),
        "notes": "Instamart dataset not included because no verified source URL was provided."
        if key == "instacart"
        else None,
    }
    if record:
        for field, value in values.items():
            setattr(record, field, value)
    else:
        db.add(SourceDataset(**values))


def existing_values(db, model, platform: str, column_name: str) -> set[Any]:
    column = getattr(model, column_name)
    return {
        value
        for (value,) in db.query(column).filter(model.source_platform == platform).all()
    }


def commit_periodically(db, count: int, interval: int = 1_000) -> None:
    if count and count % interval == 0:
        db.commit()


def ingest_zepto(db) -> dict[str, int]:
    path = DATASETS["zepto"]["raw_dir"] / "zepto_v2.csv"
    counts = {"staged_products": 0, "staged_inventory": 0, "duplicates": 0, "errors": 0}
    existing_products = existing_values(db, SourceProduct, "zepto", "source_product_id")
    existing_inventory = existing_values(db, SourceInventory, "zepto", "source_record_id")
    for index, row in enumerate(row_dicts_csv(path, encoding="latin1"), start=1):
        source_id = f"zepto_v2_row_{index}"
        if source_id in existing_products:
            counts["duplicates"] += 1
            continue
        availability = "out_of_stock" if str(row.get("outOfStock", "")).lower() == "true" else "available"
        db.add(
            SourceProduct(
                source_platform="zepto",
                source_dataset=DATASETS["zepto"]["handle"],
                source_product_id=source_id,
                product_name=clean(row.get("name")),
                category=clean(row.get("Category")),
                unit=str(clean(row.get("weightInGms"))) if clean(row.get("weightInGms")) is not None else None,
                price=to_float(row.get("discountedSellingPrice")),
                mrp=to_float(row.get("mrp")),
                availability=availability,
                raw_data=row,
            )
        )
        if source_id not in existing_inventory:
            db.add(
                SourceInventory(
                    source_platform="zepto",
                    source_dataset=DATASETS["zepto"]["handle"],
                    source_record_id=source_id,
                    source_product_id=source_id,
                    quantity=to_int(row.get("availableQuantity")),
                    availability=availability,
                    raw_data=row,
                )
            )
            counts["staged_inventory"] += 1
        existing_products.add(source_id)
        counts["staged_products"] += 1
        commit_periodically(db, counts["staged_products"])
    db.commit()
    return counts


def ingest_bigbasket(db) -> dict[str, int]:
    path = DATASETS["bigbasket"]["raw_dir"] / "BigBasket.csv"
    counts = {"staged_products": 0, "duplicates": 0, "errors": 0}
    existing_products = existing_values(db, SourceProduct, "bigbasket", "source_product_id")
    for index, row in enumerate(row_dicts_csv(path), start=1):
        source_id = clean(row.get("Absolute_Url")) or f"bigbasket_row_{index}"
        if str(source_id) in existing_products:
            counts["duplicates"] += 1
            continue
        db.add(
            SourceProduct(
                source_platform="bigbasket",
                source_dataset=DATASETS["bigbasket"]["handle"],
                source_product_id=str(source_id),
                product_name=clean(row.get("ProductName")),
                category=clean(row.get("Category")),
                subcategory=clean(row.get("SubCategory")),
                brand=clean(row.get("Brand")),
                unit=clean(row.get("Quantity")),
                price=to_float(row.get("DiscountPrice")),
                mrp=to_float(row.get("Price")),
                raw_data=row,
            )
        )
        existing_products.add(str(source_id))
        counts["staged_products"] += 1
        commit_periodically(db, counts["staged_products"])
    db.commit()
    return counts


def ingest_blinkit(db) -> dict[str, int]:
    path = DATASETS["blinkit"]["raw_dir"] / "BlinkIT Grocery Data Excel (1).xlsx"
    df = pd.read_excel(path, sheet_name="BlinkIT Grocery Data")
    counts = {"staged_products": 0, "duplicates": 0, "errors": 0}
    existing_products = existing_values(db, SourceProduct, "blinkit", "source_product_id")
    for index, row in df.iterrows():
        data = {key: clean(value) for key, value in row.to_dict().items()}
        item_id = data.get("Item Identifier") or f"blinkit_row_{index + 1}"
        if str(item_id) in existing_products:
            counts["duplicates"] += 1
            continue
        db.add(
            SourceProduct(
                source_platform="blinkit",
                source_dataset=DATASETS["blinkit"]["handle"],
                source_product_id=str(item_id),
                product_name=None,
                category=clean(data.get("Item Type")),
                unit=str(clean(data.get("Item Weight"))) if clean(data.get("Item Weight")) is not None else None,
                price=None,
                mrp=None,
                raw_data=data,
            )
        )
        existing_products.add(str(item_id))
        counts["staged_products"] += 1
        commit_periodically(db, counts["staged_products"])
    db.commit()
    return counts


def load_instacart_lookup() -> tuple[dict[str, str], dict[str, str]]:
    aisles = {row["aisle_id"]: row["aisle"] for row in row_dicts_csv(DATASETS["instacart"]["raw_dir"] / "aisles.csv")}
    departments = {
        row["department_id"]: row["department"]
        for row in row_dicts_csv(DATASETS["instacart"]["raw_dir"] / "departments.csv")
    }
    return aisles, departments


def ingest_instacart_products(db) -> dict[str, int]:
    aisles, departments = load_instacart_lookup()
    counts = {"staged_products": 0, "duplicates": 0, "errors": 0}
    existing_products = existing_values(db, SourceProduct, "instacart", "source_product_id")
    for row in row_dicts_csv(DATASETS["instacart"]["raw_dir"] / "products.csv"):
        source_id = row["product_id"]
        if source_id in existing_products:
            counts["duplicates"] += 1
            continue
        raw = {
            **row,
            "aisle": aisles.get(row.get("aisle_id")),
            "department": departments.get(row.get("department_id")),
        }
        db.add(
            SourceProduct(
                source_platform="instacart",
                source_dataset=DATASETS["instacart"]["handle"],
                source_product_id=source_id,
                product_name=clean(row.get("product_name")),
                category=departments.get(row.get("department_id")),
                subcategory=aisles.get(row.get("aisle_id")),
                raw_data=raw,
            )
        )
        existing_products.add(source_id)
        counts["staged_products"] += 1
        commit_periodically(db, counts["staged_products"])
    db.commit()
    return counts


def ingest_instacart_orders(db) -> tuple[dict[str, int], set[str]]:
    counts = {"staged_orders": 0, "duplicates": 0, "errors": 0}
    selected_order_ids: set[str] = set()
    existing_orders = existing_values(db, SourceOrder, "instacart", "source_order_id")
    for row in row_dicts_csv(DATASETS["instacart"]["raw_dir"] / "orders.csv"):
        if len(selected_order_ids) >= INSTACART_SUBSET_ORDER_LIMIT:
            break
        source_id = row["order_id"]
        selected_order_ids.add(source_id)
        if source_id in existing_orders:
            counts["duplicates"] += 1
            continue
        db.add(
            SourceOrder(
                source_platform="instacart",
                source_dataset=DATASETS["instacart"]["handle"],
                source_order_id=source_id,
                source_user_id=clean(row.get("user_id")),
                order_number=to_int(row.get("order_number")),
                order_dow=to_int(row.get("order_dow")),
                order_hour_of_day=to_int(row.get("order_hour_of_day")),
                days_since_prior_order=to_float(row.get("days_since_prior_order")),
                eval_set=clean(row.get("eval_set")),
                raw_data=row,
            )
        )
        existing_orders.add(source_id)
        counts["staged_orders"] += 1
        commit_periodically(db, counts["staged_orders"])
    db.commit()
    return counts, selected_order_ids


def ingest_instacart_order_items(db, selected_order_ids: set[str]) -> dict[str, int]:
    counts = {"staged_order_items": 0, "duplicates": 0, "errors": 0}
    existing_items = {
        (order_id, product_id, cart_order)
        for order_id, product_id, cart_order in db.query(
            SourceOrderItem.source_order_id,
            SourceOrderItem.source_product_id,
            SourceOrderItem.add_to_cart_order,
        )
        .filter(SourceOrderItem.source_platform == "instacart")
        .all()
    }
    for filename in ("order_products__prior.csv", "order_products__train.csv"):
        for row in row_dicts_csv(DATASETS["instacart"]["raw_dir"] / filename):
            if row["order_id"] not in selected_order_ids:
                continue
            key = (row["order_id"], row["product_id"], to_int(row.get("add_to_cart_order")))
            if key in existing_items:
                counts["duplicates"] += 1
                continue
            db.add(
                SourceOrderItem(
                    source_platform="instacart",
                    source_dataset=f"{DATASETS['instacart']['handle']}:{filename}",
                    source_order_id=row["order_id"],
                    source_product_id=row["product_id"],
                    add_to_cart_order=to_int(row.get("add_to_cart_order")),
                    reordered=to_int(row.get("reordered")),
                    raw_data=row,
                )
            )
            existing_items.add(key)
            counts["staged_order_items"] += 1
            commit_periodically(db, counts["staged_order_items"])
        db.commit()
    return counts


def main() -> None:
    db = SessionLocal()
    try:
        for key in DATASETS:
            upsert_dataset(db, key)
        db.commit()

        results = {
            "zepto": ingest_zepto(db),
            "bigbasket": ingest_bigbasket(db),
            "blinkit": ingest_blinkit(db),
        }
        instacart_products = ingest_instacart_products(db)
        instacart_orders, selected_order_ids = ingest_instacart_orders(db)
        instacart_items = ingest_instacart_order_items(db, selected_order_ids)
        results["instacart"] = {
            **instacart_products,
            **instacart_orders,
            **instacart_items,
            "selected_order_ids": len(selected_order_ids),
        }
        print(results)
    finally:
        db.close()


if __name__ == "__main__":
    main()
