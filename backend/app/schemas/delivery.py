from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.services.geo_service import validate_coordinates


class DeliveryStatus(str, Enum):
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    PICKED_UP = "PICKED_UP"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class DeliveryLocationSource(str, Enum):
    GPS = "GPS"
    DEMO_SIMULATION = "DEMO_SIMULATION"
    LIFECYCLE = "LIFECYCLE"


class DeliveryResponse(BaseModel):
    id: int
    order_id: int
    delivery_partner_id: Optional[int] = None
    status: DeliveryStatus
    pickup_address: Optional[str] = None
    pickup_lat: float
    pickup_lng: float
    destination_address: str
    destination_lat: float
    destination_lng: float
    assigned_at: datetime
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus


class DeliveryRejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class DeliveryLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = Field(default=None, ge=0)
    captured_at: Optional[datetime] = None
    source: DeliveryLocationSource = DeliveryLocationSource.GPS

    @field_validator("longitude")
    @classmethod
    def validate_location(cls, longitude: float, info):
        latitude = info.data.get("latitude")
        if latitude is not None:
            validate_coordinates(latitude, longitude)
        return longitude


class DeliveryTrackingResponse(BaseModel):
    id: int
    delivery_id: int
    latitude: float = Field(alias="lat")
    longitude: float = Field(alias="lng")
    accuracy_m: Optional[float] = None
    source: DeliveryLocationSource = DeliveryLocationSource.GPS
    status: Optional[DeliveryStatus] = None
    recorded_at: datetime

    @field_validator("recorded_at", mode="before")
    @classmethod
    def serialize_recorded_at_as_utc(cls, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    model_config = {"from_attributes": True, "populate_by_name": True}


class RouteResponse(BaseModel):
    pickup_lat: float
    pickup_lng: float
    destination_lat: float
    destination_lng: float
    distance_km: float
    duration_minutes: float
    geometry: Optional[Any] = None


class DeliveryAssignmentResponse(BaseModel):
    assigned: bool
    delivery: Optional[DeliveryResponse] = None
    distance_km: Optional[float] = None
    reason: Optional[str] = None


class DeliveryTrackingListResponse(BaseModel):
    updates: List[DeliveryTrackingResponse]
