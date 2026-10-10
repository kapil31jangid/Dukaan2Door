#!/usr/bin/env python3
"""Benchmark Gemini AI inventory extraction against ground truth test cases.

Measures:
- PRODUCT NAME ACCURACY
- QUANTITY ACCURACY
- PRICE ACCURACY
- AVERAGE RESPONSE TIME
- NEEDS REVIEW HANDLING (poor handwriting safely flagged)
"""

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

from app.core.config import settings
from app.services.gemini_inventory_analyzer import GeminiInventoryAnalyzer


def normalize(value: Any) -> str:
    val = re.sub(r"\s+", " ", str(value or "").strip().lower())
    # Handle float equivalency: '28.0' == '28'
    try:
        fval = float(val)
        if fval.is_integer():
            return str(int(fval))
        return f"{fval:.2f}"
    except (ValueError, TypeError):
        return val


def normalize_product_name(value: Any) -> str:
    value = normalize(value)
    return re.sub(r"\s+\d+(?:\.\d+)?\s*(?:kg|g|mg|l|ml|ltr|litre|pack|pcs?)\b", "", value).strip()


def match_products(expected: list[dict[str, Any]], actual: list[Any]) -> tuple[list[tuple[dict[str, Any], Any]], list[dict[str, Any]], list[Any]]:
    """Match rows by normalized product name without hiding missing or extra output."""
    unmatched_actual = list(actual)
    matches: list[tuple[dict[str, Any], Any]] = []
    missing: list[dict[str, Any]] = []
    for expected_row in expected:
        expected_name = normalize_product_name(expected_row.get("product_name"))
        match_index = next(
            (
                index
                for index, item in enumerate(unmatched_actual)
                if normalize_product_name(getattr(item, "product_name", None)) == expected_name
            ),
            None,
        )
        if match_index is None:
            missing.append(expected_row)
        else:
            matches.append((expected_row, unmatched_actual.pop(match_index)))
    return matches, missing, unmatched_actual


def field_accuracy(matches: list[tuple[dict[str, Any], Any]], expected: list[dict[str, Any]], field: str) -> tuple[int, int]:
    comparable = [row[field] for row in expected if row.get(field) is not None]
    normalizer = normalize_product_name if field == "product_name" else normalize
    actual_field = "price" if field == "unit_price" else field
    correct = sum(
        normalizer(getattr(actual_row, actual_field, None)) == normalizer(expected_row[field])
        for expected_row, actual_row in matches
        if expected_row.get(field) is not None
    )
    return correct, len(comparable)


