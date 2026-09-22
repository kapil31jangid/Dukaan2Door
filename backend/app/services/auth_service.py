from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.delivery_partner import DeliveryPartner
from app.models.retailer import Retailer
from app.models.store import Store
from app.models.user import User, UserRole
from app.core.security import get_password_hash, verify_password


def prepare_user_registration(data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare and hash password for user registration."""
    hashed_password = get_password_hash(data["password"])
    registration_payload = {**data, "hashed_password": hashed_password}
    registration_payload.pop("password", None)
    return registration_payload


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()


def create_user_with_profile(db: Session, data: Dict[str, Any]) -> User:
    payload = prepare_user_registration(data)
    role = UserRole(payload["role"])
    user = User(
        email=payload["email"],
        hashed_password=payload["hashed_password"],
        role=role,
    )
    db.add(user)
    db.flush()

    if role == UserRole.CUSTOMER:
        db.add(
            Customer(
                user_id=user.id,
                name=payload["name"],
                phone=payload.get("phone"),
                delivery_address=payload.get("delivery_address"),
                lat=payload.get("lat"),
                lng=payload.get("lng"),
            )
        )
    elif role == UserRole.RETAILER:
        retailer = Retailer(user_id=user.id, name=payload["name"], phone=payload.get("phone"))
        db.add(retailer)
        db.flush()
        db.add(
            Store(
                retailer_id=retailer.id,
                store_name=payload.get("store_name") or f"{payload['name']}'s Store",
                lat=payload.get("lat"),
                lng=payload.get("lng"),
                operating_hours=payload.get("operating_hours"),
            )
        )
    elif role == UserRole.DELIVERY_PARTNER:
        db.add(
            DeliveryPartner(
                user_id=user.id,
                name=payload["name"],
                phone=payload.get("phone"),
                vehicle_info=payload.get("vehicle_info"),
            )
        )

    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
