from typing import List, Optional
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Product title")
    description: Optional[str] = None
    category: Optional[str] = None
    price: float = Field(..., gt=0, description="Price must be strictly positive")
    initial_stock: int = Field(0, ge=0, description="Initial inventory stock count")
    is_available: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None


class InventoryStockUpdate(BaseModel):
    quantity: int = Field(..., ge=0, description="Stock quantity cannot be negative")
    is_available: Optional[bool] = None


class ProductAvailabilityPatch(BaseModel):
    is_available: bool
    quantity: Optional[int] = Field(None, ge=0)


class ProductResponse(BaseModel):
    id: int
    store_id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    is_active: bool = True
    quantity: int = 0
    is_available: bool = True


class PaginatedProductResponse(BaseModel):
    total: int
    page: int
    page_size: int
    products: List[ProductResponse]
