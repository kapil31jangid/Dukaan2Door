from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SourceDataset(Base):
    __tablename__ = "source_datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    dataset_handle: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    license: Mapped[Optional[str]] = mapped_column(String(100))
    downloaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    notes: Mapped[Optional[str]] = mapped_column(Text)


class SourceProduct(Base):
    __tablename__ = "source_products"
    __table_args__ = (UniqueConstraint("source_platform", "source_product_id", name="uq_source_products_platform_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_dataset: Mapped[str] = mapped_column(String(255), nullable=False)
    source_product_id: Mapped[str] = mapped_column(Text, nullable=False)
    product_name: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(255))
    brand: Mapped[Optional[str]] = mapped_column(String(255))
    unit: Mapped[Optional[str]] = mapped_column(String(100))
    price: Mapped[Optional[float]] = mapped_column(Float)
    mrp: Mapped[Optional[float]] = mapped_column(Float)
    availability: Mapped[Optional[str]] = mapped_column(String(100))
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class SourceInventory(Base):
    __tablename__ = "source_inventory"
    __table_args__ = (UniqueConstraint("source_platform", "source_record_id", name="uq_source_inventory_platform_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_dataset: Mapped[str] = mapped_column(String(255), nullable=False)
    source_record_id: Mapped[str] = mapped_column(Text, nullable=False)
    source_product_id: Mapped[Optional[str]] = mapped_column(Text, index=True)
    quantity: Mapped[Optional[int]] = mapped_column(Integer)
    availability: Mapped[Optional[str]] = mapped_column(String(100))
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SourceOrder(Base):
    __tablename__ = "source_orders"
    __table_args__ = (UniqueConstraint("source_platform", "source_order_id", name="uq_source_orders_platform_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_dataset: Mapped[str] = mapped_column(String(255), nullable=False)
    source_order_id: Mapped[str] = mapped_column(Text, nullable=False)
    source_user_id: Mapped[Optional[str]] = mapped_column(Text, index=True)
    order_number: Mapped[Optional[int]] = mapped_column(Integer)
    order_dow: Mapped[Optional[int]] = mapped_column(Integer)
    order_hour_of_day: Mapped[Optional[int]] = mapped_column(Integer)
    days_since_prior_order: Mapped[Optional[float]] = mapped_column(Float)
    eval_set: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SourceOrderItem(Base):
    __tablename__ = "source_order_items"
    __table_args__ = (
        UniqueConstraint(
            "source_platform",
            "source_order_id",
            "source_product_id",
            "add_to_cart_order",
            name="uq_source_order_items_platform_order_product_cart",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_dataset: Mapped[str] = mapped_column(String(255), nullable=False)
    source_order_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    source_product_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    add_to_cart_order: Mapped[Optional[int]] = mapped_column(Integer)
    reordered: Mapped[Optional[int]] = mapped_column(Integer)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
