"""Add image_url to products table

Revision ID: 20260925_0003_product_image_url
Revises: 20260922_0002_source_data_tables
Create Date: 2026-09-25
"""

from alembic import op
import sqlalchemy as sa

revision = "20260925_0003"
down_revision = "20260922_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("image_url", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "image_url")
