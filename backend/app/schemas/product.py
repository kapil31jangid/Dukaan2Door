from typing import List, Optional
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Product title")
    brand: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    price: float = Field(..., gt=0, description="Price must be strictly positive")
    image_url: Optional[str] = None
    handling_type: str = Field("NORMAL", pattern="^(NORMAL|FROZEN|FRAGILE|PERISHABLE)$")
    requires_special_equipment: bool = False
    initial_stock: int = Field(0, ge=0, description="Initial inventory stock count")
    is_available: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    image_url: Optional[str] = None
    handling_type: Optional[str] = Field(None, pattern="^(NORMAL|FROZEN|FRAGILE|PERISHABLE)$")
    requires_special_equipment: Optional[bool] = None
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
    brand: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    handling_type: str = "NORMAL"
    requires_special_equipment: bool = False
    is_active: bool = True
    quantity: int = 0
    is_available: bool = True
    unit: str = "unit"
    expiry_date: Optional[str] = None
    low_stock_threshold: int = 5


class PaginatedProductResponse(BaseModel):
    total: int
    page: int
    page_size: int
    products: List[ProductResponse]
