#!/usr/bin/env python3
"""Apply local catalogue images to existing fictional demo products only."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.core.config import settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.product import Product  # noqa: E402
from seed_operational_demo import demo_product_image  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-remote", action="store_true", help="Allow updates to a non-SQLite database")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.allow_remote and not settings.DATABASE_URL.startswith("sqlite"):
        print("Refusing non-SQLite writes. Re-run with --allow-remote for the intentional demo image update.")
        return 2

    db = SessionLocal()
    try:
        products = db.query(Product).filter(Product.name.like("Demo %")).all()
        for product in products:
            product.image_url = demo_product_image(product.name, product.category or "")
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Applied catalogue images to {len(products)} fictional demo products.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
