"""Google Gemini Vision provider for high-speed, highly accurate inventory extraction."""

from __future__ import annotations

import base64
import json
import logging
from typing import Optional

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.inventory import ExtractedInventoryItem, HandlingType
from app.services.inventory_parser import MAX_PRODUCT_NAME_LENGTH, _categorize, is_document_metadata
from app.services.ocr_service import OCRResult, OCRTextLine

logger = logging.getLogger(__name__)

GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
)

GEMINI_PROMPT = """You are an expert OCR and inventory parser for retail and Indian Kirana grocery stores.
Analyze this invoice, receipt, register, stock sheet, or photo of inventory.
Extract all retail products/items into structured JSON.

Return a JSON object with this exact structure:
{
  "raw_lines": ["line 1", "line 2"],
  "items": [
    {
      "product_name": "Full product name (e.g. Fortune Sunflower Oil, Maggi 2-Minute Noodles)",
      "english_product_name": "English translation when product_name is written in Hindi or another language, otherwise null",
      "brand": "Brand name if distinguishable (e.g. Fortune, Nestle, Amul)",
      "quantity": 10 (integer or null if not detected),
      "unit": "unit type (e.g. pcs, packs, packets, kg, g, l, ml, bottles, or null)",
      "size": "pack size if mentioned (e.g. 500ml, 1kg, 250g, 70g, or null)",
      "price": 28.50 (selling price per unit as float, or null if not detected),
      "total_price": 285.00 (total line amount as float, or null if not detected),
      "category": "One of: Dairy, Frozen, Beverages, Snacks & Packaged Foods, Household Cleaning, Personal Care, Groceries (or null)"
    }
  ]
}

Rules:
1. Normalize numbers. Clean up any OCR noise or artifacts.
2. If handwritten, use contextual retail knowledge to correct spelling mistakes (e.g. 'Mgii' -> 'Maggi').
3. Keep product_name concise (max 200 characters).
4. Return only saleable inventory line items. Do not return document headers or metadata such as date, invoice/bill number, GSTIN, customer/address details, subtotal, tax, discount, payment, balance, or grand total as products.
5. Keep product_name exactly as written. For Hindi or another non-English language, put the accurate English translation in english_product_name. Do not guess uncertain translations.
6. Only return valid JSON, no markdown codeblocks or explanation.
"""


class GeminiVisionService:
    """Cloud AI Vision extractor using Google Gemini Flash."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash-lite")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def extract_inventory(
        self,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        if not self.is_configured:
            raise ValueError("GEMINI_API_KEY is not configured.")

        # Determine MIME type
        mime = content_type
        if content_type == "application/pdf":
            mime = "application/pdf"
        elif not mime or mime not in {"image/jpeg", "image/png", "image/webp"}:
            lower_name = filename.lower()
            if lower_name.endswith((".jpg", ".jpeg")):
                mime = "image/jpeg"
            elif lower_name.endswith(".png"):
                mime = "image/png"
            elif lower_name.endswith(".pdf"):
                mime = "application/pdf"
            else:
                mime = "image/jpeg"

        b64_data = base64.b64encode(content).decode("utf-8")
        url = GEMINI_API_URL_TEMPLATE.format(model=self.model, api_key=self.api_key)

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": GEMINI_PROMPT},
                        {
                            "inlineData": {
                                "mimeType": mime,
                                "data": b64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

        try:
            with httpx.Client(timeout=25.0) as client:
                response = client.post(url, json=payload)
                if response.status_code == 400:
                    logger.warning("Gemini API error 400: %s", response.text)
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="The image format could not be processed by AI Vision.",
                    )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.warning("Gemini Vision request failed: %s", exc)
            raise

        return self._parse_gemini_response(data)

    def _parse_gemini_response(
        self, data: dict
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        candidates = data.get("candidates", [])
        if not candidates:
            return [], []

        part_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not part_text:
            return [], []

        try:
            clean_text = part_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            parsed = json.loads(clean_text.strip())
        except json.JSONDecodeError as exc:
            logger.warning("Failed to decode Gemini JSON response: %s (raw: %s)", exc, part_text[:200])
            return [], []

        raw_lines = parsed.get("raw_lines", [])
        ocr_lines: list[OCRTextLine] = [
            OCRTextLine(
                text=str(line).strip(),
                confidence=0.98,
                bounding_box=[],
                page_index=0,
                order=idx,
            )
            for idx, line in enumerate(raw_lines)
            if str(line).strip()
        ]

        raw_items = parsed.get("items", [])
        extracted_items: list[ExtractedInventoryItem] = []

        for item_data in raw_items:
            source_name = str(item_data.get("product_name") or "").strip()
            english_name = str(item_data.get("english_product_name") or "").strip()
            name = english_name or source_name
            if (
                not name
                or len(name) < 2
                or len(name) > MAX_PRODUCT_NAME_LENGTH
                or is_document_metadata(name)
                or is_document_metadata(source_name)
            ):
                continue

            brand = item_data.get("brand")
            brand = str(brand).strip() if brand else None

            quantity = item_data.get("quantity")
            try:
                quantity = int(quantity) if quantity is not None and int(quantity) > 0 else None
            except (ValueError, TypeError):
                quantity = None

            unit = item_data.get("unit")
            unit = str(unit).strip().lower() if unit else None

            size = item_data.get("size")
            size = str(size).strip() if size else None

            price = item_data.get("price")
            try:
                price = float(price) if price is not None and float(price) > 0 else None
            except (ValueError, TypeError):
                price = None

            total_price = item_data.get("total_price")
            try:
                total_price = float(total_price) if total_price is not None and float(total_price) > 0 else None
            except (ValueError, TypeError):
                total_price = None

            category = item_data.get("category")
            category = str(category).strip() if category else None

            # Fallback categorization if Gemini left it empty
            cat, raw_handling, requires_equipment = _categorize(name)
            if not category:
                category = cat

            handling: HandlingType = (
                "FROZEN" if raw_handling == "FROZEN"
                else "FRAGILE" if raw_handling == "FRAGILE"
                else "PERISHABLE" if raw_handling == "PERISHABLE"
                else "NORMAL"
            )

            warnings: list[str] = []
            if quantity is None:
                warnings.append("Quantity was not detected. Enter it before confirmation.")
            if unit is None:
                warnings.append("Stock unit was not detected. Enter it before confirmation.")
            if price is None:
                warnings.append("Price was not detected. Enter the selling price before confirmation.")

            extracted_items.append(
                ExtractedInventoryItem(
                    product_name=name,
                    original_product_name=source_name if source_name and source_name != name else None,
                    brand=brand[:120] if brand else None,
                    quantity=quantity,
                    unit=unit[:60] if unit else None,
                    size=size[:60] if size else None,
                    price=price,
                    total_price=total_price,
                    category=category[:120] if category else None,
                    handling_type=handling,
                    requires_special_equipment=requires_equipment or False,
                    confidence=0.98,
                    needs_review=bool(warnings),
                    warnings=warnings,
                )
            )

        return extracted_items, ocr_lines
