"""Image upload router — stores product photos locally and returns a servable URL."""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.deps import require_role, UserContext

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "products"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post(
    "/product-image",
    summary="Upload a product image (Retailer only)",
    status_code=status.HTTP_201_CREATED,
)
def upload_product_image(
    file: UploadFile = File(...),
    current_user: UserContext = Depends(require_role(["retailer", "admin"])),
):
    """Accept a JPEG/PNG/WebP image, save it to the local uploads directory,
    and return the public URL that can be stored in products.image_url."""

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WebP, GIF.",
        )

    # Read and size-check
    data = file.file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({len(data) // 1024} KB). Maximum allowed is 5 MB.",
        )

    # Derive extension from content type
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    ext = ext_map.get(file.content_type, ".jpg")

    # Save with a UUID filename to avoid collisions
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(data)

    return {
        "url": f"/uploads/products/{filename}",
        "filename": filename,
        "size_bytes": len(data),
    }
