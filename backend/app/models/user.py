import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    RETAILER = "retailer"
    DELIVERY_PARTNER = "delivery_partner"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    customer = relationship("Customer", back_populates="user", uselist=False, cascade="all, delete-orphan")
    retailer = relationship("Retailer", back_populates="user", uselist=False, cascade="all, delete-orphan")
    delivery_partner = relationship(
        "DeliveryPartner", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
