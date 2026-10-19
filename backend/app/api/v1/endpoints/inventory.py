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
    CatalogMatchCandidate,
    InventoryAdjustmentResponse,
    InventoryAnalysisResponse,
    InventoryConfirmRequest,
    InventoryConfirmResult,
    InventoryStockAdjustmentRequest,
    InventoryStockAdjustmentResult,
)
from app.services.inventory_image_analyzer import InventoryImageAnalyzer
from app.services.product_service import get_store_for_retailer_user


router = APIRouter(prefix="/retailer/inventory", tags=["Retailer Inventory Onboarding"])
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
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


def _find_catalog_matches(store_id: int, item, db: Session) -> list[CatalogMatchCandidate]:
    candidate_name = _normalise(_catalog_name(item))
    source_name = _normalise(item.product_name)
    candidate_brand = _normalise(item.brand)
    candidate_size = _normalise(getattr(item, "size", None)).replace(" ", "")
    ranked: list[tuple[int, Product, str]] = []

    products = db.query(Product).filter(Product.store_id == store_id, Product.is_active.is_(True)).all()
    for product in products:
        product_name = _normalise(product.name)
        compact_product_name = product_name.replace(" ", "")
        product_brand = _normalise(product.brand)
        if candidate_brand and product_brand and candidate_brand != product_brand:
            continue
        if candidate_size and candidate_size not in compact_product_name:
            continue

        score = 0
        reason = ""
        if product_name == candidate_name:
            score, reason = 100, "Exact reviewed name, brand, and pack-size match"
        elif product_name == source_name:
            score, reason = 95, "Exact visible product-name match"
        else:
            source_tokens = set(source_name.split())
            product_tokens = set(product_name.split())
            overlap = len(source_tokens & product_tokens) / max(1, len(source_tokens))
            if overlap >= 0.75:
                score, reason = int(overlap * 80), "Strong name-token match; retailer selection required"
        if score:
            ranked.append((score, product, reason))

    matches: list[CatalogMatchCandidate] = []
    for score, product, reason in sorted(ranked, key=lambda value: (-value[0], value[1].id))[:5]:
        inventory = (
            db.query(Inventory)
            .filter(Inventory.store_id == store_id, Inventory.product_id == product.id)
            .first()
        )
        matches.append(
            CatalogMatchCandidate(
                product_id=product.id,
                name=product.name,
                brand=product.brand,
                unit=inventory.unit if inventory else "unit",
                current_stock=inventory.quantity if inventory else 0,
                price=product.price,
                match_reason=reason,
            )
        )
    return matches


def _add_catalog_matches(store_id: int, items, db: Session) -> None:
    for item in items:
        matches = _find_catalog_matches(store_id, item, db)
        item.catalog_matches = matches
        exact_matches = [match for match in matches if match.match_reason.startswith("Exact reviewed")]
        if len(exact_matches) == 1:
            item.possible_existing_product_id = exact_matches[0].product_id
        elif len(matches) > 1:
            item.possible_existing_product_id = None
            item.needs_review = True
            item.warnings.append("Multiple catalogue products may match. Select the correct product and pack size.")


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
    _add_catalog_matches(store.id, items, db)
    for item in items:
        if item.possible_existing_product_id:
            match = next((value for value in item.catalog_matches if value.product_id == item.possible_existing_product_id), None)
            if match:
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


