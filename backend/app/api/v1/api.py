from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    customers,
    deliveries,
    delivery_partners,
    matching,
    orders,
    products,
    retailers,
    uploads,
    websocket,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(customers.router)
api_router.include_router(retailers.router)
api_router.include_router(delivery_partners.router)
api_router.include_router(products.router)
api_router.include_router(matching.router)
api_router.include_router(orders.router)
api_router.include_router(deliveries.router)
api_router.include_router(websocket.router)
api_router.include_router(uploads.router)
