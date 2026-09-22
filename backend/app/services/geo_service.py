import math

from fastapi import HTTPException, status


EARTH_RADIUS_KM = 6371.0088


def validate_coordinates(latitude: float, longitude: float) -> None:
    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude and longitude are required",
        )
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coordinates must be finite numbers")
    if not -90 <= latitude <= 90:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Latitude must be between -90 and 90")
    if not -180 <= longitude <= 180:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Longitude must be between -180 and 180")


def has_valid_coordinates(latitude: float, longitude: float) -> bool:
    try:
        validate_coordinates(latitude, longitude)
    except HTTPException:
        return False
    return True


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    validate_coordinates(lat1, lon1)
    validate_coordinates(lat2, lon2)

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    central_angle = 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    return EARTH_RADIUS_KM * central_angle
