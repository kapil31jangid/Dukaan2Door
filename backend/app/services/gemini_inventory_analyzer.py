"""AI-Assisted Inventory Extraction using the official Google GenAI SDK (Gemini API)."""

from __future__ import annotations

import io
import hashlib
import logging
import re
import threading
import time
from io import BytesIO
from typing import Any, Optional

from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.schemas.inventory import (
    ExtractedInventoryItem,
    GeminiInventoryAnalysisResult,
    GeminiProductCandidate,
    HandlingType,
    OCRTextLine,
)
from app.services.inventory_parser import MAX_PRODUCT_NAME_LENGTH, is_document_metadata

logger = logging.getLogger(__name__)

# Validated application categories
VALID_CATEGORIES = {
    "Groceries",
    "Snacks & Packaged Foods",
    "Beverages",
    "Dairy & Bakery",
    "Dairy",
    "Bakery",
    "Fruits & Vegetables",
    "Household Cleaning",
    "Personal Care",
    "Baby Care",
    "Pooja & Daily Essentials",
    "Frozen",
    "Other Kirana",
}

VALID_HANDLING: set[HandlingType] = {"NORMAL", "FROZEN", "FRAGILE", "PERISHABLE"}

MAX_IMAGE_SIDE = 2048
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

GEMINI_EXTRACTION_PROMPT = """You are an expert AI assistant specialized in analyzing retail documents for local Indian Kirana grocery stores.
The uploaded document may be:
- A printed kirana bill, register, or distributor invoice
- A handwritten customer order, shopkeeper list, or notebook inventory page
- A mobile-camera photo of a bill (possibly folded, low-light, or angled)
- A mixed printed and handwritten document

Your goal is to extract structured inventory product candidates with high precision.

### ANTI-HALLUCINATION RULES (CRITICAL):
1. Extract ONLY products visibly represented in the uploaded document.
2. DO NOT invent products, quantities, or prices that are not present.
3. DO NOT infer or assume missing rows because an item is common in kirana stores.
4. If a handwritten word, quantity, or price is ambiguous or unreadable:
   - Return null for that specific field (do NOT guess).
   - Set needs_review = true.
   - Explain why in review_reason (e.g., "Handwritten quantity is ambiguous", "Price is torn/cut off").
5. DO NOT silently correct ambiguous handwriting into a branded product without visual evidence.
6. For shop abbreviations (e.g. 'Amul mlk 500', 'prle g 250', 'mggi 70', 'Surf', 'Detl HW'):
   - Normalize the name to its full recognized title only when the interpretation is reasonably clear.
   - If ambiguous, keep the literal name, set needs_review = true, and explain in review_reason.
7. Return document_type as one of: 'PRINTED_INVOICE', 'HANDWRITTEN_LIST', 'MIXED_BILL', 'SHELF_IMAGE', 'UNKNOWN'.
8. Accuracy is far more important than completeness.
9. Return only saleable inventory line items. Never return document headers or metadata such as date, invoice/bill number, GSTIN, customer/address details, subtotal, tax, discount, payment, balance, or grand total as products.
10. total_price is optional. Do not warn merely because a line total is absent.
11. Put a product-specific problem only in that product's review_reason. Use top-level warnings only for issues affecting the entire document.
12. Keep product_name exactly as written in the document. If it is Hindi or another non-English language, also return an accurate normalized English translation in english_product_name. Do not transliterate when a clear translation exists (for example, चीनी -> Sugar and आटा -> Wheat Flour). If uncertain, leave english_product_name null and require review.
"""

DEVANAGARI_RE = re.compile(r"[\u0900-\u097f]")