def create_sample_manifest(manifest_path: Path) -> dict[str, Any]:
    """Generates synthetic visual test cases with Pillow for evaluation if none exist."""
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

    images_dir = manifest_path.parent / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    test_cases_defs = [
        {
            "name": "1. Clean generated receipt",
            "category": "clean-generated",
            "filename": "01_clean_receipt.png",
            "text": "SHREE GANESH KIRANA STORE\nDate: 02/10/2026\n--------------------------------\nAmul Taaza Milk 500ml   Qty: 10   Rs. 28.00\nParle-G 250g            Qty: 15   Rs. 10.00\nFortune Sunflower Oil 1L Qty: 2   Rs. 165.00\n--------------------------------\nTOTAL: Rs. 760.00",
            "expected": [
                {"product_name": "Amul Taaza Milk", "quantity": 10, "price": 28.0, "needs_review": False},
                {"product_name": "Parle-G", "quantity": 15, "price": 10.0, "needs_review": False},
                {"product_name": "Fortune Sunflower Oil", "quantity": 2, "price": 165.0, "needs_review": False},
            ],
            "transform": "clean",
        },
        {
            "name": "2. Real printed kirana receipt",
            "category": "printed-kirana-bill",
            "filename": "02_printed_kirana_receipt.png",
            "text": "LAXMI GENERAL STORE\n==============================\nItem           Qty  Rate   Amount\nTata Salt 1kg    4  28.00  112.00\nMaggi 70g       12  14.00  168.00\nSurf Excel 1kg   1 140.00  140.00\n==============================\nTotal Amount:             420.00",
            "expected": [
                {"product_name": "Tata Salt", "quantity": 4, "price": 28.0, "needs_review": False},
                {"product_name": "Maggi", "quantity": 12, "price": 14.0, "needs_review": False},
                {"product_name": "Surf Excel", "quantity": 1, "price": 140.0, "needs_review": False},
            ],
            "transform": "printed",
        },
        {
            "name": "3. Phone photo of receipt",
            "category": "phone-photo",
            "filename": "03_phone_photo_receipt.png",
            "text": "RETAIL INVOICE\nAashirvaad Atta 10kg   1   380.00\nMDH Haldi 100g         2    35.00",
            "expected": [
                {"product_name": "Aashirvaad Atta", "quantity": 1, "price": 380.0, "needs_review": False},
                {"product_name": "MDH Haldi", "quantity": 2, "price": 35.0, "needs_review": False},
            ],
            "transform": "photo",
        },
        {
            "name": "4. Rotated/angled bill",
            "category": "rotated-angled",
            "filename": "04_rotated_bill.png",
            "text": "KIRANA BILL\nDettol Soap 75g     5   40.00\nColgate MaxFresh   3   95.00",
            "expected": [
                {"product_name": "Dettol Soap", "quantity": 5, "price": 40.0, "needs_review": False},
                {"product_name": "Colgate MaxFresh", "quantity": 3, "price": 95.0, "needs_review": False},
            ],
            "transform": "rotate",
        },
        {
            "name": "5. Low-light bill",
            "category": "low-light",
            "filename": "05_low_light_bill.png",
            "text": "STORE BILL\nGood Day Cashew 100g   6   30.00\nCoca Cola 750ml        4   45.00",
            "expected": [
                {"product_name": "Good Day Cashew", "quantity": 6, "price": 30.0, "needs_review": False},
                {"product_name": "Coca Cola", "quantity": 4, "price": 45.0, "needs_review": False},
            ],
            "transform": "dark",
        },
        {
            "name": "6. Neat handwritten inventory",
            "category": "handwriting-neat",
            "filename": "06_neat_handwriting.png",
            "text": "Daily Stock List\nAmul Milk 500ml - 10 packets - 28 rs\nSugar 1kg - 5 packets - 45 rs\nTea Red Label 250g - 4 packs - 130 rs",
            "expected": [
                {"product_name": "Amul Milk", "quantity": 10, "price": 28.0, "needs_review": False},
                {"product_name": "Sugar", "quantity": 5, "price": 45.0, "needs_review": False},
                {"product_name": "Tea Red Label", "quantity": 4, "price": 130.0, "needs_review": False},
            ],
            "transform": "handwritten",
        },
        {
            "name": "7. Average handwriting with abbreviations",
            "category": "handwriting-average",
            "filename": "07_average_handwriting.png",
            "text": "amul mlk 500    12    28\nprle g 250       8    10\nsurf xl 500g     3    75",
            "expected": [
                {"product_name": "Amul Milk", "quantity": 12, "price": 28.0, "needs_review": False},
                {"product_name": "Parle-G", "quantity": 8, "price": 10.0, "needs_review": False},
                {"product_name": "Surf Excel", "quantity": 3, "price": 75.0, "needs_review": False},
            ],
            "transform": "handwritten_avg",
        },
        {
            "name": "8. Bad handwriting with ambiguous numbers",
            "category": "handwriting-poor",
            "filename": "08_bad_handwriting.png",
            "text": "mggi 70g      ???    14\nbesn 500g      2     ??\nsome scribbled illegible item",
            "expected": [
                {"product_name": "Maggi", "quantity": None, "price": 14.0, "needs_review": True},
                {"product_name": "Besan", "quantity": 2, "price": None, "needs_review": True},
            ],
            "transform": "handwritten_poor",
        },
        {
            "name": "9. Mixed printed + handwritten bill",
            "category": "mixed-bill",
            "filename": "09_mixed_bill.png",
            "text": "INVOICE #402\nAmul Butter 100g     4   58.00\n[Handwritten note: + 2 ghee 500ml 320]",
            "expected": [
                {"product_name": "Amul Butter", "quantity": 4, "price": 58.0, "needs_review": False},
                {"product_name": "Ghee", "quantity": 2, "price": 320.0, "needs_review": False},
            ],
            "transform": "mixed",
        },
    ]

    manifest_cases = []
    for tc in test_cases_defs:
        filename = str(tc["filename"])
        img_path = images_dir / filename
        img = Image.new("RGB", (650, 400), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        # Draw text
        text_content = str(tc["text"])
        lines = text_content.split("\n")
        y = 30
        for line_txt in lines:
            draw.text((30, y), line_txt, fill=(20, 20, 20))
            y += 32

        t = tc["transform"]
        if t == "photo":
            img = img.filter(ImageFilter.GaussianBlur(radius=0.4))
        elif t == "rotate":
            img = img.rotate(8, expand=True, fillcolor=(245, 245, 245))
        elif t == "dark":
            img = ImageEnhance.Brightness(img).enhance(0.55)
        elif t == "handwritten_poor":
            # Add noise / scribble lines
            draw = ImageDraw.Draw(img)
            draw.line([(20, 180), (300, 185)], fill=(100, 100, 100), width=2)
            draw.line([(50, 220), (250, 210)], fill=(80, 80, 80), width=3)

        img.save(img_path, format="PNG")
        manifest_cases.append({
            "name": tc["name"],
            "category": tc["category"],
            "file": f"images/{tc['filename']}",
            "expected": tc["expected"],
        })

    manifest_data = {"cases": manifest_cases}
    manifest_path.write_text(json.dumps(manifest_data, indent=2))
    return manifest_data


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Gemini AI inventory extraction against ground truth")
    parser.add_argument(
        "manifest",
        nargs="?",
        type=Path,
        default=ROOT / "benchmarks" / "inventory_ocr" / "manifest.json",
        help="JSON manifest containing benchmark cases",
    )
    parser.add_argument("--model", type=str, default=None, help="Gemini model override")
    args = parser.parse_args()

    if not args.manifest.exists():
        print(f"Creating evaluation dataset and manifest at {args.manifest}...")
        payload = create_sample_manifest(args.manifest)
    else:
        payload = json.loads(args.manifest.read_text())

    cases = payload.get("cases", [])
    if not cases:
        print("Manifest contains no cases.", file=sys.stderr)
        return 1

    print("=" * 70)
    print("DUKAAN2DOOR — GEMINI AI INVENTORY BENCHMARK")
    print(f"Test Cases: {len(cases)}")
    print(f"Model: {args.model or settings.GEMINI_MODEL}")
    print("=" * 70)

    analyzer = GeminiInventoryAnalyzer(model=args.model)

    metric_fields = ("product_name", "quantity", "unit", "unit_price", "total_price")
    totals = {field: [0, 0] for field in metric_fields}
    needs_review_correct = 0
    needs_review_total = 0
    reports = []

    for case in cases:
        image_path = (args.manifest.parent / case["file"]).resolve()
        if not image_path.exists():
            print(f"Skipping missing image: {image_path}", file=sys.stderr)
            continue

        started = time.perf_counter()
        try:
            items, _ = analyzer.analyze(
                image_path.read_bytes(),
                image_path.name,
                mimetypes.guess_type(image_path.name)[0] or "image/png",
            )
            elapsed = time.perf_counter() - started
            success = True
            error_msg = None
        except Exception as exc:
            elapsed = time.perf_counter() - started
            items = []
            success = False
            error_msg = str(exc)

        expected = case.get("expected", [])
        matches, missing_rows, hallucinated_rows = match_products(expected, items) if success else ([], expected, [])
        scores = {}
        for field in totals:
            expected_for_field = expected
            if field == "unit_price" and any("price" in row for row in expected):
                expected_for_field = [
                    dict(row, unit_price=row.get("unit_price", row.get("price")))
                    for row in expected
                ]
            correct, count = field_accuracy(matches, expected_for_field, field)
            if success:
                totals[field][0] += correct
                totals[field][1] += count
            scores[field] = None if not success or count == 0 else round(correct / count, 3)

        # Check needs_review accuracy for poor handwriting or uncertain cases
        for exp, item in matches:
            if success and "needs_review" in exp:
                needs_review_total += 1
                if item.needs_review == exp["needs_review"]:
                    needs_review_correct += 1

        reports.append({
            "name": case.get("name", image_path.name),
            "category": case.get("category"),
            "products_detected": len(items),
            "seconds": round(elapsed, 3),
            "status": "PASS" if success else f"FAIL ({error_msg})",
            "provider_error": error_msg,
            "field_accuracy": scores,
            "expected_products": len(expected),
            "matched_products": len(matches),
            "missing_product_rows": [row.get("product_name") for row in missing_rows],
            "hallucinated_product_rows": [getattr(row, "product_name", None) for row in hallucinated_rows],
            "extracted": [
                {
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "price": item.price,
                    "needs_review": item.needs_review,
                }
                for item in items
            ],
        })
        print(f"  [{case.get('name')}] -> {len(items)} items in {elapsed:.2f}s (Accuracy: {scores})")

    summary = {
        field: None if count == 0 else round(correct / count, 4)
        for field, (correct, count) in totals.items()
    }
    avg_seconds = round(sum(case["seconds"] for case in reports) / len(reports), 3) if reports else 0
    successful_cases = sum(case["status"] == "PASS" for case in reports)
    failed_cases = len(reports) - successful_cases
    provider_errors = [case for case in reports if case["provider_error"]]
    missing_rows = sum(len(case["missing_product_rows"]) for case in reports)
    hallucinated_rows = sum(len(case["hallucinated_product_rows"]) for case in reports)
    categories: dict[str, dict[str, int]] = {}
    for case in reports:
        category = case.get("category") or "uncategorized"
        result = categories.setdefault(category, {"cases": 0, "passed": 0, "missing_rows": 0, "hallucinated_rows": 0})
        result["cases"] += 1
        result["passed"] += int(case["status"] == "PASS")
        result["missing_rows"] += len(case["missing_product_rows"])
        result["hallucinated_rows"] += len(case["hallucinated_product_rows"])

    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY RESULTS")
    print("=" * 70)
    print(f"PRODUCT NAME ACCURACY: {((summary.get('product_name') or 0.0) * 100):.1f}%")
    print(f"QUANTITY ACCURACY:     {((summary.get('quantity') or 0.0) * 100):.1f}%")
    print(f"UNIT ACCURACY:         {((summary.get('unit') or 0.0) * 100):.1f}%")
    print(f"UNIT PRICE ACCURACY:   {((summary.get('unit_price') or 0.0) * 100):.1f}%")
    print(f"TOTAL PRICE ACCURACY:  {((summary.get('total_price') or 0.0) * 100):.1f}%")
    if needs_review_total > 0:
        print(f"NEEDS REVIEW ACCURACY: {(needs_review_correct / needs_review_total) * 100:.1f}%")
    print(f"AVERAGE RESPONSE TIME: {avg_seconds:.2f} seconds")
    print(f"SUCCESSFUL CASES:      {successful_cases}/{len(reports)}")
    print(f"FAILED CASES:          {failed_cases}")
    print(f"PROVIDER ERRORS:       {len(provider_errors)}")
    print(f"MISSING PRODUCT ROWS:  {missing_rows}")
    print(f"EXTRA PRODUCT ROWS:    {hallucinated_rows}")
    print("=" * 70)

    # Save summary report to JSON
    report_file = args.manifest.parent / "gemini_benchmark_results.json"
    report_data = {
        "engine": "Gemini AI",
        "model": args.model or settings.GEMINI_MODEL,
        "summary_accuracy": summary,
        "average_seconds": avg_seconds,
        "successful_cases": successful_cases,
        "failed_cases": failed_cases,
        "provider_errors": len(provider_errors),
        "missing_product_rows": missing_rows,
        "hallucinated_product_rows": hallucinated_rows,
        "category_breakdown": categories,
        "cases": reports,
    }
    report_file.write_text(json.dumps(report_data, indent=2))
    print(f"Saved benchmark report to {report_file}")
    return 0 if failed_cases == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
