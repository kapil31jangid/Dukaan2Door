"""Add inventory onboarding metadata and delivery capability history.

Revision ID: 20261002_0005
Revises: 20260928_0004
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_0005"
down_revision = "20260928_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("brand", sa.String(length=120), nullable=True))
    op.create_index("ix_products_brand", "products", ["brand"], unique=False)
    op.add_column("products", sa.Column("handling_type", sa.String(length=30), server_default="NORMAL", nullable=False))
    op.add_column("products", sa.Column("requires_special_equipment", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column("products", "handling_type", server_default=None)
    op.alter_column("products", "requires_special_equipment", server_default=None)

    op.add_column("inventory", sa.Column("unit", sa.String(length=60), server_default="unit", nullable=False))
    op.add_column("inventory", sa.Column("expiry_date", sa.Date(), nullable=True))
    op.add_column("inventory", sa.Column("low_stock_threshold", sa.Integer(), server_default="5", nullable=False))
    op.alter_column("inventory", "unit", server_default=None)
    op.alter_column("inventory", "low_stock_threshold", server_default=None)

    op.add_column("delivery_partners", sa.Column("capabilities", sa.String(length=500), server_default="NORMAL", nullable=False))
    op.alter_column("delivery_partners", "capabilities", server_default=None)

    op.create_table(
        "inventory_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inventory_id", sa.Integer(), sa.ForeignKey("inventory.id"), nullable=False),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("quantity_after", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for column in ("id", "inventory_id", "store_id", "product_id", "created_at"):
        op.create_index(f"ix_inventory_adjustments_{column}", "inventory_adjustments", [column], unique=False)

    op.create_table(
        "delivery_rejections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("delivery_id", sa.Integer(), sa.ForeignKey("deliveries.id"), nullable=False),
        sa.Column("delivery_partner_id", sa.Integer(), sa.ForeignKey("delivery_partners.id"), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for column in ("id", "delivery_id", "delivery_partner_id"):
        op.create_index(f"ix_delivery_rejections_{column}", "delivery_rejections", [column], unique=False)


def downgrade() -> None:
    for column in ("delivery_partner_id", "delivery_id", "id"):
        op.drop_index(f"ix_delivery_rejections_{column}", table_name="delivery_rejections")
    op.drop_table("delivery_rejections")
    for column in ("created_at", "product_id", "store_id", "inventory_id", "id"):
        op.drop_index(f"ix_inventory_adjustments_{column}", table_name="inventory_adjustments")
    op.drop_table("inventory_adjustments")
    op.drop_column("delivery_partners", "capabilities")
    op.drop_column("inventory", "low_stock_threshold")
    op.drop_column("inventory", "expiry_date")
    op.drop_column("inventory", "unit")
    op.drop_column("products", "requires_special_equipment")
    op.drop_column("products", "handling_type")
    op.drop_index("ix_products_brand", table_name="products")
    op.drop_column("products", "brand")
