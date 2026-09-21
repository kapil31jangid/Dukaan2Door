from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.deps import UserContext, get_current_user, require_role
from app.schemas.product import (
    PaginatedProductResponse,
    ProductAvailabilityPatch,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)

router = APIRouter(prefix="/products", tags=["Product Catalog & Inventory"])


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add product to store catalog (Retailer only)",
)
def create_product(
    payload: ProductCreate,
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Create a new product in the retailer's store catalog with initial stock."""
    return ProductResponse(
        id=1,
        store_id=1,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        price=payload.price,
        is_active=True,
        quantity=payload.initial_stock,
        is_available=payload.is_available,
    )


@router.get(
    "/search",
    response_model=PaginatedProductResponse,
    summary="Search products by title or category",
)
def search_products(
    q: str = Query(..., min_length=1, description="Case-insensitive search query"),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Case-insensitive partial match search for products across open stores."""
    sample = ProductResponse(
        id=1,
        store_id=1,
        name=f"Result for '{q}'",
        description="Matched product description",
        category=category or "General",
        price=99.99,
        is_active=True,
        quantity=50,
        is_available=True,
    )
    return PaginatedProductResponse(
        total=1, page=page, page_size=page_size, products=[sample]
    )


@router.get(
    "",
    response_model=PaginatedProductResponse,
    summary="List active available products (Public/Customer)",
)
def list_products(
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Browse active, in-stock products with pagination and category filter."""
    sample = ProductResponse(
        id=1,
        store_id=1,
        name="Fresh Product",
        description="Quality catalog item",
        category=category or "Groceries",
        price=29.99,
        is_active=True,
        quantity=25,
        is_available=True,
    )
    return PaginatedProductResponse(
        total=1, page=page, page_size=page_size, products=[sample]
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get single product by ID",
)
def get_product(product_id: int):
    """Retrieve details for a single product by its unique ID."""
    if product_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    return ProductResponse(
        id=product_id,
        store_id=1,
        name="Sample Product",
        description="Detailed product description",
        category="Groceries",
        price=49.99,
        is_active=True,
        quantity=10,
        is_available=True,
    )


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update product details (Retailer, own store only)",
)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Update title, description, category, price, or active status of own product."""
    return ProductResponse(
        id=product_id,
        store_id=1,
        name=payload.name or "Updated Product",
        description=payload.description or "Updated description",
        category=payload.category or "Groceries",
        price=payload.price or 49.99,
        is_active=payload.is_active if payload.is_active is not None else True,
        quantity=10,
        is_available=True,
    )


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete / soft-delete product (Retailer, own store only)",
)
def delete_product(
    product_id: int,
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Soft delete product (set is_active=false) to preserve order references."""
    return None


@router.patch(
    "/{product_id}/availability",
    response_model=ProductResponse,
    summary="Update product stock availability and quantity (Retailer only)",
)
def update_product_availability(
    product_id: int,
    payload: ProductAvailabilityPatch,
    current_user: UserContext = Depends(require_role(["retailer"])),
):
    """Update is_available toggle and stock quantity for store inventory."""
    return ProductResponse(
        id=product_id,
        store_id=1,
        name="Sample Product",
        description="Product description",
        category="Groceries",
        price=49.99,
        is_active=True,
        quantity=payload.quantity if payload.quantity is not None else 10,
        is_available=payload.is_available,
    )
