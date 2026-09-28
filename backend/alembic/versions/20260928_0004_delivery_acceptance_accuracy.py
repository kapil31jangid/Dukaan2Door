"""Add explicit delivery acceptance and GPS accuracy metadata.

Revision ID: 20260928_0004
Revises: 20260925_0003
"""

from alembic import op
import sqlalchemy as sa


revision = "20260928_0004"
down_revision = "20260925_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enum values are additive so existing delivery rows remain valid.
    op.execute("ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'ACCEPTED'")
    op.add_column("delivery_tracking", sa.Column("accuracy_m", sa.Float(), nullable=True))


def downgrade() -> None:
    # Removing a PostgreSQL enum value is destructive and is intentionally not
    # automated. The nullable column can be removed independently if needed.
    op.drop_column("delivery_tracking", "accuracy_m")
