"""initial schema

Revision ID: 20260922_0001
Revises:
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa


revision = "20260922_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role = sa.Enum("CUSTOMER", "RETAILER", "DELIVERY_PARTNER", name="user_role")
order_status = sa.Enum(
    "RECEIVED",
    "ACCEPTED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "REJECTED",
    "CANCELLED",
    name="order_status",
)
delivery_status = sa.Enum("ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", name="delivery_status")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("delivery_address", sa.String(length=500), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_customers_id"), "customers", ["id"], unique=False)

    op.create_table(
        "delivery_partners",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("vehicle_info", sa.String(length=255), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("current_lat", sa.Float(), nullable=True),
        sa.Column("current_lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_delivery_partners_id"), "delivery_partners", ["id"], unique=False)
    op.create_index(op.f("ix_delivery_partners_is_available"), "delivery_partners", ["is_available"], unique=False)

    op.create_table(
        "retailers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_retailers_id"), "retailers", ["id"], unique=False)

    op.create_table(
        "stores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("retailer_id", sa.Integer(), nullable=False),
        sa.Column("store_name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("operating_hours", sa.String(length=255), nullable=True),
        sa.Column("is_open", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["retailer_id"], ["retailers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("retailer_id"),
    )
    op.create_index(op.f("ix_stores_id"), "stores", ["id"], unique=False)
    op.create_index(op.f("ix_stores_is_open"), "stores", ["is_open"], unique=False)
    op.create_index(op.f("ix_stores_lat"), "stores", ["lat"], unique=False)
    op.create_index(op.f("ix_stores_lng"), "stores", ["lng"], unique=False)

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_products_category"), "products", ["category"], unique=False)
    op.create_index(op.f("ix_products_id"), "products", ["id"], unique=False)
    op.create_index(op.f("ix_products_is_active"), "products", ["is_active"], unique=False)
    op.create_index(op.f("ix_products_name"), "products", ["name"], unique=False)
    op.create_index(op.f("ix_products_store_id"), "products", ["store_id"], unique=False)

    op.create_table(
        "inventory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "product_id", name="uq_inventory_store_product"),
    )
    op.create_index(op.f("ix_inventory_id"), "inventory", ["id"], unique=False)
    op.create_index(op.f("ix_inventory_is_available"), "inventory", ["is_available"], unique=False)
    op.create_index(op.f("ix_inventory_product_id"), "inventory", ["product_id"], unique=False)
    op.create_index(op.f("ix_inventory_store_id"), "inventory", ["store_id"], unique=False)

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("total_amount", sa.Float(), nullable=False),
        sa.Column("delivery_address", sa.String(length=500), nullable=False),
        sa.Column("delivery_lat", sa.Float(), nullable=False),
        sa.Column("delivery_lng", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_orders_customer_id"), "orders", ["customer_id"], unique=False)
    op.create_index(op.f("ix_orders_id"), "orders", ["id"], unique=False)
    op.create_index(op.f("ix_orders_status"), "orders", ["status"], unique=False)
    op.create_index(op.f("ix_orders_store_id"), "orders", ["store_id"], unique=False)

    op.create_table(
        "deliveries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("delivery_partner_id", sa.Integer(), nullable=True),
        sa.Column("status", delivery_status, nullable=False),
        sa.Column("pickup_address", sa.String(length=500), nullable=True),
        sa.Column("pickup_lat", sa.Float(), nullable=False),
        sa.Column("pickup_lng", sa.Float(), nullable=False),
        sa.Column("destination_address", sa.String(length=500), nullable=False),
        sa.Column("destination_lat", sa.Float(), nullable=False),
        sa.Column("destination_lng", sa.Float(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(), nullable=False),
        sa.Column("picked_up_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["delivery_partner_id"], ["delivery_partners.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", name="uq_deliveries_order_id"),
    )
    op.create_index(op.f("ix_deliveries_delivery_partner_id"), "deliveries", ["delivery_partner_id"], unique=False)
    op.create_index(op.f("ix_deliveries_id"), "deliveries", ["id"], unique=False)
    op.create_index(op.f("ix_deliveries_order_id"), "deliveries", ["order_id"], unique=False)
    op.create_index(op.f("ix_deliveries_status"), "deliveries", ["status"], unique=False)

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_order_items_id"), "order_items", ["id"], unique=False)
    op.create_index(op.f("ix_order_items_order_id"), "order_items", ["order_id"], unique=False)
    op.create_index(op.f("ix_order_items_product_id"), "order_items", ["product_id"], unique=False)

    op.create_table(
        "delivery_tracking",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("delivery_id", sa.Integer(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("status", delivery_status, nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["delivery_id"], ["deliveries.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_delivery_tracking_delivery_id"), "delivery_tracking", ["delivery_id"], unique=False)
    op.create_index(op.f("ix_delivery_tracking_id"), "delivery_tracking", ["id"], unique=False)
    op.create_index(op.f("ix_delivery_tracking_recorded_at"), "delivery_tracking", ["recorded_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_delivery_tracking_recorded_at"), table_name="delivery_tracking")
    op.drop_index(op.f("ix_delivery_tracking_id"), table_name="delivery_tracking")
    op.drop_index(op.f("ix_delivery_tracking_delivery_id"), table_name="delivery_tracking")
    op.drop_table("delivery_tracking")
    op.drop_index(op.f("ix_order_items_product_id"), table_name="order_items")
    op.drop_index(op.f("ix_order_items_order_id"), table_name="order_items")
    op.drop_index(op.f("ix_order_items_id"), table_name="order_items")
    op.drop_table("order_items")
    op.drop_index(op.f("ix_deliveries_status"), table_name="deliveries")
    op.drop_index(op.f("ix_deliveries_order_id"), table_name="deliveries")
    op.drop_index(op.f("ix_deliveries_id"), table_name="deliveries")
    op.drop_index(op.f("ix_deliveries_delivery_partner_id"), table_name="deliveries")
    op.drop_table("deliveries")
    op.drop_index(op.f("ix_orders_store_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_status"), table_name="orders")
    op.drop_index(op.f("ix_orders_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_customer_id"), table_name="orders")
    op.drop_table("orders")
    op.drop_index(op.f("ix_inventory_store_id"), table_name="inventory")
    op.drop_index(op.f("ix_inventory_product_id"), table_name="inventory")
    op.drop_index(op.f("ix_inventory_is_available"), table_name="inventory")
    op.drop_index(op.f("ix_inventory_id"), table_name="inventory")
    op.drop_table("inventory")
    op.drop_index(op.f("ix_products_store_id"), table_name="products")
    op.drop_index(op.f("ix_products_name"), table_name="products")
    op.drop_index(op.f("ix_products_is_active"), table_name="products")
    op.drop_index(op.f("ix_products_id"), table_name="products")
    op.drop_index(op.f("ix_products_category"), table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_stores_lng"), table_name="stores")
    op.drop_index(op.f("ix_stores_lat"), table_name="stores")
    op.drop_index(op.f("ix_stores_is_open"), table_name="stores")
    op.drop_index(op.f("ix_stores_id"), table_name="stores")
    op.drop_table("stores")
    op.drop_index(op.f("ix_retailers_id"), table_name="retailers")
    op.drop_table("retailers")
    op.drop_index(op.f("ix_delivery_partners_is_available"), table_name="delivery_partners")
    op.drop_index(op.f("ix_delivery_partners_id"), table_name="delivery_partners")
    op.drop_table("delivery_partners")
    op.drop_index(op.f("ix_customers_id"), table_name="customers")
    op.drop_table("customers")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
