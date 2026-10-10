from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.deps import UserContext, get_db, require_role
from app.models.inventory import Inventory
from app.models.inventory_adjustment import InventoryAdjustment
from app.models.product import Product
from app.models.store import Store
from app.schemas.inventory import (
    InventoryAdjustmentResponse,
    InventoryAnalysisResponse,
    InventoryConfirmRequest,
    InventoryConfirmResult,
)
from app.services.inventory_image_analyzer import InventoryImageAnalyzer
from app.services.product_service import get_store_for_retailer_user


router = APIRouter(prefix="/retailer/inventory", tags=["Retailer Inventory Onboarding"])
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}
MAX_SIZE_BYTES = 5 * 1024 * 1024


def _normalise(value: Optional[str]) -> str:
    return " ".join((value or "").lower().split())


def _catalog_name(item) -> str:
    name = " ".join(item.product_name.split())
    size = " ".join((getattr(item, "size", None) or "").split())
    if size and _normalise(size) not in _normalise(name):
        return f"{name} {size}"
    return name


def _find_exact_match(store_id: int, item, db: Session) -> Optional[Product]:
    product_name = _catalog_name(item)
    candidates = db.query(Product).filter(Product.store_id == store_id, Product.name.ilike(product_name)).all()
    for product in candidates:
        if _normalise(product.name) != _normalise(product_name):
            continue
        if _normalise(product.brand) != _normalise(item.brand):
            continue
        return product
    return None


@router.post("/analyze", response_model=InventoryAnalysisResponse, summary="Analyze a retailer inventory photo or bill")
async def analyze_inventory_image(
    file: UploadFile = File(...),
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPG, JPEG, PNG, WEBP, or PDF up to 5 MB.")
    content = await file.read(MAX_SIZE_BYTES + 1)
    if not content or len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The file must be between 1 byte and 5 MB.")
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")
    analyzer = InventoryImageAnalyzer()
    items, ocr_lines = await run_in_threadpool(
        analyzer.analyze_image,
        content,
        file.filename or "inventory-upload",
        file.content_type,
    )
    for item in items:
        match = _find_exact_match(store.id, item, db)
        if match:
            item.possible_existing_product_id = match.id
            item.warnings.append(f"Possible existing product found: {match.name}. Confirm before adding stock.")
    return InventoryAnalysisResponse(
        items=items,
        provider=analyzer.provider_name,
        raw_text_available=bool(ocr_lines),
        ocr_lines=[
            {
                "text": line.text,
                "confidence": line.confidence,
                "bounding_box": line.bounding_box,
                "page_index": line.page_index,
                "order": line.order,
            }
            for line in ocr_lines
        ],
    )


def _confirm_inventory(payload: InventoryConfirmRequest, current_user: UserContext, db: Session) -> list[InventoryConfirmResult]:
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")
    results: list[InventoryConfirmResult] = []
    try:
        # Serialize confirmations for one store so concurrent retries cannot both
        # pass the idempotency check and increment stock twice.
        store = db.query(Store).filter(Store.id == store.id).with_for_update().one()
        if payload.confirmation_id:
            previous = (
                db.query(InventoryAdjustment)
                .filter(
                    InventoryAdjustment.store_id == store.id,
                    InventoryAdjustment.batch_id == payload.confirmation_id,
                )
                .order_by(InventoryAdjustment.id.asc())
                .all()
            )
            if previous:
                return [
                    InventoryConfirmResult(
                        product_id=row.product_id,
                        inventory_id=row.inventory_id,
                        created=(row.quantity_after - row.delta == 0),
                        quantity_before=row.quantity_after - row.delta,
                        quantity_after=row.quantity_after,
                    )
                    for row in previous
                ]

        for item in payload.items:
            product: Optional[Product] = None
            if item.existing_product_id:
                product = db.query(Product).filter(Product.id == item.existing_product_id, Product.store_id == store.id).with_for_update().first()
                if not product:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected existing product was not found in your store")
            else:
                product = _find_exact_match(store.id, item, db)
            created = product is None
            if product is None:
                product = Product(
                    store_id=store.id,
                    name=_catalog_name(item),
                    brand=item.brand,
                    category=item.category,
                    price=item.price,
                    handling_type=item.handling_type,
                    requires_special_equipment=item.requires_special_equipment,
                )
                db.add(product)
                db.flush()
            else:
                product.brand = item.brand or product.brand
                product.category = item.category or product.category
                product.price = item.price
                product.handling_type = item.handling_type
                product.requires_special_equipment = item.requires_special_equipment

            inventory = db.query(Inventory).filter(
                and_(Inventory.store_id == store.id, Inventory.product_id == product.id)
            ).with_for_update().first()
            if inventory is None:
                inventory = Inventory(
                    store_id=store.id,
                    product_id=product.id,
                    quantity=0,
                    unit=item.unit,
                    expiry_date=item.expiry_date,
                    low_stock_threshold=item.low_stock_threshold,
                    is_available=True,
                )
                db.add(inventory)
                db.flush()
            before = inventory.quantity
            inventory.quantity += item.quantity
            inventory.unit = item.unit
            inventory.expiry_date = item.expiry_date or inventory.expiry_date
            inventory.low_stock_threshold = item.low_stock_threshold
            inventory.is_available = True
            db.add(InventoryAdjustment(
                inventory_id=inventory.id,
                store_id=store.id,
                product_id=product.id,
                delta=item.quantity,
                quantity_after=inventory.quantity,
                source=payload.source,
                batch_id=payload.confirmation_id,
            ))
            results.append(InventoryConfirmResult(product_id=product.id, inventory_id=inventory.id, created=created, quantity_before=before, quantity_after=inventory.quantity))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return results


@router.post("/confirm", response_model=list[InventoryConfirmResult], status_code=status.HTTP_201_CREATED, summary="Confirm reviewed inventory additions")
def confirm_inventory(payload: InventoryConfirmRequest, current_user: UserContext = Depends(require_role(["retailer"])), db: Session = Depends(get_db)):
    return _confirm_inventory(payload, current_user, db)


@router.post("/manual", response_model=list[InventoryConfirmResult], status_code=status.HTTP_201_CREATED, summary="Add retailer inventory manually")
def add_inventory_manually(payload: InventoryConfirmRequest, current_user: UserContext = Depends(require_role(["retailer"])), db: Session = Depends(get_db)):
    payload.source = "MANUAL"
    return _confirm_inventory(payload, current_user, db)


@router.get("/history", response_model=list[InventoryAdjustmentResponse], summary="Get inventory adjustment history for own store")
def get_inventory_history(current_user: UserContext = Depends(require_role(["retailer"])), db: Session = Depends(get_db)):
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")
    rows = db.query(InventoryAdjustment).filter(InventoryAdjustment.store_id == store.id).order_by(InventoryAdjustment.created_at.desc()).limit(100).all()
    return [InventoryAdjustmentResponse.model_validate(row, from_attributes=True) for row in rows]
