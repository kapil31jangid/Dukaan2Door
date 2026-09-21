from typing import Optional
from pydantic import BaseModel, Field


class CustomerProfile(BaseModel):
    id: int
    user_id: int
    name: str
    phone: Optional[str] = None
    delivery_address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    delivery_address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class RetailerProfile(BaseModel):
    id: int
    user_id: int
    name: str
    phone: Optional[str] = None


class RetailerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class StoreProfile(BaseModel):
    id: int
    retailer_id: int
    store_name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    operating_hours: Optional[str] = None
    is_open: bool = True


class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    operating_hours: Optional[str] = None
    is_open: Optional[bool] = None


class DeliveryPartnerProfile(BaseModel):
    id: int
    user_id: int
    name: str
    phone: Optional[str] = None
    vehicle_info: Optional[str] = None
    is_available: bool = True


class DeliveryPartnerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    vehicle_info: Optional[str] = None
    is_available: Optional[bool] = None
