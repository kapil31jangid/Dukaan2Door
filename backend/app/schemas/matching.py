from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.services.geo_service import validate_coordinates


class MatchingItem(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class StoreMatchRequest(BaseModel):
    latitude: float
    longitude: float
    items: List[MatchingItem] = Field(..., min_length=1)

    @field_validator("longitude")
    @classmethod
    def validate_location(cls, longitude: float, info):
        latitude = info.data.get("latitude")
        if latitude is not None:
            validate_coordinates(latitude, longitude)
        return longitude


class StoreMatchResponse(BaseModel):
    matched: bool
    store_id: Optional[int] = None
    search_radius_km: Optional[int] = None
    distance_km: Optional[float] = None
    reason: Optional[str] = None
