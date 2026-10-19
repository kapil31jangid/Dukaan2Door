from dataclasses import dataclass, field
from datetime import date, datetime
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


HandlingType = Literal["NORMAL", "FROZEN", "FRAGILE", "PERISHABLE"]


from app.services.ocr_service import OCRTextLine


class GeminiProductCandidate(BaseModel):
    product_name: Optional[str] = Field(default=None, description="Product name exactly as written in the source document")
    english_product_name: Optional[str] = Field(default=None, description="Accurate normalized English translation of product_name when the source uses another language")
    brand: Optional[str] = Field(default=None, description="Distinguishable brand name if explicitly visible")
    quantity: Optional[int] = Field(default=None, description="Count or quantity of items, integer > 0, null if unreadable or ambiguous")
    unit: Optional[str] = Field(default=None, description="Stock or sale unit (e.g. pcs, packs, packets, bottles, kg, g, l, ml, units)")
    size: Optional[str] = Field(default=None, description="Package size or weight (e.g. 500ml, 1kg, 250g, 70g)")
    unit_price: Optional[float] = Field(default=None, description="Unit rate or selling price per item, float >= 0, null if missing")
    total_price: Optional[float] = Field(default=None, description="Total amount or line total, float >= 0, null if missing")
    printed_mrp: Optional[float] = Field(default=None, description="Printed MRP visible on product packaging, null if missing or unreadable")
    category: Optional[str] = Field(default=None, description="One of: Groceries, Snacks & Packaged Foods, Beverages, Dairy & Bakery, Fruits & Vegetables, Household Cleaning, Personal Care, Baby Care, Pooja & Daily Essentials, Frozen, Other Kirana")
    handling_requirement: Optional[str] = Field(default=None, description="One of: NORMAL, FROZEN, PERISHABLE, FRAGILE")
    needs_review: bool = Field(default=False, description="True if any critical detail (name, qty, price) is ambiguous, handwritten poorly, or uncertain")
    review_reason: Optional[str] = Field(default=None, description="Explanation if needs_review is true")


class GeminiInventoryAnalysisResult(BaseModel):
    document_type: str = Field(..., description="Document type: 'PRINTED_INVOICE', 'HANDWRITTEN_LIST', 'MIXED_BILL', 'SHELF_IMAGE', 'UNKNOWN'")
    products: list[GeminiProductCandidate] = Field(default_factory=list, description="Extracted inventory product candidates")
    warnings: list[str] = Field(default_factory=list, description="General document level warnings or observations")


class ExtractedInventoryItem(BaseModel):
    product_name: str = Field(default="", max_length=255)
    original_product_name: Optional[str] = Field(default=None, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=120)
    quantity: Optional[int] = Field(default=None, ge=1)
    unit: Optional[str] = Field(default=None, max_length=60)
    size: Optional[str] = Field(default=None, max_length=60)
    price: Optional[float] = Field(default=None, gt=0)
    total_price: Optional[float] = Field(default=None, gt=0)
    printed_mrp: Optional[float] = Field(default=None, gt=0)
    category: Optional[str] = Field(default=None, max_length=120)
    expiry_date: Optional[date] = None
    handling_type: Optional[HandlingType] = None
    requires_special_equipment: Optional[bool] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    needs_review: bool = True
    review_reason: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    possible_existing_product_id: Optional[int] = None
    catalog_matches: list["CatalogMatchCandidate"] = Field(default_factory=list)


class CatalogMatchCandidate(BaseModel):
    product_id: int
    name: str
    brand: Optional[str] = None
    unit: str
    current_stock: int
    price: float
    match_reason: str


class OCRTextLineResponse(BaseModel):
    text: str
    confidence: Optional[float] = Field(None, ge=0, le=1)
    bounding_box: list[list[float]] = Field(default_factory=list)
    page_index: int = 0
    order: int = 0


class InventoryAnalysisResponse(BaseModel):
    items: list[ExtractedInventoryItem]
    provider: str
    raw_text_available: bool = False
    document_type: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    ocr_lines: list[OCRTextLineResponse] = Field(default_factory=list)
    analysis_mode: Literal["DOCUMENT", "PRODUCT_PHOTO"] = "DOCUMENT"


class InventoryConfirmItem(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=255)
    brand: Optional[str] = Field(None, max_length=120)
    size: Optional[str] = Field(None, max_length=60)
    quantity: int = Field(..., ge=1)
    unit: str = Field("unit", min_length=1, max_length=60)
    price: float = Field(..., gt=0)
    category: Optional[str] = Field(None, max_length=120)
    expiry_date: Optional[date] = None
    handling_type: HandlingType = "NORMAL"
    requires_special_equipment: bool = False
    existing_product_id: Optional[int] = Field(None, ge=1)
    low_stock_threshold: int = Field(5, ge=0)

    @field_validator("product_name", "unit")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("product_name")
    @classmethod
    def require_english_catalog_name(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value) or re.search(r"[\u0900-\u097f]", value):
            raise ValueError("Product name must use the reviewed English catalog name")
        return value


class InventoryConfirmRequest(BaseModel):
    items: list[InventoryConfirmItem] = Field(..., min_length=1, max_length=100)
    source: Literal["IMAGE_ASSISTED", "MANUAL"] = "IMAGE_ASSISTED"
    confirmation_id: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=100,
        pattern=r"^[A-Za-z0-9._:-]+$",
        description="Client-generated key reused when retrying the same confirmation.",
    )


class InventoryConfirmResult(BaseModel):
    product_id: int
    inventory_id: int
    created: bool
    quantity_before: int
    quantity_after: int


class InventoryAdjustmentResponse(BaseModel):
    id: int
    inventory_id: int
    product_id: int
    delta: int
    quantity_after: int
    source: str
    batch_id: Optional[str] = None
    note: Optional[str] = None
    actor_user_id: Optional[int] = None
    created_at: datetime


InventoryAdjustmentDirection = Literal["ADD", "REDUCE"]
InventoryAdjustmentReason = Literal[
    "NEW_STOCK_RECEIVED",
    "OFFLINE_SALE",
    "DAMAGED_PRODUCT",
    "EXPIRED_PRODUCT",
    "MANUAL_CORRECTION",
]


class InventoryStockAdjustmentRequest(BaseModel):
    product_id: int = Field(..., ge=1)
    direction: InventoryAdjustmentDirection
    quantity: int = Field(..., ge=1, le=100000)
    reason: InventoryAdjustmentReason
    source: Literal["PRODUCT_PHOTO", "MANUAL_ADJUSTMENT"] = "MANUAL_ADJUSTMENT"
    confirmation_id: str = Field(
        ...,
        min_length=8,
        max_length=100,
        pattern=r"^[A-Za-z0-9._:-]+$",
        description="Client-generated key reused when retrying this exact adjustment.",
    )


class InventoryStockAdjustmentResult(BaseModel):
    product_id: int
    inventory_id: int
    direction: InventoryAdjustmentDirection
    quantity: int
    reason: InventoryAdjustmentReason
    quantity_before: int
    quantity_after: int
    confirmation_id: str
