from io import BytesIO

import numpy as np
import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.config import settings
from app.services.inventory_image_analyzer import InventoryImageAnalyzer
from app.services.inventory_parser import group_ocr_rows, parse_inventory_lines
from app.services.ocr_service import OCRResult, OCRTextLine, PaddleOCRProvider, normalize_paddle_output


def line(text: str, confidence: float | None = None, y: float = 0, x: float = 0, order: int = 0) -> OCRTextLine:
    return OCRTextLine(
        text=text,
        confidence=confidence,
        bounding_box=[[x, y], [x + 80, y], [x + 80, y + 10], [x, y + 10]],
        page_index=0,
        order=order,
    )


def png_bytes(size: tuple[int, int] = (100, 50)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, "white").save(buffer, format="PNG")
    return buffer.getvalue()


def paddle_payload(texts=None, scores=None, polygons=None) -> dict:
    return {
        "res": {
            "rec_texts": ["Milk 500ml qty 2 Rs 30"] if texts is None else texts,
            "rec_scores": [0.94] if scores is None else scores,
            "rec_polys": [[[10, 10], [190, 10], [190, 30], [10, 30]]] if polygons is None else polygons,
        }
    }


class StubEngine:
    def __init__(self, results=None, error: Exception | None = None):
        self.results = results if results is not None else [paddle_payload()]
        self.error = error
        self.sources = []

    def predict(self, source):
        self.sources.append(source)
        if self.error:
            raise self.error
        return self.results


def test_paddle_output_preserves_real_confidence_and_polygons():
    result = normalize_paddle_output([
        paddle_payload(
            [" Amul   Milk 500ml 10 ", "Parle-G 250g 15"],
            np.array([0.96, 0.72]),
            np.array([
                [[10, 10], [200, 10], [200, 30], [10, 30]],
                [[10, 40], [200, 40], [200, 60], [10, 60]],
            ]),
        )
    ])
    assert [value.text for value in result.lines] == ["Amul Milk 500ml 10", "Parle-G 250g 15"]
    assert [value.confidence for value in result.lines] == [0.96, 0.72]
    assert result.lines[0].bounding_box == [[10.0, 10.0], [200.0, 10.0], [200.0, 30.0], [10.0, 30.0]]
    assert result.raw_text


def test_malformed_paddle_result_is_empty_and_safe():
    result = normalize_paddle_output([object()])
    assert result.lines == []
    assert "no usable OCR data" in result.warnings[0]


def test_rectangular_rec_boxes_are_normalized_to_polygons():
    result = normalize_paddle_output([
        {"res": {"rec_texts": ["Milk"], "rec_scores": [0.9], "rec_boxes": [[1, 2, 11, 12]]}}
    ])
    assert result.lines[0].bounding_box == [[1.0, 2.0], [11.0, 2.0], [11.0, 12.0], [1.0, 12.0]]


def test_bill_cells_are_ordered_and_grouped_by_visual_row():
    rows = group_ocr_rows([
        line("10", x=220, y=10, order=1),
        line("Amul Milk 500ml", x=10, y=10, order=0),
        line("Parle-G 250g", x=10, y=40, order=2),
        line("15", x=220, y=40, order=3),
    ])
    assert [row.text for row in rows] == ["Amul Milk 500ml 10", "Parle-G 250g 15"]


def test_printed_bill_rows_become_reviewable_drafts_with_confidence():
    items = parse_inventory_lines([
        line("Amul Milk 500ml 10 packs Rs 28", confidence=0.94, y=10),
        line("Parle-G 250g 15 packets Rs 30", confidence=0.92, y=40, order=1),
    ])
    assert [(item.product_name, item.size, item.quantity, item.price) for item in items] == [
        ("Amul Milk", "500ml", 10, 28.0),
        ("Parle-G", "250g", 15, 30.0),
    ]
    assert [item.confidence for item in items] == [0.94, 0.92]
    assert all(item.needs_review for item in items)


def test_low_confidence_handwritten_row_is_flagged_without_inventing_fields():
    [item] = parse_inventory_lines([line("Mgii 70g 12", confidence=0.41)])
    assert item.product_name == "Mgii"
    assert item.quantity == 12
    assert item.price is None
    assert item.category is None
    assert item.needs_review is True
    assert any("confidence is low" in warning for warning in item.warnings)


def test_markdown_table_and_bare_price_columns_are_parsed_conservatively():
    [item] = parse_inventory_lines([line("| Amul Milk 500ml | 10 packs | 28 |", confidence=0.9)])
    assert item.product_name == "Amul Milk"
    assert item.size == "500ml"
    assert item.quantity == 10
    assert item.unit == "packs"
    assert item.price == 28


