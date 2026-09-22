from typing import Any, Optional

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.geo_service import validate_coordinates


def get_route(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    base_url: Optional[str] = None,
) -> dict[str, Any]:
    validate_coordinates(origin_lat, origin_lng)
    validate_coordinates(destination_lat, destination_lng)

    osrm_base_url = (base_url or settings.OSRM_BASE_URL).rstrip("/")
    url = (
        f"{osrm_base_url}/route/v1/driving/"
        f"{origin_lng},{origin_lat};{destination_lng},{destination_lat}"
    )
    params = {"overview": "full", "geometries": "geojson"}

    try:
        response = httpx.get(url, params=params, timeout=5.0)
        response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Routing service timed out") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Routing service unavailable") from exc

    payload = response.json()
    routes = payload.get("routes") if isinstance(payload, dict) else None
    if not routes:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Routing service returned no route")

    route = routes[0]
    try:
        return {
            "distance_km": round(float(route["distance"]) / 1000, 3),
            "duration_minutes": round(float(route["duration"]) / 60, 2),
            "geometry": route.get("geometry"),
        }
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Invalid routing response") from exc
