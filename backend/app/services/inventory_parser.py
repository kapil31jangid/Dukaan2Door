"""Conservative inventory extraction from provider-neutral OCR lines."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.core.config import settings
from app.schemas.inventory import ExtractedInventoryItem, HandlingType
from app.services.ocr_service import OCRTextLine


CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Dairy", ("milk", "amul", "curd", "paneer", "butter", "cheese", "yogurt", "ghee", "chaas", "dahi", "cream")),
    ("Frozen", ("ice cream", "frozen", "frozen peas", "safal", "nuggets")),
    ("Beverages", ("juice", "cola", "drink", "water", "soda", "coke", "pepsi", "sprite", "frooti", "maaza", "tea", "chai", "coffee", "bournvita", "horlicks")),
    ("Snacks & Packaged Foods", ("biscuit", "chips", "bhujia", "namkeen", "parle", "snack", "maggi", "noodles", "kurkure", "lays", "oreo", "good day", "cookie", "rusk", "pasta")),
    ("Household Cleaning", ("detergent", "cleaner", "phenyl", "dish wash", "surf", "aerial", "tide", "harpic", "vim", "rin", "colin", "pril")),
    ("Personal Care", ("shampoo", "toothpaste", "sanitary", "soap", "dove", "dettol", "lifebuoy", "colgate", "pepsodent", "brush")),
    ("Groceries", ("rice", "flour", "atta", "dal", "salt", "sugar", "oil", "besan", "suji", "maida", "mustard", "fortune", "tata", "masala", "haldi", "mirch", "jeera", "dhaniya", "poha", "soya")),
)
SIZE_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s?(kg|g|gm|ml|l|litre|liter|pcs?)\b", re.I)
EXPLICIT_QUANTITY_RE = re.compile(r"(?:\bx\s*|\bqty\s*[:=-]?\s*|\bquantity\s*[:=-]?\s*)(\d+)\b", re.I)
TRAILING_QUANTITY_RE = re.compile(r"(?:^|\s)(\d{1,4})(?:\s*(?:pcs?|packs?|packets?|boxes?|bottles?|units?))?\s*$", re.I)
UNIT_QUANTITY_RE = re.compile(r"\b(\d{1,4})\s*(pcs?|packs?|packets?|boxes?|bottles?|units?)\b", re.I)
QUANTITY_UNIT_PRICE_RE = re.compile(
    r"(?:^|\s)(\d{1,4})\s*(pcs?|packs?|packets?|boxes?|bottles?|units?)\s+(\d+(?:\.\d{1,2})?)\s*$",
    re.I,
)
QUANTITY_PRICE_RE = re.compile(r"(?:^|\s)(\d{1,4})\s+(\d+(?:\.\d{1,2})?)\s*$")
QUANTITY_CURRENCY_PRICE_RE = re.compile(
    r"(?:^|\s)(\d{1,4})\s+(?:₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)\s*$",
    re.I,
)
PRICE_RE = re.compile(r"(?:₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)", re.I)
RATE_PRICE_RE = re.compile(r"(?:@|rate|mrp)\s*[:=-]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)", re.I)
TRAILING_DECIMAL_PRICE_RE = re.compile(r"(?:^|\s)(\d+\.\d{1,2})\s*$")
EXPIRY_RE = re.compile(r"\b(?:exp(?:iry)?\.?\s*[:=-]?\s*)(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", re.I)
HEADER_RE = re.compile(r"^(?:product|item|description|particulars?|qty|quantity|rate|price|amount|total)(?:\s+.*)?$", re.I)
MAX_PRODUCT_NAME_LENGTH = 255

# Document labels can look like products after their adjacent numbers are parsed as
# quantities or prices. Keep this validation provider-neutral so every analyzer
# applies the same safety rule before presenting inventory candidates.
DOCUMENT_METADATA_RE = re.compile(
    r"^(?:"
    r"date|time|invoice(?:\s*(?:no|number|date))?|bill(?:\s*(?:no|number|date))?|"
    r"receipt(?:\s*(?:no|number|date))?|order(?:\s*(?:no|number|date))?|"
    r"challan(?:\s*(?:no|number|date))?|gstin|gst(?:\s*(?:no|number))?|"
    r"customer|buyer|seller|vendor|supplier|address|phone|mobile|email|"
    r"subtotal|sub\s+total|grand\s+total|net\s+total|total|tax|cgst|sgst|igst|vat|"
    r"discount|round\s*off|payment|payment\s+mode|cash|balance|amount\s+due|"
    r"page|serial\s*(?:no|number)|s\s*no|terms(?:\s+and\s+conditions)?"
    r")(?:\s*[:#-].*)?$",
    re.I,
)


@dataclass(frozen=True)
class OCRRow:
    text: str
    confidence: Optional[float]


def is_document_metadata(value: str) -> bool:
    """Return True when an extracted candidate is a document label, not stock."""
    normalized = " ".join(value.replace("_", " ").split()).strip(" -:|#")
    normalized = re.sub(r"\s+(?:rs\.?|inr|₹)$", "", normalized, flags=re.I).strip()
    return bool(normalized and DOCUMENT_METADATA_RE.fullmatch(normalized))


def _categorize(value: str) -> tuple[Optional[str], Optional[HandlingType], bool]:
    lowered = value.lower()
    for category, keywords in CATEGORY_RULES:
        if any(keyword in lowered for keyword in keywords):
            handling: HandlingType = "FROZEN" if category == "Frozen" else "PERISHABLE" if category == "Dairy" else "NORMAL"
            return category, handling, category == "Frozen"
    return None, None, False


def _vertical_bounds(line: OCRTextLine) -> tuple[float, float]:
    if not line.bounding_box:
        value = float(line.order * 20)
        return value, value + 10
    ys = [point[1] for point in line.bounding_box]
    return min(ys), max(ys)


def _left(line: OCRTextLine) -> float:
    return min((point[0] for point in line.bounding_box), default=float(line.order))


def group_ocr_rows(lines: list[OCRTextLine]) -> list[OCRRow]:
    grouped: list[list[OCRTextLine]] = []
    for page in sorted({line.page_index for line in lines}):
        page_lines = sorted(
            (line for line in lines if line.page_index == page),
            key=lambda line: ((_vertical_bounds(line)[0] + _vertical_bounds(line)[1]) / 2, _left(line)),
        )
        for line in page_lines:
            top, bottom = _vertical_bounds(line)
            center = (top + bottom) / 2
            height = max(8.0, bottom - top)
            if grouped:
                previous = grouped[-1]
                previous_top = min(_vertical_bounds(value)[0] for value in previous)
                previous_bottom = max(_vertical_bounds(value)[1] for value in previous)
                previous_center = (previous_top + previous_bottom) / 2
                if previous[0].page_index == page and abs(center - previous_center) <= max(height, previous_bottom - previous_top) * 0.6:
                    previous.append(line)
                    continue
            grouped.append([line])

    rows: list[OCRRow] = []
    for group in grouped:
        ordered = sorted(group, key=_left)
        text = " ".join(value.text for value in ordered).strip()
        if text:
            known_confidences = [value.confidence for value in ordered if value.confidence is not None]
            rows.append(OCRRow(text=text, confidence=min(known_confidences) if known_confidences else None))
    return rows


def parse_inventory_lines(lines: list[OCRTextLine]) -> list[ExtractedInventoryItem]:
    items: list[ExtractedInventoryItem] = []
    for row in group_ocr_rows(lines):
        line = " ".join(row.text.replace("|", " ").split())
        if len(line) < 3 or HEADER_RE.fullmatch(line):
            continue

        size_match = SIZE_RE.search(line)
        explicit_quantity = EXPLICIT_QUANTITY_RE.search(line)
        quantity_unit_price = QUANTITY_UNIT_PRICE_RE.search(line)
        quantity_price = QUANTITY_PRICE_RE.search(line)
        quantity_currency_price = QUANTITY_CURRENCY_PRICE_RE.search(line)
        unit_quantity = UNIT_QUANTITY_RE.search(line)
        trailing_quantity = TRAILING_QUANTITY_RE.search(line)
        quantity_match = (
            explicit_quantity
            or quantity_unit_price
            or quantity_currency_price
            or quantity_price
            or unit_quantity
            or trailing_quantity
        )
        quantity = int(quantity_match.group(1)) if quantity_match else None
        if quantity is not None and quantity < 1:
            quantity = None
        unit = (
            quantity_unit_price.group(2).lower()
            if quantity_unit_price
            else unit_quantity.group(2).lower()
            if unit_quantity
            else None
        )
        price_matches = list(PRICE_RE.finditer(line))
        rate_match = RATE_PRICE_RE.search(line)
        trailing_decimal = (
            TRAILING_DECIMAL_PRICE_RE.search(line)
            if not price_matches and not rate_match and not quantity_price and not quantity_currency_price and not quantity_unit_price
            else None
        )
        if not (size_match or quantity_match or price_matches or rate_match or trailing_decimal):
            continue
        unit_price = (
            float(price_matches[0].group(1))
            if price_matches
            else float(rate_match.group(1))
            if rate_match
            else float(trailing_decimal.group(1))
            if trailing_decimal
            else float(quantity_unit_price.group(3))
            if quantity_unit_price
            else float(quantity_currency_price.group(2))
            if quantity_currency_price
            else float(quantity_price.group(2))
            if quantity_price
            else None
        )
        total_price = float(price_matches[1].group(1)) if len(price_matches) > 1 else None
        if unit_price is not None and unit_price <= 0:
            unit_price = None
        if total_price is not None and total_price <= 0:
            total_price = None

        expiry_match = EXPIRY_RE.search(line)
        expiry_date = None
        if expiry_match:
            for format_ in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
                try:
                    expiry_date = datetime.strptime(expiry_match.group(1), format_).date()
                    break
                except ValueError:
                    continue

        name = EXPLICIT_QUANTITY_RE.sub("", line)
        if quantity_unit_price:
            name = name[: quantity_unit_price.start()].rstrip()
        elif quantity_currency_price and not explicit_quantity:
            name = name[: quantity_currency_price.start()].rstrip()
        elif quantity_price and not explicit_quantity:
            name = name[: quantity_price.start()].rstrip()
        name = UNIT_QUANTITY_RE.sub("", name)
        if trailing_quantity and not explicit_quantity and not quantity_unit_price and not quantity_price:
            name = name[: trailing_quantity.start(1)].rstrip()
        if trailing_decimal:
            name = name[: trailing_decimal.start(1)].rstrip()
        name = PRICE_RE.sub("", name).strip(" -:|")
        name = RATE_PRICE_RE.sub("", name).strip(" -:|")
        name = EXPIRY_RE.sub("", name)
        name = SIZE_RE.sub("", name)
        name = " ".join(name.split()).strip(" -:|")
        name = re.sub(r"\s+[Il|]\s*$", "", name).strip()
        if (
            len(name) < 2
            or len(name) > MAX_PRODUCT_NAME_LENGTH
            or not re.search(r"[A-Za-z]", name)
            or is_document_metadata(name)
        ):
            continue

        category, handling_type, equipment = _categorize(name)
        warnings: list[str] = []
        if row.confidence is None:
            warnings.append("OCR confidence is unavailable. Please verify this row against the original image.")
        elif row.confidence < getattr(settings, "PADDLE_OCR_LOW_CONFIDENCE", 0.70):
            warnings.append("OCR confidence is low. Please verify this row against the original image.")
        if quantity is None:
            warnings.append("Quantity was not detected. Enter it before confirmation.")
        if unit is None:
            warnings.append("Stock unit was not detected. Enter it before confirmation.")
        if not category:
            warnings.append("Category could not be confidently detected. Please choose one.")
        if unit_price is None:
            warnings.append("Price was not detected. Enter the selling price before confirmation.")

        items.append(
            ExtractedInventoryItem(
                product_name=name,
                quantity=quantity,
                unit=unit,
                size=size_match.group(0) if size_match else None,
                price=unit_price,
                total_price=total_price,
                category=category,
                expiry_date=expiry_date,
                handling_type=handling_type,
                requires_special_equipment=equipment if category else None,
                confidence=row.confidence,
                needs_review=True,
                warnings=warnings,
            )
        )
    return items
