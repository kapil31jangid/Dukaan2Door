import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from dataset_sources import DATASETS, INSTACART_SUBSET_ORDER_LIMIT, METADATA_DIR


def file_info(path: Path) -> dict[str, Any]:
    return {
        "filename": path.name,
        "path": str(path),
        "size_bytes": path.stat().st_size,
        "file_type": path.suffix.lower().lstrip("."),
    }


def read_csv_sample(path: Path, sample_limit: int = 3) -> tuple[list[str], list[dict[str, Any]], int]:
    for encoding in ("utf-8-sig", "utf-8", "latin1"):
        try:
            with path.open(newline="", encoding=encoding) as fh:
                reader = csv.DictReader(fh)
                rows = 0
                sample = []
                for row in reader:
                    rows += 1
                    if len(sample) < sample_limit:
                        sample.append(row)
            return reader.fieldnames or [], sample, rows
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"Could not decode {path}")


def profile_tabular(path: Path) -> dict[str, Any]:
    profile: dict[str, Any] = {"file": file_info(path)}
    if path.suffix.lower() == ".csv":
        columns, sample, row_count = read_csv_sample(path)
        profile.update({"rows": row_count, "columns": columns, "sample_records": sample})
        if row_count <= 100_000:
            df = pd.read_csv(path, encoding="latin1" if path.name == "zepto_v2.csv" else "utf-8-sig")
            profile["dtypes"] = {col: str(dtype) for col, dtype in df.dtypes.items()}
            profile["null_counts"] = df.isna().sum().to_dict()
            profile["duplicate_rows"] = int(df.duplicated().sum())
            profile["unique_counts"] = {col: int(df[col].nunique(dropna=True)) for col in df.columns}
        else:
            profile["dtypes"] = {}
            profile["null_counts"] = "skipped_for_large_file"
            profile["duplicate_rows"] = "skipped_for_large_file"
            profile["unique_counts"] = "skipped_for_large_file"
    elif path.suffix.lower() in {".xlsx", ".xls"}:
        xls = pd.ExcelFile(path)
        sheets = {}
        for sheet in xls.sheet_names:
            df = pd.read_excel(path, sheet_name=sheet)
            sheets[sheet] = {
                "rows": int(len(df)),
                "columns": list(df.columns),
                "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "null_counts": df.isna().sum().to_dict(),
                "duplicate_rows": int(df.duplicated().sum()),
                "unique_counts": {col: int(df[col].nunique(dropna=True)) for col in df.columns},
                "sample_records": json.loads(df.head(3).to_json(orient="records")),
            }
        profile["sheets"] = sheets
    return profile


def detect_fields(columns: list[str]) -> dict[str, list[str]]:
    lowered = {col.lower(): col for col in columns}
    groups = {
        "price_fields": ["price", "mrp", "discountprice", "discountedsellingprice", "sales"],
        "product_fields": ["productname", "product_name", "name", "item identifier"],
        "category_fields": ["category", "subcategory", "department", "aisle", "item type"],
        "inventory_fields": ["availablequantity", "quantity", "outofstock"],
        "order_fields": ["order_id", "user_id", "order_number", "eval_set"],
        "customer_fields": ["user_id"],
        "store_fields": ["outlet identifier", "outlet location type", "outlet size", "outlet type"],
        "geographic_fields": ["lat", "lng", "latitude", "longitude"],
    }
    return {
        group: [lowered[name] for name in names if name in lowered]
        for group, names in groups.items()
    }


def flatten_columns(profile: dict[str, Any]) -> list[str]:
    if "columns" in profile:
        return profile["columns"]
    columns: list[str] = []
    for sheet in profile.get("sheets", {}).values():
        columns.extend(sheet.get("columns", []))
    return columns


def main() -> None:
    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    metadata = []
    profiles = {}

    for key, dataset in DATASETS.items():
        files = sorted(path for path in dataset["raw_dir"].glob("*") if path.is_file())
        dataset_metadata = {
            "platform": dataset["platform"],
            "provider": dataset["provider"],
            "dataset": dataset["handle"],
            "source_url": dataset["url"],
            "license": dataset["license"],
            "download_date": generated_at,
            "files": [file_info(path) for path in files],
        }
        metadata.append(dataset_metadata)

        profiles[key] = []
        for path in files:
            profile = profile_tabular(path)
            profile["detected_fields"] = detect_fields(flatten_columns(profile))
            profiles[key].append(profile)

    (METADATA_DIR / "datasets.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    lines = ["# Dataset Profile", "", f"Generated at: {generated_at}", ""]
    for key, dataset_profiles in profiles.items():
        lines.extend([f"## {key.title()}", ""])
        for profile in dataset_profiles:
            lines.append(f"### {profile['file']['filename']}")
            lines.append(f"- Size: {profile['file']['size_bytes']} bytes")
            if "rows" in profile:
                lines.append(f"- Rows: {profile['rows']}")
                lines.append(f"- Columns: {profile['columns']}")
                lines.append(f"- Null counts: {profile['null_counts']}")
                lines.append(f"- Duplicate rows: {profile['duplicate_rows']}")
            else:
                for sheet, sheet_profile in profile.get("sheets", {}).items():
                    lines.append(f"- Sheet `{sheet}` rows: {sheet_profile['rows']}")
                    lines.append(f"- Sheet `{sheet}` columns: {sheet_profile['columns']}")
                    lines.append(f"- Sheet `{sheet}` null counts: {sheet_profile['null_counts']}")
                    lines.append(f"- Sheet `{sheet}` duplicate rows: {sheet_profile['duplicate_rows']}")
            lines.append(f"- Detected fields: {profile['detected_fields']}")
            lines.append("")

    (METADATA_DIR / "dataset_profile.md").write_text("\n".join(lines), encoding="utf-8")

    subset_doc = f"""# Instacart Deterministic Subset

Original source files are preserved in `data/raw/instacart/`.

The full Instacart source contains millions of orders/order-items and should not be blindly loaded into Neon.

Subset rule for ingestion scripts:
- Read `orders.csv` in original file order.
- Select the first {INSTACART_SUBSET_ORDER_LIMIT} real source order rows.
- Preserve each selected original `order_id` and `user_id`.
- Include only `order_products__prior.csv` and `order_products__train.csv` rows whose original `order_id` is in the selected set.
- Preserve each original `product_id`, `add_to_cart_order`, and `reordered`.
- Load all real rows from `products.csv`, `aisles.csv`, and `departments.csv` into source product records.

No synthetic orders, users, products, coordinates, prices, or stores are generated.
"""
    (METADATA_DIR / "instacart_subset.md").write_text(subset_doc, encoding="utf-8")

    print(f"Wrote {METADATA_DIR / 'datasets.json'}")
    print(f"Wrote {METADATA_DIR / 'dataset_profile.md'}")
    print(f"Wrote {METADATA_DIR / 'instacart_subset.md'}")


if __name__ == "__main__":
    main()
