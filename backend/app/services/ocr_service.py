"""Provider-neutral OCR contracts and the local PaddleOCR implementation."""

from __future__ import annotations

import logging
import tempfile
import threading
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Optional, Protocol

import numpy as np
from fastapi import HTTPException, status
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError
from pypdf import PdfReader

from app.core.config import settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OCRTextLine:
    text: str
    confidence: Optional[float] = None
    bounding_box: list[list[float]] = field(default_factory=list)
    page_index: int = 0
    order: int = 0


@dataclass(frozen=True)
class OCRResult:
    lines: list[OCRTextLine]
    raw_text: str = ""
    warnings: list[str] = field(default_factory=list)


class InventoryOCRService(Protocol):
    def recognize(self, content: bytes, filename: str, content_type: str) -> OCRResult:
        """Return application-owned OCR data for a validated document."""
        ...


@dataclass(frozen=True)
class PreparedImage:
    original: np.ndarray
    enhanced: np.ndarray


def _as_payload(result: Any) -> dict[str, Any]:
    if isinstance(result, dict):
        payload = result
    else:
        payload = getattr(result, "json", None)
        if callable(payload):
            payload = payload()
    if not isinstance(payload, dict):
        return {}
    nested = payload.get("res")
    return nested if isinstance(nested, dict) else payload


def _box_points(value: Any) -> list[list[float]]:
    if value is None:
        return []
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (list, tuple)):
        return []
    if len(value) == 4 and all(isinstance(point, (int, float)) for point in value):
        left, top, right, bottom = (float(point) for point in value)
        return [[left, top], [right, top], [right, bottom], [left, bottom]]
    points: list[list[float]] = []
    for point in value:
        if hasattr(point, "tolist"):
            point = point.tolist()
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            try:
                points.append([float(point[0]), float(point[1])])
            except (TypeError, ValueError):
                return []
    return points


def normalize_paddle_output(results: Any) -> OCRResult:
    """Convert PaddleOCR result objects into stable application-owned values."""

    if results is None:
        return OCRResult(lines=[])
    if isinstance(results, (dict, str, bytes)) or not hasattr(results, "__iter__"):
        pages = [results]
    else:
        pages = list(results)

    lines: list[OCRTextLine] = []
    warnings: list[str] = []
    for page_index, page in enumerate(pages):
        payload = _as_payload(page)
        if not payload:
            warnings.append(f"Page {page_index + 1} returned no usable OCR data.")
            continue
        texts = payload.get("rec_texts")
        scores = payload.get("rec_scores")
        polygons = payload.get("rec_polys")
        if polygons is None:
            polygons = payload.get("rec_boxes")
        texts = texts.tolist() if texts is not None and hasattr(texts, "tolist") else (texts or [])
        scores = scores.tolist() if scores is not None and hasattr(scores, "tolist") else (scores or [])
        polygons = polygons.tolist() if polygons is not None and hasattr(polygons, "tolist") else (polygons or [])
        for page_order, raw_text in enumerate(texts if isinstance(texts, (list, tuple)) else []):
            text = " ".join(str(raw_text).split()).strip()
            if not text:
                continue
            confidence: Optional[float] = None
            if isinstance(scores, (list, tuple)) and page_order < len(scores):
                try:
                    confidence = max(0.0, min(1.0, float(scores[page_order])))
                except (TypeError, ValueError):
                    confidence = None
            box = polygons[page_order] if isinstance(polygons, (list, tuple)) and page_order < len(polygons) else None
            lines.append(
                OCRTextLine(
                    text=text,
                    confidence=confidence,
                    bounding_box=_box_points(box),
                    page_index=page_index,
                    order=len(lines),
                )
            )
    return OCRResult(lines=lines, raw_text="\n".join(line.text for line in lines), warnings=warnings)


def _result_quality(result: OCRResult) -> float:
    return sum((line.confidence or 0.0) * max(1, len(line.text)) for line in result.lines)


