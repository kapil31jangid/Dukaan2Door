#!/usr/bin/env python3
"""Run real Gemini API inventory extraction on a bill or handwritten list and print structured output.

Usage:
    python scripts/test_gemini_inventory.py path/to/bill.jpg
"""

from __future__ import annotations

import argparse
import mimetypes
import sys
import time
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.core.config import settings
from app.services.gemini_inventory_analyzer import GeminiInventoryAnalyzer


def main() -> None:
    parser = argparse.ArgumentParser(description="Test Gemini AI inventory extraction on an image or PDF")
    parser.add_argument("file", type=Path, help="Path to the image (JPG, PNG, WEBP) or PDF bill")
    parser.add_argument("--model", type=str, default=None, help="Gemini model override (e.g. gemini-2.5-flash)")
    args = parser.parse_args()

    if not args.file.exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    if not settings.GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY environment variable is not configured.", file=sys.stderr)
        print("Set it via: export GEMINI_API_KEY='your_key' or in backend/.env", file=sys.stderr)
        sys.exit(1)

    content = args.file.read_bytes()
    mime_type, _ = mimetypes.guess_type(str(args.file))
    if not mime_type:
        mime_type = "image/jpeg"

    print("=" * 60)
    print("DUKAAN2DOOR — AI-ASSISTED INVENTORY EXTRACTION")
    print(f"Document File: {args.file.name} ({len(content)} bytes, {mime_type})")
    print(f"Configured Model: {args.model or settings.GEMINI_MODEL}")
    print("=" * 60)

    analyzer = GeminiInventoryAnalyzer(model=args.model)

    start_time = time.perf_counter()
    try:
        items, ocr_lines = analyzer.analyze(content, args.file.name, mime_type)
        duration = time.perf_counter() - start_time
    except Exception as exc:
        print(f"\nExtraction failed: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"\nPROCESSING TIME: {duration:.2f} seconds")
    print(f"TOTAL PRODUCTS DETECTED: {len(items)}\n")

    print("-" * 60)
    print("DETECTED PRODUCTS")
    print("-" * 60)

    for idx, item in enumerate(items, 1):
        status = "⚠ NEEDS REVIEW" if item.needs_review else "✓ READY"
        print(f"\n[{idx}] {status}")
        print(f"  PRODUCT:      {item.product_name}")
        if item.brand:
            print(f"  BRAND:        {item.brand}")
        if item.size:
            print(f"  SIZE:         {item.size}")
        print(f"  QUANTITY:     {item.quantity if item.quantity is not None else 'null (unreadable/missing)'}")
        print(f"  UNIT:         {item.unit}")
        print(f"  PRICE:        ₹{item.price if item.price is not None else 'null (unreadable/missing)'}")
        if item.total_price:
            print(f"  TOTAL PRICE:  ₹{item.total_price}")
        print(f"  CATEGORY:     {item.category or 'null'}")
        print(f"  HANDLING:     {item.handling_type}")
        print(f"  NEEDS REVIEW: {str(item.needs_review).lower()}")
        if item.review_reason:
            print(f"  REVIEW REASON: {item.review_reason}")
        if item.warnings:
            print(f"  WARNINGS:     {'; '.join(item.warnings)}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
