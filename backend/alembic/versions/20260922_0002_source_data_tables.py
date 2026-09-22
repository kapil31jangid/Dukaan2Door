"""source data staging tables

Revision ID: 20260922_0002
Revises: 20260922_0001
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa


revision = "20260922_0002"
down_revision = "20260922_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_datasets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("dataset_handle", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("license", sa.String(length=100), nullable=True),
        sa.Column("downloaded_at", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dataset_handle"),
        sa.UniqueConstraint("platform"),
    )
    op.create_index(op.f("ix_source_datasets_id"), "source_datasets", ["id"], unique=False)
    op.create_index(op.f("ix_source_datasets_platform"), "source_datasets", ["platform"], unique=True)

    op.create_table(
        "source_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_platform", sa.String(length=50), nullable=False),
        sa.Column("source_dataset", sa.String(length=255), nullable=False),
        sa.Column("source_product_id", sa.Text(), nullable=False),
        sa.Column("product_name", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("subcategory", sa.String(length=255), nullable=True),
        sa.Column("brand", sa.String(length=255), nullable=True),
        sa.Column("unit", sa.String(length=100), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("mrp", sa.Float(), nullable=True),
        sa.Column("availability", sa.String(length=100), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_platform", "source_product_id", name="uq_source_products_platform_id"),
    )
    op.create_index(op.f("ix_source_products_category"), "source_products", ["category"], unique=False)
    op.create_index(op.f("ix_source_products_id"), "source_products", ["id"], unique=False)
    op.create_index(op.f("ix_source_products_source_platform"), "source_products", ["source_platform"], unique=False)

    op.create_table(
        "source_inventory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_platform", sa.String(length=50), nullable=False),
        sa.Column("source_dataset", sa.String(length=255), nullable=False),
        sa.Column("source_record_id", sa.Text(), nullable=False),
        sa.Column("source_product_id", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("availability", sa.String(length=100), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_platform", "source_record_id", name="uq_source_inventory_platform_id"),
    )
    op.create_index(op.f("ix_source_inventory_id"), "source_inventory", ["id"], unique=False)
    op.create_index(op.f("ix_source_inventory_source_platform"), "source_inventory", ["source_platform"], unique=False)
    op.create_index(op.f("ix_source_inventory_source_product_id"), "source_inventory", ["source_product_id"], unique=False)

    op.create_table(
        "source_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_platform", sa.String(length=50), nullable=False),
        sa.Column("source_dataset", sa.String(length=255), nullable=False),
        sa.Column("source_order_id", sa.Text(), nullable=False),
        sa.Column("source_user_id", sa.Text(), nullable=True),
        sa.Column("order_number", sa.Integer(), nullable=True),
        sa.Column("order_dow", sa.Integer(), nullable=True),
        sa.Column("order_hour_of_day", sa.Integer(), nullable=True),
        sa.Column("days_since_prior_order", sa.Float(), nullable=True),
        sa.Column("eval_set", sa.String(length=50), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_platform", "source_order_id", name="uq_source_orders_platform_id"),
    )
    op.create_index(op.f("ix_source_orders_eval_set"), "source_orders", ["eval_set"], unique=False)
    op.create_index(op.f("ix_source_orders_id"), "source_orders", ["id"], unique=False)
    op.create_index(op.f("ix_source_orders_source_platform"), "source_orders", ["source_platform"], unique=False)
    op.create_index(op.f("ix_source_orders_source_user_id"), "source_orders", ["source_user_id"], unique=False)

    op.create_table(
        "source_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_platform", sa.String(length=50), nullable=False),
        sa.Column("source_dataset", sa.String(length=255), nullable=False),
        sa.Column("source_order_id", sa.Text(), nullable=False),
        sa.Column("source_product_id", sa.Text(), nullable=False),
        sa.Column("add_to_cart_order", sa.Integer(), nullable=True),
        sa.Column("reordered", sa.Integer(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_platform",
            "source_order_id",
            "source_product_id",
            "add_to_cart_order",
            name="uq_source_order_items_platform_order_product_cart",
        ),
    )
    op.create_index(op.f("ix_source_order_items_id"), "source_order_items", ["id"], unique=False)
    op.create_index(op.f("ix_source_order_items_source_order_id"), "source_order_items", ["source_order_id"], unique=False)
    op.create_index(op.f("ix_source_order_items_source_platform"), "source_order_items", ["source_platform"], unique=False)
    op.create_index(op.f("ix_source_order_items_source_product_id"), "source_order_items", ["source_product_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_source_order_items_source_product_id"), table_name="source_order_items")
    op.drop_index(op.f("ix_source_order_items_source_platform"), table_name="source_order_items")
    op.drop_index(op.f("ix_source_order_items_source_order_id"), table_name="source_order_items")
    op.drop_index(op.f("ix_source_order_items_id"), table_name="source_order_items")
    op.drop_table("source_order_items")
    op.drop_index(op.f("ix_source_orders_source_user_id"), table_name="source_orders")
    op.drop_index(op.f("ix_source_orders_source_platform"), table_name="source_orders")
    op.drop_index(op.f("ix_source_orders_id"), table_name="source_orders")
    op.drop_index(op.f("ix_source_orders_eval_set"), table_name="source_orders")
    op.drop_table("source_orders")
    op.drop_index(op.f("ix_source_inventory_source_product_id"), table_name="source_inventory")
    op.drop_index(op.f("ix_source_inventory_source_platform"), table_name="source_inventory")
    op.drop_index(op.f("ix_source_inventory_id"), table_name="source_inventory")
    op.drop_table("source_inventory")
    op.drop_index(op.f("ix_source_products_source_platform"), table_name="source_products")
    op.drop_index(op.f("ix_source_products_id"), table_name="source_products")
    op.drop_index(op.f("ix_source_products_category"), table_name="source_products")
    op.drop_table("source_products")
    op.drop_index(op.f("ix_source_datasets_platform"), table_name="source_datasets")
    op.drop_index(op.f("ix_source_datasets_id"), table_name="source_datasets")
    op.drop_table("source_datasets")
