#!/usr/bin/env python3
"""Run one real local PaddleOCR analysis and print provider-neutral output."""

from __future__ import annotations

import argparse
import mimetypes
import sys
import time
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
load_dotenv(ROOT / "backend" / ".env")

from app.core.config import settings  # noqa: E402
from app.services.inventory_parser import parse_inventory_lines  # noqa: E402
from app.services.ocr_service import PaddleOCRProvider  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Test local PaddleOCR inventory extraction")
    parser.add_argument("file", type=Path, help="JPG, PNG, or PDF to analyze")
    args = parser.parse_args()
    if not args.file.is_file():
        parser.error(f"File does not exist: {args.file}")

    content_type = mimetypes.guess_type(args.file.name)[0] or "application/octet-stream"
    try:
        ocr_started = time.perf_counter()
        result = PaddleOCRProvider().recognize(args.file.read_bytes(), args.file.name, content_type)
        ocr_seconds = time.perf_counter() - ocr_started
        parser_started = time.perf_counter()
        items = parse_inventory_lines(result.lines)
        parser_seconds = time.perf_counter() - parser_started
    except Exception as exc:
        print(f"OCR failed: {getattr(exc, 'detail', str(exc))}", file=sys.stderr)
        return 1

    print("OCR ENGINE\nPaddleOCR")
    print("\nRAW TEXT")
    print(result.raw_text or "(empty)")
    print("\nDETECTED LINES")
    for value in result.lines:
        confidence = f"{value.confidence:.3f}" if value.confidence is not None else "unavailable"
        print(f"  page={value.page_index + 1} confidence={confidence} box={value.bounding_box} text={value.text}")
    print("\nSTRUCTURED PRODUCTS")
    if not items:
        print("  No reliable products could be extracted. Enter products manually.")
    for item in items:
        print(item.model_dump_json(indent=2))
    print("\nLOW-CONFIDENCE FIELDS")
    uncertain = [item for item in items if item.confidence is None or item.confidence < settings.PADDLE_OCR_LOW_CONFIDENCE]
    print(f"  {len(uncertain)} row(s) require confidence review")
    print(f"\nOCR TIME\n{ocr_seconds:.3f}s")
    print(f"\nPARSER TIME\n{parser_seconds:.3f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
