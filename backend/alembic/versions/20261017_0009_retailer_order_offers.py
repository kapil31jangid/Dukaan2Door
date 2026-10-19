"""Add retailer order opportunities and deferred store assignment.

Revision ID: 20261017_0009
Revises: 20261012_0008
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261017_0009"
down_revision = "20261012_0008"
branch_labels = None
depends_on = None


retailer_offer_status = postgresql.ENUM(
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "LOST",
    "EXPIRED",
    name="retailer_offer_status",
    create_type=False,
)


def upgrade() -> None:
    op.alter_column("orders", "store_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("orders", sa.Column("checkout_token", sa.String(length=100), nullable=True))
    op.create_index("ix_orders_checkout_token", "orders", ["checkout_token"], unique=False)
    op.create_unique_constraint(
        "uq_orders_customer_checkout_token",
        "orders",
        ["customer_id", "checkout_token"],
    )
    retailer_offer_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "retailer_order_offers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("status", retailer_offer_status, nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "store_id", name="uq_retailer_order_offer_order_store"),
    )
    for column in ("id", "order_id", "store_id", "status", "expires_at"):
        op.create_index(f"ix_retailer_order_offers_{column}", "retailer_order_offers", [column], unique=False)

    op.create_table(
        "retailer_order_offer_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("offer_id", sa.Integer(), nullable=False),
        sa.Column("order_item_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("inventory_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["offer_id"], ["retailer_order_offers.id"]),
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["inventory_id"], ["inventory.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("offer_id", "order_item_id", name="uq_retailer_offer_item"),
    )
    for column in ("id", "offer_id", "order_item_id", "product_id", "inventory_id"):
        op.create_index(f"ix_retailer_order_offer_items_{column}", "retailer_order_offer_items", [column], unique=False)


def downgrade() -> None:
    for column in ("inventory_id", "product_id", "order_item_id", "offer_id", "id"):
        op.drop_index(f"ix_retailer_order_offer_items_{column}", table_name="retailer_order_offer_items")
    op.drop_table("retailer_order_offer_items")

    # Preserve unclaimed order rows by assigning their source product's store
    # before restoring the legacy non-null constraint.
    op.execute(
        """
        UPDATE orders
        SET store_id = source_store.store_id
        FROM (
            SELECT oi.order_id, MIN(p.store_id) AS store_id
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            GROUP BY oi.order_id
        ) AS source_store
        WHERE orders.id = source_store.order_id AND orders.store_id IS NULL
        """
    )
    for column in ("expires_at", "status", "store_id", "order_id", "id"):
        op.drop_index(f"ix_retailer_order_offers_{column}", table_name="retailer_order_offers")
    op.drop_table("retailer_order_offers")
    retailer_offer_status.drop(op.get_bind(), checkfirst=True)
    op.drop_constraint("uq_orders_customer_checkout_token", "orders", type_="unique")
    op.drop_index("ix_orders_checkout_token", table_name="orders")
    op.drop_column("orders", "checkout_token")
    op.alter_column("orders", "store_id", existing_type=sa.Integer(), nullable=False)
