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


def field_accuracy(expected: list[dict[str, Any]], actual: list[Any], field: str) -> tuple[int, int]:
    comparable = [(index, row[field]) for index, row in enumerate(expected) if row.get(field) is not None]
    correct = sum(
        index < len(actual) and normalize(getattr(actual[index], field, None)) == normalize(value)
        for index, value in comparable
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

    totals = {"product_name": [0, 0], "quantity": [0, 0], "price": [0, 0]}
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

        scores = {}
        for field in totals:
            correct, count = field_accuracy(case.get("expected", []), items, field)
            totals[field][0] += correct
            totals[field][1] += count
            scores[field] = None if count == 0 else round(correct / count, 3)

        # Check needs_review accuracy for poor handwriting or uncertain cases
        for idx, exp in enumerate(case.get("expected", [])):
            if "needs_review" in exp:
                needs_review_total += 1
                if idx < len(items) and items[idx].needs_review == exp["needs_review"]:
                    needs_review_correct += 1

        reports.append({
            "name": case.get("name", image_path.name),
            "category": case.get("category"),
            "products_detected": len(items),
            "seconds": round(elapsed, 3),
            "status": "PASS" if success else f"FAIL ({error_msg})",
            "field_accuracy": scores,
        })
        print(f"  [{case.get('name')}] -> {len(items)} items in {elapsed:.2f}s (Accuracy: {scores})")

    summary = {
        field: None if count == 0 else round(correct / count, 4)
        for field, (correct, count) in totals.items()
    }
    avg_seconds = round(sum(case["seconds"] for case in reports) / len(reports), 3) if reports else 0

    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY RESULTS")
    print("=" * 70)
    print(f"PRODUCT NAME ACCURACY: {((summary.get('product_name') or 0.0) * 100):.1f}%")
    print(f"QUANTITY ACCURACY:     {((summary.get('quantity') or 0.0) * 100):.1f}%")
    print(f"PRICE ACCURACY:        {((summary.get('price') or 0.0) * 100):.1f}%")
    if needs_review_total > 0:
        print(f"NEEDS REVIEW ACCURACY: {(needs_review_correct / needs_review_total) * 100:.1f}%")
    print(f"AVERAGE RESPONSE TIME: {avg_seconds:.2f} seconds")
    print("=" * 70)

    # Save summary report to JSON
    report_file = args.manifest.parent / "gemini_benchmark_results.json"
    report_data = {
        "engine": "Gemini AI",
        "model": args.model or settings.GEMINI_MODEL,
        "summary_accuracy": summary,
        "average_seconds": avg_seconds,
        "cases": reports,
    }
    report_file.write_text(json.dumps(report_data, indent=2))
    print(f"Saved benchmark report to {report_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
