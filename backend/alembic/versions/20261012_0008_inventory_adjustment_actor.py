"""Record the retailer responsible for inventory adjustments.

Revision ID: 20261012_0008
Revises: 20261011_0007
"""

from alembic import op
import sqlalchemy as sa


revision = "20261012_0008"
down_revision = "20261011_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_adjustments",
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_inventory_adjustments_actor_user_id_users",
        "inventory_adjustments",
        "users",
        ["actor_user_id"],
        ["id"],
    )
    op.create_index(
        "ix_inventory_adjustments_actor_user_id",
        "inventory_adjustments",
        ["actor_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_inventory_adjustments_actor_user_id",
        table_name="inventory_adjustments",
    )
    op.drop_constraint(
        "fk_inventory_adjustments_actor_user_id_users",
        "inventory_adjustments",
        type_="foreignkey",
    )
    op.drop_column("inventory_adjustments", "actor_user_id")
