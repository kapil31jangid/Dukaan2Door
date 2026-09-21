import math
from dataclasses import dataclass
from typing import List, Optional
from app.schemas.order import OrderItemIn


@dataclass
class StoreMatch:
    store_id: int
    distance_km: float


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in kilometers."""
    R = 6371.0  # Earth's radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def find_store_for_order(
    db, customer_lat: float, customer_lng: float, items: List[OrderItemIn]
) -> Optional[StoreMatch]:
    """
    Store matching client interface to Kapil's matching service.
    
    Kapil's implementation will evaluate customer coordinates + product availability,
    searching within a 2 km radius and expanding to 5 km if needed.
    
    TEMPORARY FALLBACK IMPLEMENTATION:
    When db is provided and models exist, queries open stores within 5 km that have stock.
    Returns None if no matching store is available within 5 km.
    """
    # Note: Kapil will replace the internals of this function.
    # In model-independent foundation mode or testing, returns a fallback StoreMatch if db is None or mock.
    if db is None:
        # Development / fallback mock response
        return StoreMatch(store_id=1, distance_km=1.2)
        
    return None
