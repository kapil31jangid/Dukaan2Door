from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeliveryPartner(Base):
    __tablename__ = "delivery_partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    vehicle_info: Mapped[Optional[str]] = mapped_column(String(255))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    current_lat: Mapped[Optional[float]] = mapped_column(Float)
    current_lng: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="delivery_partner")
    deliveries = relationship("Delivery", back_populates="delivery_partner")
