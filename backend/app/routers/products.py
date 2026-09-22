from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.deps import UserContext, get_db, require_role
from app.models.inventory import Inventory
from app.models.product import Product
from app.schemas.product import (
    PaginatedProductResponse,
    ProductAvailabilityPatch,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.services.product_service import get_store_for_retailer_user, product_to_response

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
    db: Session = Depends(get_db),
):
    """Create a new product in the retailer's store catalog with initial stock."""
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")

    product = Product(
        store_id=store.id,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        price=payload.price,
    )
    db.add(product)
    db.flush()
    db.add(
        Inventory(
            store_id=store.id,
            product_id=product.id,
            quantity=payload.initial_stock,
            is_available=payload.is_available,
        )
    )
    db.commit()
    db.refresh(product)
    return ProductResponse(**product_to_response(product))


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
    db: Session = Depends(get_db),
):
    """Case-insensitive partial match search for products across open stores."""
    query = (
        db.query(Product)
        .join(Product.store)
        .outerjoin(Product.inventory)
        .filter(
            Product.is_active.is_(True),
            or_(Product.name.ilike(f"%{q}%"), Product.category.ilike(f"%{q}%")),
        )
    )
    if category:
        query = query.filter(Product.category == category)
    total = query.count()
    products = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedProductResponse(
        total=total,
        page=page,
        page_size=page_size,
        products=[ProductResponse(**product_to_response(product)) for product in products],
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
    db: Session = Depends(get_db),
):
    """Browse active, in-stock products with pagination and category filter."""
    query = db.query(Product).filter(Product.is_active.is_(True))
    if category:
        query = query.filter(Product.category == category)
    total = query.count()
    products = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedProductResponse(
        total=total,
        page=page,
        page_size=page_size,
        products=[ProductResponse(**product_to_response(product)) for product in products],
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get single product by ID",
)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a single product by its unique ID."""
    product = db.query(Product).filter(Product.id == product_id, Product.is_active.is_(True)).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    return ProductResponse(**product_to_response(product))


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update product details (Retailer, own store only)",
)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Update title, description, category, price, or active status of own product."""
    store = get_store_for_retailer_user(db, current_user.user_id)
    product = db.query(Product).filter(Product.id == product_id, Product.store_id == store.id).first() if store else None
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return ProductResponse(**product_to_response(product))


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete / soft-delete product (Retailer, own store only)",
)
def delete_product(
    product_id: int,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    """Soft delete product (set is_active=false) to preserve order references."""
    store = get_store_for_retailer_user(db, current_user.user_id)
    product = db.query(Product).filter(Product.id == product_id, Product.store_id == store.id).first() if store else None
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product.is_active = False
    db.commit()
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
    db: Session = Depends(get_db),
):
    """Update is_available toggle and stock quantity for store inventory."""
    store = get_store_for_retailer_user(db, current_user.user_id)
    product = db.query(Product).filter(Product.id == product_id, Product.store_id == store.id).first() if store else None
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    inventory = product.inventory
    if not inventory:
        inventory = Inventory(store_id=store.id, product_id=product.id, quantity=0)
        db.add(inventory)
    inventory.is_available = payload.is_available
    if payload.quantity is not None:
        inventory.quantity = payload.quantity
    db.commit()
    db.refresh(product)
    return ProductResponse(**product_to_response(product))