class GeminiInventoryAnalyzer:
    """Analyzes inventory documents using Google GenAI SDK (Gemini API)."""

    _quota_lock = threading.Lock()
    _quota_blocked_until: dict[str, float] = {}
    _request_slot = threading.BoundedSemaphore(value=1)

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        client: Any = None,
    ) -> None:
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", None)
        self.model = model or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash-lite")
        self._injected_client = client

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def _quota_key(self) -> str:
        digest = hashlib.sha256((self.api_key or "").encode()).hexdigest()[:12]
        return f"{self.model}:{digest}"

    def _quota_cooldown_remaining(self) -> int:
        with self._quota_lock:
            remaining = self._quota_blocked_until.get(self._quota_key(), 0) - time.monotonic()
        return max(0, int(remaining + 0.999))

    def _record_quota_cooldown(self, error: Exception) -> int:
        match = re.search(r"retryDelay[^0-9]*(\d+)s", str(error), flags=re.IGNORECASE)
        retry_after = min(86400, max(60, int(match.group(1)) if match else 60))
        with self._quota_lock:
            self._quota_blocked_until[self._quota_key()] = time.monotonic() + retry_after
        return retry_after

    def _get_client(self) -> Any:
        if self._injected_client is not None:
            return self._injected_client
        if not self.is_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gemini API key is not configured on the server. Please set GEMINI_API_KEY or enter inventory manually.",
            )
        try:
            from google import genai
            return genai.Client(api_key=self.api_key)
        except Exception as exc:
            logger.exception("Failed to initialize Google GenAI Client: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service initialization failed. Please enter inventory manually or try again later.",
            ) from exc

    def validate_and_preprocess_image(
        self, content: bytes, filename: str, content_type: str
    ) -> tuple[bytes, str]:
        """Validate format, dimensions, readability, and apply light non-destructive preprocessing."""
        if not content or len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The uploaded file is empty. Please upload a valid bill or list.",
            )
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="The file is larger than 5 MB. Please resize or compress the image.",
            )

        mime = (content_type or "").lower().strip()
        lower_filename = (filename or "").lower()

        # Normalize MIME from filename if missing or generic
        if mime in {"", "application/octet-stream"}:
            if lower_filename.endswith((".jpg", ".jpeg")):
                mime = "image/jpeg"
            elif lower_filename.endswith(".png"):
                mime = "image/png"
            elif lower_filename.endswith(".webp"):
                mime = "image/webp"
            elif lower_filename.endswith(".pdf"):
                mime = "application/pdf"

        if mime not in SUPPORTED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Upload a JPG, JPEG, PNG, WEBP, or PDF file up to 5 MB.",
            )

        # PDF bypasses PIL image checks
        if mime == "application/pdf":
            if not content.startswith(b"%PDF"):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="The uploaded PDF is corrupt or unreadable.",
                )
            return content, "application/pdf"

        # Image validation with PIL
        try:
            with Image.open(BytesIO(content)) as img:
                img.verify()
            with Image.open(BytesIO(content)) as img:
                # Correct EXIF rotation
                processed = ImageOps.exif_transpose(img)
                if processed.mode not in ("RGB", "L"):
                    processed = processed.convert("RGB")
                else:
                    processed = processed.convert("RGB")

                # Light resize only if excessively large (preserves handwriting clarity)
                width, height = processed.size
                max_dim = max(width, height)
                if max_dim > MAX_IMAGE_SIDE:
                    scale = MAX_IMAGE_SIDE / max_dim
                    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
                    processed = processed.resize(new_size, Image.Resampling.LANCZOS)

                out_buf = BytesIO()
                processed.save(out_buf, format="JPEG", quality=92, optimize=True)
                return out_buf.getvalue(), "image/jpeg"
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            logger.warning("Unreadable image rejected: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The uploaded image is corrupt or unreadable. Try a clear JPG or PNG image.",
            ) from exc

    def analyze(
        self,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        """Call Gemini API with structured output and validate results server-side."""
        processed_bytes, mime_type = self.validate_and_preprocess_image(content, filename, content_type)
        quota_remaining = self._quota_cooldown_remaining()
        if quota_remaining:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI analysis quota is temporarily unavailable. Try again later or enter inventory manually.",
                headers={"Retry-After": str(quota_remaining)},
            )
        client = self._get_client()

        try:
            from google.genai import types
            from google.genai.errors import APIError
        except ImportError as exc:
            logger.exception("google-genai package is missing: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is unavailable. Please add inventory manually.",
            ) from exc

        part = types.Part.from_bytes(data=processed_bytes, mime_type=mime_type)
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiInventoryAnalysisResult,
            temperature=0.1,
        )

        try:
            with self._request_slot:
                quota_remaining = self._quota_cooldown_remaining()
                if quota_remaining:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="AI analysis quota is temporarily unavailable. Try again later or enter inventory manually.",
                        headers={"Retry-After": str(quota_remaining)},
                    )
                response = client.models.generate_content(
                    model=self.model,
                    contents=[GEMINI_EXTRACTION_PROMPT, part],
                    config=config,
                )
        except APIError as exc:
            code = getattr(exc, "code", 500)
            logger.warning("Gemini API request failed with status %s", code)
            if code == 429:
                retry_after = self._record_quota_cooldown(exc)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI analysis quota exceeded or rate limited. Please try again shortly or enter inventory manually.",
                    headers={"Retry-After": str(retry_after)},
                )
            if code in (401, 403):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="AI authentication failed. Please contact the administrator or enter inventory manually.",
                )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is temporarily unavailable. You can enter the products manually.",
            ) from exc
        except HTTPException:
            raise
        except (TimeoutError, Exception) as exc:
            logger.warning("Gemini request exception: %s", exc)
            if "deadline" in str(exc).lower() or "timeout" in str(exc).lower():
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="AI analysis timed out. Please enter products manually or try another image.",
                )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI analysis encountered an error. Please try another image or enter products manually.",
            ) from exc

        parsed_result = getattr(response, "parsed", None)
        if not parsed_result or not isinstance(parsed_result, GeminiInventoryAnalysisResult):
            # Fallback parsing in case response.parsed was not populated by mock/client
            text = getattr(response, "text", "")
            if text:
                try:
                    import json
                    raw_dict = json.loads(text.strip("` \n").replace("json\n", "", 1))
                    parsed_result = GeminiInventoryAnalysisResult.model_validate(raw_dict)
                except Exception as parse_err:
                    logger.warning("Failed to parse Gemini JSON text fallback: %s", parse_err)

        if not parsed_result or not parsed_result.products:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="We couldn't reliably extract products from this image. You can try another photo or enter the products manually.",
            )

        return self._transform_and_validate(parsed_result)

    def _transform_and_validate(
        self, result: GeminiInventoryAnalysisResult
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        items: list[ExtractedInventoryItem] = []
        ocr_lines: list[OCRTextLine] = []

        for idx, candidate in enumerate(result.products):
            source_name = (candidate.product_name or "").strip()
            english_name = (candidate.english_product_name or "").strip()
            raw_name = english_name or source_name
            if (
                not raw_name
                or len(raw_name) < 2
                or len(raw_name) > MAX_PRODUCT_NAME_LENGTH
                or is_document_metadata(raw_name)
                or is_document_metadata(source_name)
            ):
                continue

            name = raw_name
            original_name = source_name if source_name and source_name != name else None
            brand = candidate.brand.strip()[:120] if candidate.brand else None
            size = candidate.size.strip()[:60] if candidate.size else None
            unit = candidate.unit.strip().lower()[:60] if candidate.unit else None

            # Quantity validation
            quantity = candidate.quantity
            if quantity is not None:
                if quantity <= 0 or quantity > 100000:
                    quantity = None

            # Price validation
            price = candidate.unit_price
            if price is not None:
                if price <= 0:
                    price = None

            total_price = candidate.total_price
            if total_price is not None and total_price <= 0:
                total_price = None

            # Category validation
            raw_category = (candidate.category or "").strip()
            category = raw_category if raw_category in VALID_CATEGORIES else None
            if not category and raw_category:
                # Fuzzy match to allowed category
                for valid_cat in VALID_CATEGORIES:
                    if valid_cat.lower() in raw_category.lower():
                        category = valid_cat
                        break

            # Handling requirement validation
            raw_handling = (candidate.handling_requirement or "").strip().upper()
            handling_type: HandlingType = raw_handling if raw_handling in VALID_HANDLING else "NORMAL"
            if category == "Frozen" or (name and "ice cream" in name.lower()):
                handling_type = "FROZEN"
            elif category in ("Dairy", "Dairy & Bakery") and handling_type == "NORMAL":
                handling_type = "PERISHABLE"

            # Determine review flags and reasons
            needs_review = candidate.needs_review
            review_reasons: list[str] = []
            if candidate.review_reason:
                review_reasons.append(candidate.review_reason.strip())

            if DEVANAGARI_RE.search(source_name) and not english_name:
                needs_review = True
                review_reasons.append("English product name could not be translated reliably. Please enter it before confirmation.")

            if quantity is None:
                needs_review = True
                review_reasons.append("Quantity was not detected or is ambiguous. Please enter it.")
            if price is None:
                needs_review = True
                review_reasons.append("Price was not detected or is ambiguous. Please enter the selling price.")
            if not category:
                needs_review = True
                review_reasons.append("Category could not be identified. Please choose one.")

            primary_reason = review_reasons[0] if review_reasons else None
            item = ExtractedInventoryItem(
                product_name=name,
                original_product_name=original_name,
                brand=brand,
                quantity=quantity,
                unit=unit or "unit",
                size=size,
                price=price,
                total_price=total_price,
                category=category,
                handling_type=handling_type,
                requires_special_equipment=handling_type == "FROZEN",
                confidence=None,  # No fake confidence scores
                needs_review=needs_review,
                review_reason=primary_reason,
                warnings=review_reasons,
            )
            items.append(item)

            # Synthesize OCR line representation for preview
            ocr_lines.append(
                OCRTextLine(
                    text=f"{source_name or name} {size or ''} {quantity or ''} {unit or ''} ₹{price or ''}".strip(),
                    confidence=None,
                    bounding_box=[],
                    page_index=0,
                    order=idx,
                )
            )

        if not items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="We couldn't reliably extract products from this image. You can try another photo or enter the products manually.",
            )

        return items, ocr_lines