def test_currency_price_column_does_not_replace_stock_quantity():
    [item] = parse_inventory_lines([line("Amul Milk 500ml I 10 Rs 28", confidence=0.86)])
    assert item.product_name == "Amul Milk"
    assert item.quantity == 10
    assert item.price == 28


def test_overlong_ocr_candidate_is_ignored_instead_of_crashing_analysis():
    noisy_name = "Unrelated document text " * 15

    assert parse_inventory_lines([line(f"{noisy_name} 10", confidence=0.81)]) == []


@pytest.mark.parametrize(
    "metadata_row",
    [
        "Date 120",
        "Invoice No 120",
        "Bill Date 12",
        "GSTIN 24",
        "Grand Total Rs 120",
        "CGST Rs 18",
        "Customer 10",
    ],
)
def test_document_metadata_is_not_returned_as_inventory(metadata_row):
    assert parse_inventory_lines([line(metadata_row, confidence=0.98)]) == []


def test_product_named_dates_is_not_mistaken_for_date_metadata():
    [item] = parse_inventory_lines([line("Dates 500g 4 packs Rs 80", confidence=0.95)])

    assert item.product_name == "Dates"
    assert item.quantity == 4
    assert item.price == 80


def test_non_positive_ocr_values_are_left_for_manual_review():
    [item] = parse_inventory_lines([line("Amul Milk 500ml qty 0 Rs 0", confidence=0.91)])

    assert item.product_name == "Amul Milk"
    assert item.quantity is None
    assert item.price is None
    assert any("Quantity was not detected" in warning for warning in item.warnings)
    assert any("Price was not detected" in warning for warning in item.warnings)


def test_noisy_overlong_ocr_result_returns_manual_fallback():
    class NoisyOCR:
        def recognize(self, content, filename, content_type):
            return OCRResult(lines=[line(f"{'Unrelated document text ' * 15} 10", confidence=0.81)])

    with pytest.raises(HTTPException) as exc:
        InventoryImageAnalyzer(NoisyOCR()).analyze_image(b"image", "document.png", "image/png")

    assert exc.value.status_code == 422
    assert "manually" in exc.value.detail.lower()


def test_empty_ocr_output_is_rejected():
    class EmptyOCR:
        def recognize(self, content, filename, content_type):
            return OCRResult(lines=[])

    with pytest.raises(HTTPException) as exc:
        InventoryImageAnalyzer(EmptyOCR()).analyze_image(b"image", "bill.png", "image/png")
    assert exc.value.status_code == 422


def test_corrupt_image_is_rejected_before_inference():
    engine = StubEngine()
    with pytest.raises(HTTPException) as exc:
        PaddleOCRProvider(engine).recognize(b"not an image", "bill.png", "image/png")
    assert exc.value.status_code == 422
    assert engine.sources == []


def test_oversized_image_dimensions_are_rejected_before_inference(monkeypatch):
    monkeypatch.setattr(settings, "PADDLE_OCR_MAX_IMAGE_PIXELS", 100)
    engine = StubEngine()
    with pytest.raises(HTTPException) as exc:
        PaddleOCRProvider(engine).recognize(png_bytes((20, 20)), "bill.png", "image/png")
    assert exc.value.status_code == 413
    assert engine.sources == []


def test_paddle_provider_uses_cpu_result_and_compares_preprocessing(monkeypatch):
    monkeypatch.setattr(settings, "PADDLE_OCR_COMPARE_PREPROCESSED", True)
    engine = StubEngine([paddle_payload()])
    result = PaddleOCRProvider(engine).recognize(png_bytes(), "bill.png", "image/png")
    assert result.lines[0].text == "Milk 500ml qty 2 Rs 30"
    assert len(engine.sources) == 2
    assert all(isinstance(source, np.ndarray) for source in engine.sources)


def test_enhanced_result_is_selected_only_when_quality_is_better(monkeypatch):
    monkeypatch.setattr(settings, "PADDLE_OCR_COMPARE_PREPROCESSED", True)

    class ChangingEngine:
        def __init__(self):
            self.calls = 0

        def predict(self, source):
            self.calls += 1
            score = 0.30 if self.calls == 1 else 0.95
            return [paddle_payload(scores=[score])]

    result = PaddleOCRProvider(ChangingEngine()).recognize(png_bytes(), "bill.png", "image/png")
    assert result.lines[0].confidence == 0.95
    assert any("Enhanced-image OCR" in warning for warning in result.warnings)


