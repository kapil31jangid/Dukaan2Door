from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class OrderStatus(str, Enum):
    RECEIVED = "RECEIVED"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# Allowed state transitions graph
VALID_ORDER_TRANSITIONS = {
    OrderStatus.RECEIVED: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
    OrderStatus.ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    OrderStatus.PREPARING: [OrderStatus.READY_FOR_PICKUP],
    OrderStatus.READY_FOR_PICKUP: [OrderStatus.OUT_FOR_DELIVERY],
    OrderStatus.OUT_FOR_DELIVERY: [OrderStatus.DELIVERED],
    OrderStatus.DELIVERED: [],
    OrderStatus.REJECTED: [],
    OrderStatus.CANCELLED: [],
}


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Quantity must be at least 1")


class OrderCreate(BaseModel):
    items: List[OrderItemIn] = Field(..., min_length=1, description="Order must contain at least one item")
    delivery_address: Optional[str] = Field(None, min_length=1)
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    notes: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    store_id: int
    status: OrderStatus
    total_amount: float
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    delivery_partner_id: Optional[int] = None
    delivery_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    items: List[OrderItemResponse] = []


class OrderStatusUpdate(BaseModel):
    status: OrderStatus = Field(..., description="Target lifecycle status for order transition")


class OrderUpdate(BaseModel):
    notes: Optional[str] = None


class OrderStatusHistoryItem(BaseModel):
    status: str
    timestamp: str
    note: Optional[str] = None


class OrderStatusTrackingResponse(BaseModel):
    order_id: int
    current_status: OrderStatus
    updated_at: str
    history: List[OrderStatusHistoryItem] = []
