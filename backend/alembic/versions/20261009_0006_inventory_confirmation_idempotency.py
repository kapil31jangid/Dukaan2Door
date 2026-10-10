"""Add inventory confirmation idempotency key.

Revision ID: 20261009_0006
Revises: 20261002_0005
"""

from alembic import op
import sqlalchemy as sa


revision = "20261009_0006"
down_revision = "20261002_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory_adjustments", sa.Column("batch_id", sa.String(length=100), nullable=True))
    op.create_index(
        "ix_inventory_adjustments_store_batch",
        "inventory_adjustments",
        ["store_id", "batch_id"],
        unique=False,
        postgresql_where=sa.text("batch_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_adjustments_store_batch", table_name="inventory_adjustments")
    op.drop_column("inventory_adjustments", "batch_id")