class PaddleOCRProvider:
    """CPU-only PaddleOCR provider with one lazily initialized engine per process."""

    supported_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
    _engine: Any = None
    _engine_lock = threading.Lock()
    _inference_lock = threading.Lock()

    def __init__(self, engine: Any = None) -> None:
        self._injected_engine = engine

    @classmethod
    def _build_engine(cls) -> Any:
        try:
            from paddleocr import PaddleOCR
        except (ImportError, OSError) as exc:
            logger.exception("PaddleOCR could not be imported")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image analysis is unavailable. Add inventory manually or contact an administrator.",
            ) from exc
        try:
            return PaddleOCR(
                text_detection_model_name=settings.PADDLE_OCR_DETECTION_MODEL,
                text_recognition_model_name=settings.PADDLE_OCR_RECOGNITION_MODEL,
                device="cpu",
                cpu_threads=settings.PADDLE_OCR_CPU_THREADS,
                enable_mkldnn=False,
                use_doc_orientation_classify=settings.PADDLE_OCR_USE_ORIENTATION,
                use_doc_unwarping=False,
                use_textline_orientation=settings.PADDLE_OCR_USE_ORIENTATION,
            )
        except Exception as exc:
            logger.exception("PaddleOCR model initialization failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image analysis could not start. Add inventory manually or try again later.",
            ) from exc

    @classmethod
    def _shared_engine(cls) -> Any:
        if cls._engine is None:
            with cls._engine_lock:
                if cls._engine is None:
                    cls._engine = cls._build_engine()
        return cls._engine

    @staticmethod
    def _prepare_image(content: bytes) -> PreparedImage:
        try:
            with Image.open(BytesIO(content)) as source:
                source.verify()
            with Image.open(BytesIO(content)) as source:
                if source.width * source.height > settings.PADDLE_OCR_MAX_IMAGE_PIXELS:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="The image dimensions are too large. Resize it and try again.",
                    )
                image = ImageOps.exif_transpose(source).convert("RGB")
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The uploaded image is corrupt or unreadable. Try a clear JPG or PNG image.",
            ) from exc

        max_side = max(image.size)
        if max_side > settings.PADDLE_OCR_MAX_IMAGE_SIDE:
            scale = settings.PADDLE_OCR_MAX_IMAGE_SIDE / max_side
            image = image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.Resampling.LANCZOS,
            )
        grayscale = ImageOps.grayscale(image)
        enhanced = ImageEnhance.Contrast(grayscale).enhance(1.15)
        enhanced = enhanced.filter(ImageFilter.UnsharpMask(radius=1, percent=110, threshold=3)).convert("RGB")
        return PreparedImage(np.asarray(image), np.asarray(enhanced))

    @staticmethod
    def _validate_pdf(content: bytes) -> None:
        if not content.startswith(b"%PDF"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded PDF is corrupt or unreadable.")
        try:
            page_count = len(PdfReader(BytesIO(content), strict=False).pages)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded PDF is corrupt or unreadable.") from exc
        if page_count > settings.PADDLE_OCR_MAX_PDF_PAGES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Upload a PDF with no more than {settings.PADDLE_OCR_MAX_PDF_PAGES} pages.",
            )

    @classmethod
    def _validate_type(cls, filename: str, content_type: str) -> str:
        extension = Path(filename).suffix.lower()
        if extension not in cls.supported_extensions:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPG, JPEG, PNG, or PDF file.")
        if content_type == "application/pdf" and extension == ".pdf":
            return extension
        if content_type in {"image/jpeg", "image/png"} and extension != ".pdf":
            return extension
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="The file extension does not match its type.")

    def _predict(self, source: Any) -> OCRResult:
        engine = self._injected_engine or self._shared_engine()
        try:
            with self._inference_lock:
                return normalize_paddle_output(engine.predict(source))
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("PaddleOCR inference failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OCR processing failed. Try a clearer image or continue with manual inventory entry.",
            ) from exc

    def recognize(self, content: bytes, filename: str, content_type: str) -> OCRResult:
        extension = self._validate_type(filename, content_type)
        if extension == ".pdf":
            self._validate_pdf(content)
            with tempfile.NamedTemporaryFile(suffix=".pdf") as uploaded:
                uploaded.write(content)
                uploaded.flush()
                return self._predict(uploaded.name)

        prepared = self._prepare_image(content)
        original = self._predict(prepared.original)
        if not settings.PADDLE_OCR_COMPARE_PREPROCESSED:
            return original
        enhanced = self._predict(prepared.enhanced)
        if _result_quality(enhanced) > _result_quality(original):
            return OCRResult(
                lines=enhanced.lines,
                raw_text=enhanced.raw_text,
                warnings=[
                    *enhanced.warnings,
                    "Enhanced-image OCR was selected. Verify the detected rows against the original.",
                ],
            )
        return original
