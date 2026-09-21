from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hashing():
    raw_password = "SecurePassword123!"
    hashed = get_password_hash(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_encoding_decoding():
    token = create_access_token(subject=42, role="retailer")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["role"] == "retailer"


def test_invalid_jwt_token():
    invalid_token = "invalid.token.signature"
    payload = decode_access_token(invalid_token)
    assert payload is None
