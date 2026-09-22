import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
load_dotenv(BACKEND / ".env")
sys.path.insert(0, str(BACKEND))

from app.db.session import SessionLocal  # noqa: E402
from app.models.source_data import SourceDataset, SourceInventory, SourceOrder, SourceOrderItem, SourceProduct  # noqa: E402
from sqlalchemy import text  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        app_table_totals = {}
        for table in ("products", "inventory", "orders", "order_items"):
            try:
                app_table_totals[table] = db.execute(text(f"select count(*) from {table}")).scalar_one()
            except Exception as exc:
                app_table_totals[table] = f"unavailable:{type(exc).__name__}"

        totals = {
            "source_datasets": db.query(SourceDataset).count(),
            "source_products": db.query(SourceProduct).count(),
            "source_inventory": db.query(SourceInventory).count(),
            "source_orders": db.query(SourceOrder).count(),
            "source_order_items": db.query(SourceOrderItem).count(),
            **app_table_totals,
        }
        issues = {
            "orphan_source_order_items": db.query(SourceOrderItem)
            .outerjoin(
                SourceOrder,
                (SourceOrder.source_platform == SourceOrderItem.source_platform)
                & (SourceOrder.source_order_id == SourceOrderItem.source_order_id),
            )
            .filter(SourceOrder.id.is_(None))
            .count(),
            "source_products_with_negative_price": db.query(SourceProduct).filter(SourceProduct.price < 0).count(),
            "source_inventory_with_negative_quantity": db.query(SourceInventory)
            .filter(SourceInventory.quantity < 0)
            .count(),
        }
        print({"totals": totals, "issues": issues})
    finally:
        db.close()


if __name__ == "__main__":
    main()
