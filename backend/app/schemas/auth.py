from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    role: str = Field(..., description="Role must be customer, retailer, or delivery_partner")
    name: str = Field(..., min_length=1)
    phone: Optional[str] = None

    # Role specific initial profile fields
    delivery_address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    store_name: Optional[str] = None
    operating_hours: Optional[str] = None
    vehicle_info: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int


class UserMeResponse(BaseModel):
    user_id: int
    email: str
    role: str
    name: Optional[str] = None
    phone: Optional[str] = None