@router.post(
    "/analyze-product-photo",
    response_model=InventoryAnalysisResponse,
    summary="Analyze product packaging without changing inventory",
)
async def analyze_product_photo(
    file: UploadFile = File(...),
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a JPG, JPEG, PNG, or WEBP product photo up to 5 MB.",
        )
    content = await file.read(MAX_SIZE_BYTES + 1)
    if not content or len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The product photo must be between 1 byte and 5 MB.",
        )
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")

    analyzer = InventoryImageAnalyzer()
    items, ocr_lines = await run_in_threadpool(
        analyzer.analyze_product_photo,
        content,
        file.filename or "product-photo",
        file.content_type,
    )
    _add_catalog_matches(store.id, items, db)
    for item in items:
        item.needs_review = True
        if not item.catalog_matches:
            item.warnings.append("No catalogue match was found. Use the authorized Add Product workflow first.")

    return InventoryAnalysisResponse(
        items=items,
        provider=analyzer.provider_name,
        raw_text_available=bool(ocr_lines),
        document_type="SHELF_IMAGE",
        analysis_mode="PRODUCT_PHOTO",
        warnings=["Product photos never update stock automatically. Select a catalogue match and confirm an adjustment."],
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
                actor_user_id=current_user.user_id,
                note="NEW_STOCK_RECEIVED",
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


@router.post(
    "/adjust",
    response_model=InventoryStockAdjustmentResult,
    summary="Confirm an explicit stock addition or reduction for an existing product",
)
def adjust_inventory_stock(
    payload: InventoryStockAdjustmentRequest,
    current_user: UserContext = Depends(require_role(["retailer"])),
    db: Session = Depends(get_db),
):
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")

    try:
        store = db.query(Store).filter(Store.id == store.id).with_for_update().one()
        previous = (
            db.query(InventoryAdjustment)
            .filter(
                InventoryAdjustment.store_id == store.id,
                InventoryAdjustment.batch_id == payload.confirmation_id,
            )
            .first()
        )
        if previous:
            if previous.source not in {"PRODUCT_PHOTO", "MANUAL_ADJUSTMENT"}:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirmation key was already used for another inventory operation")
            direction = "ADD" if previous.delta > 0 else "REDUCE"
            return InventoryStockAdjustmentResult(
                product_id=previous.product_id,
                inventory_id=previous.inventory_id,
                direction=direction,
                quantity=abs(previous.delta),
                reason=previous.note,
                quantity_before=previous.quantity_after - previous.delta,
                quantity_after=previous.quantity_after,
                confirmation_id=payload.confirmation_id,
            )

        product = (
            db.query(Product)
            .filter(Product.id == payload.product_id, Product.store_id == store.id, Product.is_active.is_(True))
            .with_for_update()
            .first()
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected catalogue product was not found in your store")

        inventory = (
            db.query(Inventory)
            .filter(Inventory.store_id == store.id, Inventory.product_id == product.id)
            .with_for_update()
            .first()
        )
        if inventory is None:
            inventory = Inventory(store_id=store.id, product_id=product.id, quantity=0, is_available=False)
            db.add(inventory)
            db.flush()

        before = inventory.quantity
        delta = payload.quantity if payload.direction == "ADD" else -payload.quantity
        after = before + delta
        if after < 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot reduce {payload.quantity}; current stock is {before}",
            )

        inventory.quantity = after
        if after == 0:
            inventory.is_available = False
        elif payload.direction == "ADD":
            inventory.is_available = True

        db.add(
            InventoryAdjustment(
                inventory_id=inventory.id,
                store_id=store.id,
                product_id=product.id,
                delta=delta,
                quantity_after=after,
                source=payload.source,
                batch_id=payload.confirmation_id,
                actor_user_id=current_user.user_id,
                note=payload.reason,
            )
        )
        db.commit()
        return InventoryStockAdjustmentResult(
            product_id=product.id,
            inventory_id=inventory.id,
            direction=payload.direction,
            quantity=payload.quantity,
            reason=payload.reason,
            quantity_before=before,
            quantity_after=after,
            confirmation_id=payload.confirmation_id,
        )
    except Exception:
        db.rollback()
        raise


@router.get("/history", response_model=list[InventoryAdjustmentResponse], summary="Get inventory adjustment history for own store")
def get_inventory_history(current_user: UserContext = Depends(require_role(["retailer"])), db: Session = Depends(get_db)):
    store = get_store_for_retailer_user(db, current_user.user_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer store not found")
    rows = db.query(InventoryAdjustment).filter(InventoryAdjustment.store_id == store.id).order_by(InventoryAdjustment.created_at.desc()).limit(100).all()
    return [InventoryAdjustmentResponse.model_validate(row, from_attributes=True) for row in rows]
