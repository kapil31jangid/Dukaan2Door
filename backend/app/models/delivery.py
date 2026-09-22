import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeliveryStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class Delivery(Base):
    __tablename__ = "deliveries"
    __table_args__ = (UniqueConstraint("order_id", name="uq_deliveries_order_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    delivery_partner_id: Mapped[Optional[int]] = mapped_column(ForeignKey("delivery_partners.id"), index=True)
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="delivery_status"), default=DeliveryStatus.ASSIGNED, nullable=False, index=True
    )
    pickup_address: Mapped[Optional[str]] = mapped_column(String(500))
    pickup_lat: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_lng: Mapped[float] = mapped_column(Float, nullable=False)
    destination_address: Mapped[str] = mapped_column(String(500), nullable=False)
    destination_lat: Mapped[float] = mapped_column(Float, nullable=False)
    destination_lng: Mapped[float] = mapped_column(Float, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    picked_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    order = relationship("Order", back_populates="delivery")
    delivery_partner = relationship("DeliveryPartner", back_populates="deliveries")
    tracking_updates = relationship("DeliveryTracking", back_populates="delivery", cascade="all, delete-orphan")


class DeliveryTracking(Base):
    __tablename__ = "delivery_tracking"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    delivery_id: Mapped[int] = mapped_column(ForeignKey("deliveries.id"), nullable=False, index=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[Optional[DeliveryStatus]] = mapped_column(Enum(DeliveryStatus, name="delivery_status"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    delivery = relationship("Delivery", back_populates="tracking_updates")
