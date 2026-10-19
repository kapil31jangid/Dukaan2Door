#!/usr/bin/env python3
"""Benchmark PaddleOCR against user-supplied inventory images and ground truth."""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import sys
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
load_dotenv(ROOT / "backend" / ".env")

from app.services.inventory_parser import parse_inventory_lines  # noqa: E402
from app.services.ocr_service import PaddleOCRProvider  # noqa: E402


def normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def field_accuracy(expected: list[dict[str, Any]], actual: list[Any], field: str) -> tuple[int, int]:
    comparable = [(index, row[field]) for index, row in enumerate(expected) if row.get(field) is not None]
    correct = sum(
        index < len(actual) and normalize(getattr(actual[index], field, None)) == normalize(value)
        for index, value in comparable
    )
    return correct, len(comparable)


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark PaddleOCR inventory extraction")
    parser.add_argument(
        "manifest",
        nargs="?",
        type=Path,
        default=ROOT / "benchmarks" / "inventory_ocr" / "manifest.json",
        help="JSON manifest containing image paths and optional ground truth",
    )
    args = parser.parse_args()
    if args.manifest.exists() and not args.manifest.is_file():
        parser.error(
            f"manifest must be a JSON file, not a directory: {args.manifest}. "
            "Use benchmarks/inventory_ocr/manifest.json"
        )
    if not args.manifest.is_file():
        parser.error(f"Manifest does not exist: {args.manifest}")
    payload = json.loads(args.manifest.read_text())
    cases = payload.get("cases", [])
    if not cases:
        parser.error("Manifest contains no benchmark cases")

    provider = PaddleOCRProvider()
    totals = {field: [0, 0] for field in ("product_name", "quantity", "price")}
    reports = []
    for case in cases:
        image_path = (args.manifest.parent / case["file"]).resolve()
        started = time.perf_counter()
        result = provider.recognize(
            image_path.read_bytes(),
            image_path.name,
            mimetypes.guess_type(image_path.name)[0] or "application/octet-stream",
        )
        items = parse_inventory_lines(result.lines)
        elapsed = time.perf_counter() - started
        scores = {}
        for field in totals:
            correct, count = field_accuracy(case.get("expected", []), items, field)
            totals[field][0] += correct
            totals[field][1] += count
            scores[field] = None if count == 0 else correct / count
        reports.append({
            "name": case.get("name", image_path.name),
            "category": case.get("category"),
            "lines": len(result.lines),
            "products": len(items),
            "seconds": round(elapsed, 3),
            "accuracy": scores,
        })

    summary = {
        field: None if count == 0 else round(correct / count, 4)
        for field, (correct, count) in totals.items()
    }
    output = {
        "engine": "PaddleOCR",
        "cases": reports,
        "summary_accuracy": summary,
        "average_seconds": round(sum(case["seconds"] for case in reports) / len(reports), 3),
    }
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
