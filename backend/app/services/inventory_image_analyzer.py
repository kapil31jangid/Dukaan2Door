"""Inventory image analysis orchestration."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.inventory import ExtractedInventoryItem, OCRTextLine
from app.services.gemini_inventory_analyzer import GeminiInventoryAnalyzer
from app.services.inventory_parser import parse_inventory_lines
from app.services.ocr_service import PaddleOCRProvider

logger = logging.getLogger(__name__)


class InventoryImageAnalyzer:
    """High-level abstraction for AI-assisted inventory extraction."""

    def __init__(
        self,
        analyzer: Any = None,
        gemini_analyzer: Any = None,
        ocr_service: Any = None,
    ) -> None:
        ocr = ocr_service
        if ocr is None and analyzer is not None and hasattr(analyzer, "recognize"):
            ocr = analyzer

        if isinstance(analyzer, GeminiInventoryAnalyzer):
            self.gemini_analyzer = analyzer
            self.ocr_service = ocr or PaddleOCRProvider()
            self._use_gemini = True
        elif analyzer is not None and hasattr(analyzer, "analyze"):
            self.gemini_analyzer = analyzer
            self.ocr_service = ocr or PaddleOCRProvider()
            self._use_gemini = True
        elif ocr is not None:
            self.ocr_service = ocr
            self.gemini_analyzer = gemini_analyzer or GeminiInventoryAnalyzer()
            self._use_gemini = gemini_analyzer is not None
        else:
            self.ocr_service = PaddleOCRProvider()
            self.gemini_analyzer = gemini_analyzer or GeminiInventoryAnalyzer()
            self._use_gemini = gemini_analyzer is not None or bool(settings.GEMINI_API_KEY)
        self.provider_name = "Gemini AI" if self._use_gemini else "PaddleOCR"

    def _analyze_with_ocr(
        self,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        result = self.ocr_service.recognize(content, filename, content_type)
        if not result.lines:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No readable text was found. Try a clearer image or add inventory manually.",
            )
        items = parse_inventory_lines(result.lines)
        if not items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Text was detected, but no inventory rows could be identified. Add products manually.",
            )
        if getattr(result, "warnings", None):
            for item in items:
                item.warnings.extend(w for w in result.warnings if w not in item.warnings)
        return items, result.lines

    def analyze_image(
        self,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        if not self._use_gemini:
            return self._analyze_with_ocr(content, filename, content_type)

        try:
            return self.gemini_analyzer.analyze(content, filename, content_type)
        except HTTPException as exc:
            if exc.status_code not in {
                status.HTTP_429_TOO_MANY_REQUESTS,
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                status.HTTP_502_BAD_GATEWAY,
                status.HTTP_503_SERVICE_UNAVAILABLE,
                status.HTTP_504_GATEWAY_TIMEOUT,
            }:
                raise
            logger.warning("Gemini inventory analysis failed; using local PaddleOCR fallback")
            self.provider_name = "PaddleOCR (fallback)"
            return self._analyze_with_ocr(content, filename, content_type)

    def analyze_product_photo(
        self,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> tuple[list[ExtractedInventoryItem], list[OCRTextLine]]:
        if not self._use_gemini:
            items, lines = self._analyze_with_ocr(content, filename, content_type)
        else:
            try:
                method = getattr(self.gemini_analyzer, "analyze_product_photo", None)
                if method is None:
                    method = self.gemini_analyzer.analyze
                items, lines = method(content, filename, content_type)
            except HTTPException as exc:
                if exc.status_code not in {
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    status.HTTP_502_BAD_GATEWAY,
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    status.HTTP_504_GATEWAY_TIMEOUT,
                }:
                    raise
                logger.warning("Gemini product-photo analysis failed; using local PaddleOCR fallback")
                self.provider_name = "PaddleOCR (fallback)"
                items, lines = self._analyze_with_ocr(content, filename, content_type)

        for item in items:
            item.needs_review = True
            if item.price is not None and item.printed_mrp is None:
                item.printed_mrp = item.price
            item.price = None
            if item.quantity == 1:
                item.quantity = None
            message = "Product-photo results are review-only. Select a catalogue match and enter the stock adjustment quantity."
            if message not in item.warnings:
                item.warnings.append(message)
            if not item.review_reason:
                item.review_reason = message
        return items, lines
