from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"), unique=True, nullable=False)
    store_name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    lat: Mapped[Optional[float]] = mapped_column(Float, index=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, index=True)
    operating_hours: Mapped[Optional[str]] = mapped_column(String(255))
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    retailer = relationship("Retailer", back_populates="store")
    products = relationship("Product", back_populates="store")
    inventory_items = relationship("Inventory", back_populates="store", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="store")