def test_paddle_exception_has_manual_fallback_message(monkeypatch):
    monkeypatch.setattr(settings, "PADDLE_OCR_COMPARE_PREPROCESSED", False)
    with pytest.raises(HTTPException) as exc:
        PaddleOCRProvider(StubEngine(error=RuntimeError("internal model error"))).recognize(
            png_bytes(), "bill.png", "image/png"
        )
    assert exc.value.status_code == 503
    assert "manual" in exc.value.detail.lower()
    assert "internal model error" not in exc.value.detail


def test_shared_paddle_engine_is_initialized_once(monkeypatch):
    sentinel = StubEngine()
    calls = 0

    def build(cls):
        nonlocal calls
        calls += 1
        return sentinel

    monkeypatch.setattr(PaddleOCRProvider, "_engine", None)
    monkeypatch.setattr(PaddleOCRProvider, "_build_engine", classmethod(build))
    assert PaddleOCRProvider._shared_engine() is sentinel
    assert PaddleOCRProvider._shared_engine() is sentinel
    assert calls == 1


def test_unsupported_and_oversized_uploads_are_rejected_before_ocr(client, retailer_headers, monkeypatch):
    called = False

    def should_not_run(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr("app.api.v1.endpoints.inventory.InventoryImageAnalyzer.analyze_image", should_not_run)
    unsupported = client.post(
        "/api/retailer/inventory/analyze",
        files={"file": ("bill.txt", b"milk 2", "text/plain")},
        headers=retailer_headers,
    )
    oversized = client.post(
        "/api/retailer/inventory/analyze",
        files={"file": ("bill.png", b"x" * (5 * 1024 * 1024 + 1), "image/png")},
        headers=retailer_headers,
    )
    assert unsupported.status_code == 415
    assert oversized.status_code == 413
    assert not called


def test_inventory_analysis_rejects_unauthenticated_and_non_retailer(client, customer_headers):
    files = {"file": ("bill.png", png_bytes(), "image/png")}
    assert client.post("/api/retailer/inventory/analyze", files=files).status_code == 401
    assert client.post("/api/retailer/inventory/analyze", files=files, headers=customer_headers).status_code == 403


def test_rate_price_and_trailing_decimal_parsed():
    items = parse_inventory_lines([
        line("Tata Salt 1kg @ 28.00", confidence=0.95),
        line("Fortune Sunflower Oil 1L 165.50", confidence=0.92, y=30),
    ])
    assert len(items) == 2
    assert items[0].product_name == "Tata Salt"
    assert items[0].price == 28.0
    assert items[0].category == "Groceries"
    assert items[1].product_name == "Fortune Sunflower Oil"
    assert items[1].price == 165.50
    assert items[1].category == "Groceries"


def test_gemini_vision_service_parses_json_output(monkeypatch):
    from app.services.gemini_vision_service import GeminiVisionService

    dummy_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"raw_lines": ["Amul Milk 500ml 28"], "items": [{"product_name": "Amul Milk", "brand": "Amul", "quantity": 1, "unit": "packet", "size": "500ml", "price": 28.0, "category": "Dairy"}]}'
                        }
                    ]
                }
            }
        ]
    }

    class MockHTTPXResponse:
        status_code = 200
        def json(self):
            return dummy_response
        def raise_for_status(self):
            pass

    class MockHTTPXClient:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            return MockHTTPXResponse()

    monkeypatch.setattr("httpx.Client", MockHTTPXClient)
    service = GeminiVisionService(api_key="test-key")
    items, ocr_lines = service.extract_inventory(png_bytes(), "bill.png", "image/png")
    assert len(items) == 1
    assert items[0].product_name == "Amul Milk"
    assert items[0].brand == "Amul"
    assert items[0].price == 28.0
    assert items[0].category == "Dairy"
    assert len(ocr_lines) == 1
    assert ocr_lines[0].text == "Amul Milk 500ml 28"


def test_analyzer_falls_back_to_paddle_when_gemini_fails(monkeypatch):
    class FailingGemini:
        def analyze(self, *args, **kwargs):
            raise HTTPException(status_code=503, detail="AI service unavailable")

    class StubOCR:
        def recognize(self, content, filename, content_type):
            return OCRResult(lines=[line("Amul Milk 500ml 10 packs Rs 28", confidence=0.9)])

    analyzer = InventoryImageAnalyzer(gemini_analyzer=FailingGemini(), ocr_service=StubOCR())
    items, ocr_lines = analyzer.analyze_image(png_bytes(), "bill.png", "image/png")
    assert len(items) == 1
    assert items[0].product_name == "Amul Milk"
    assert analyzer.provider_name == "PaddleOCR (fallback)"


def test_analyzer_uses_local_paddle_when_gemini_is_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)

    analyzer = InventoryImageAnalyzer()

    assert analyzer.provider_name == "PaddleOCR"
    assert isinstance(analyzer.ocr_service, PaddleOCRProvider)
