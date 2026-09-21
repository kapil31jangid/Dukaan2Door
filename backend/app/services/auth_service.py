from typing import Any, Dict
from app.core.security import get_password_hash, verify_password


def prepare_user_registration(data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare and hash password for user registration."""
    hashed_password = get_password_hash(data["password"])
    registration_payload = {**data, "hashed_password": hashed_password}
    registration_payload.pop("password", None)
    return registration_payload
