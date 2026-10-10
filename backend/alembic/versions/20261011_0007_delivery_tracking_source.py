"""Identify real GPS, lifecycle, and demo tracking points.

Revision ID: 20261011_0007
Revises: 20261009_0006
"""

from alembic import op
import sqlalchemy as sa


revision = "20261011_0007"
down_revision = "20261009_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "delivery_tracking",
        sa.Column("source", sa.String(length=32), server_default="GPS", nullable=False),
    )
    op.execute("UPDATE delivery_tracking SET source = 'LIFECYCLE' WHERE accuracy_m IS NULL")


def downgrade() -> None:
    op.drop_column("delivery_tracking", "source")
