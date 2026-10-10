from io import BytesIO
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.config import settings
from app.models.inventory import Inventory
from app.models.product import Product
from app.schemas.inventory import (
    GeminiInventoryAnalysisResult,
    GeminiProductCandidate,
    InventoryConfirmItem,
    InventoryConfirmRequest,
)
from app.services.gemini_inventory_analyzer import GeminiInventoryAnalyzer
from app.services.inventory_image_analyzer import InventoryImageAnalyzer


def make_png(size: tuple[int, int] = (100, 50)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, "white").save(buf, format="PNG")
    return buf.getvalue()


def make_webp(size: tuple[int, int] = (100, 50)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, "white").save(buf, format="WEBP")
    return buf.getvalue()


class MockGenAIResponse:
    def __init__(self, parsed=None, text=""):
        self.parsed = parsed
        self.text = text


class MockGenAIClient:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

        class Models:
            def __init__(self, outer):
                self.outer = outer

            def generate_content(self, model, contents, config=None):
                self.outer.calls.append({"model": model, "contents": contents, "config": config})
                if self.outer.error:
                    raise self.outer.error
                return self.outer.response

        self.models = Models(self)


# 1. Valid image accepted (PNG and WEBP)
def test_valid_image_accepted_and_preprocessed():
    analyzer = GeminiInventoryAnalyzer(api_key="test-key")
    img_bytes, mime = analyzer.validate_and_preprocess_image(make_png(), "bill.png", "image/png")
    assert mime == "image/jpeg"
    assert len(img_bytes) > 0

    webp_bytes, mime_webp = analyzer.validate_and_preprocess_image(make_webp(), "bill.webp", "image/webp")
    assert mime_webp == "image/jpeg"
    assert len(webp_bytes) > 0


# 2. Invalid image format rejected (415)
def test_invalid_image_format_rejected():
    analyzer = GeminiInventoryAnalyzer(api_key="test-key")
    with pytest.raises(HTTPException) as exc:
        analyzer.validate_and_preprocess_image(b"plain text", "bill.txt", "text/plain")
    assert exc.value.status_code == 415


# 3. Corrupt image rejected (422)
def test_corrupt_image_rejected():
    analyzer = GeminiInventoryAnalyzer(api_key="test-key")
    with pytest.raises(HTTPException) as exc:
        analyzer.validate_and_preprocess_image(b"not an image binary header", "bill.png", "image/png")
    assert exc.value.status_code == 422


# 4 & 5. Gemini result parsed and structured schema validated
def test_gemini_result_parsed_and_structured():
    mock_result = GeminiInventoryAnalysisResult(
        document_type="PRINTED_INVOICE",
        products=[
            GeminiProductCandidate(
                product_name="Amul Taaza Milk",
                brand="Amul",
                quantity=10,
                unit="packs",
                size="500ml",
                unit_price=28.0,
                total_price=280.0,
                category="Dairy",
                handling_requirement="PERISHABLE",
                needs_review=False,
            ),
            GeminiProductCandidate(
                product_name="Parle-G Biscuit",
                brand="Parle",
                quantity=15,
                unit="pcs",
                size="250g",
                unit_price=10.0,
                total_price=150.0,
                category="Snacks & Packaged Foods",
                handling_requirement="NORMAL",
                needs_review=False,
            ),
        ],
        warnings=["Clean printed bill"],
    )

    client = MockGenAIClient(response=MockGenAIResponse(parsed=mock_result))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    items, ocr_lines = analyzer.analyze(make_png(), "receipt.png", "image/png")

    assert len(items) == 2
    assert items[0].product_name == "Amul Taaza Milk"
    assert items[0].brand == "Amul"
    assert items[0].quantity == 10
    assert items[0].price == 28.0
    assert items[0].handling_type == "PERISHABLE"
    assert items[0].needs_review is False

    assert items[1].product_name == "Parle-G Biscuit"
    assert items[1].price == 10.0
    assert len(ocr_lines) == 2


def test_document_warnings_are_not_copied_to_unrelated_product_rows():
    mock_result = GeminiInventoryAnalysisResult(
        document_type="HANDWRITTEN_LIST",
        products=[
            GeminiProductCandidate(
                product_name="Sugar",
                quantity=10,
                unit="kg",
                unit_price=None,
                category="Groceries",
                needs_review=True,
                review_reason="Price is not visible for this product.",
            )
        ],
        warnings=["Another product has a null total price."],
    )
    analyzer = GeminiInventoryAnalyzer(
        api_key="test-key",
        client=MockGenAIClient(response=MockGenAIResponse(parsed=mock_result)),
    )

    items, _ = analyzer.analyze(make_png(), "list.png", "image/png")

    assert items[0].warnings == [
        "Price is not visible for this product.",
        "Price was not detected or is ambiguous. Please enter the selling price.",
    ]
    assert all("Another product" not in warning for warning in items[0].warnings)


def test_hindi_product_keeps_original_name_and_uses_english_catalog_name():
    result = GeminiInventoryAnalysisResult(
        document_type="HANDWRITTEN_LIST",
        products=[
            GeminiProductCandidate(
                product_name="चीनी",
                english_product_name="Sugar",
                quantity=10,
                unit="kg",
                unit_price=45,
                category="Groceries",
            )
        ],
    )

    items, lines = GeminiInventoryAnalyzer(api_key="test-key")._transform_and_validate(result)

    assert items[0].product_name == "Sugar"
    assert items[0].original_product_name == "चीनी"
    assert lines[0].text.startswith("चीनी")


def test_untranslated_hindi_product_requires_english_name_review():
    result = GeminiInventoryAnalysisResult(
        document_type="HANDWRITTEN_LIST",
        products=[
            GeminiProductCandidate(
                product_name="अस्पष्ट वस्तु",
                english_product_name=None,
                quantity=2,
                unit="packs",
                unit_price=20,
                category="Other Kirana",
            )
        ],
    )

    items, _ = GeminiInventoryAnalyzer(api_key="test-key")._transform_and_validate(result)

    assert items[0].needs_review is True
    assert any("English product name" in warning for warning in items[0].warnings)


def test_inventory_confirmation_requires_english_catalog_name():
    with pytest.raises(ValueError, match="reviewed English catalog name"):
        InventoryConfirmItem(
            product_name="चीनी",
            quantity=10,
            unit="kg",
            price=45,
            category="Groceries",
        )


def test_gemini_document_metadata_candidate_is_discarded():
    mock_result = GeminiInventoryAnalysisResult(
        document_type="PRINTED_INVOICE",
        products=[
            GeminiProductCandidate(
                product_name="Date",
                quantity=120,
                unit="unit",
                unit_price=1.0,
                category="Other Kirana",
            ),
            GeminiProductCandidate(
                product_name="Tata Salt",
                quantity=2,
                unit="packs",
                size="1kg",
                unit_price=28.0,
                category="Groceries",
            ),
        ],
    )
    analyzer = GeminiInventoryAnalyzer(
        api_key="test-key",
        client=MockGenAIClient(response=MockGenAIResponse(parsed=mock_result)),
    )

    items, ocr_lines = analyzer.analyze(make_png(), "bill.png", "image/png")

    assert [item.product_name for item in items] == ["Tata Salt"]
    assert [ocr_line.text for ocr_line in ocr_lines] == ["Tata Salt 1kg 2 packs ₹28.0"]


# 6 & 7. Null fields supported and uncertain fields flagged
def test_null_fields_supported_and_uncertain_fields_flagged():
    mock_result = GeminiInventoryAnalysisResult(
        document_type="HANDWRITTEN_LIST",
        products=[
            GeminiProductCandidate(
                product_name="Maggi Noodles",
                brand="Nestle",
                quantity=None,  # Ambiguous handwriting
                unit="packs",
                size="70g",
                unit_price=14.0,
                total_price=None,
                category="Snacks & Packaged Foods",
                handling_requirement="NORMAL",
                needs_review=True,
                review_reason="Handwritten quantity is ambiguous.",
            )
        ],
    )

    client = MockGenAIClient(response=MockGenAIResponse(parsed=mock_result))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    items, _ = analyzer.analyze(make_png(), "handwritten.jpg", "image/jpeg")

    assert len(items) == 1
    item = items[0]
    assert item.product_name == "Maggi Noodles"
    assert item.quantity is None
    assert item.needs_review is True
    assert "ambiguous" in (item.review_reason or "").lower()


# 8. Hallucinated or invalid category normalized to allowed category or flagged
def test_invalid_category_normalized_or_flagged():
    mock_result = GeminiInventoryAnalysisResult(
        document_type="PRINTED_INVOICE",
        products=[
            GeminiProductCandidate(
                product_name="Amul Ice Cream 500ml",
                quantity=5,
                unit="tubs",
                unit_price=120.0,
                category="Unknown Dessert Category",  # Invalid category
                handling_requirement="NORMAL",
            )
        ],
    )

    client = MockGenAIClient(response=MockGenAIResponse(parsed=mock_result))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    items, _ = analyzer.analyze(make_png(), "bill.png", "image/png")
    assert len(items) == 1
    # Category was invalid and not matched -> flagged for review, ice cream inferred FROZEN
    assert items[0].category is None
    assert items[0].handling_type == "FROZEN"
    assert items[0].needs_review is True
    assert any("Category could not be identified" in w for w in items[0].warnings)


# 9. Invalid quantity rejected and flagged
def test_invalid_quantity_flagged_for_review():
    mock_result = GeminiInventoryAnalysisResult(
        document_type="PRINTED_INVOICE",
        products=[
            GeminiProductCandidate(
                product_name="Tata Salt 1kg",
                quantity=-5,  # Invalid negative
                unit_price=28.0,
                category="Groceries",
            )
        ],
    )

    client = MockGenAIClient(response=MockGenAIResponse(parsed=mock_result))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    items, _ = analyzer.analyze(make_png(), "bill.png", "image/png")
    assert items[0].quantity is None
    assert items[0].needs_review is True


# 10. AI analysis does not update inventory (read-only preview)
def test_ai_analysis_does_not_update_database_inventory(client, retailer_headers, db_session, monkeypatch):
    mock_result = GeminiInventoryAnalysisResult(
        document_type="PRINTED_INVOICE",
        products=[
            GeminiProductCandidate(
                product_name="Unique Brand Test Item 500g",
                quantity=10,
                unit="pcs",
                unit_price=99.0,
                category="Groceries",
            )
        ],
    )

    mock_analyzer = GeminiInventoryAnalyzer(
        api_key="test-key",
        client=MockGenAIClient(response=MockGenAIResponse(parsed=mock_result)),
    )

    monkeypatch.setattr(
        "app.api.v1.endpoints.inventory.InventoryImageAnalyzer",
        lambda: InventoryImageAnalyzer(gemini_analyzer=mock_analyzer),
    )

    # Count inventory rows before
    count_before = db_session.query(Inventory).count()

    response = client.post(
        "/api/retailer/inventory/analyze",
        files={"file": ("bill.png", make_png(), "image/png")},
        headers=retailer_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "Unique Brand Test Item 500g"

    # Inventory row count in database MUST be unchanged
    count_after = db_session.query(Inventory).count()
    assert count_after == count_before


# 11 & 12. Retailer edits and confirms result
def test_retailer_confirms_inventory_import(client, retailer_headers, db_session):
    payload = {
        "source": "IMAGE_ASSISTED",
        "items": [
            {
                "product_name": "Dukaan Special Chai 250g",
                "quantity": 12,
                "unit": "packs",
                "price": 140.0,
                "category": "Beverages",
                "handling_type": "NORMAL",
                "requires_special_equipment": False,
                "low_stock_threshold": 5,
            }
        ],
    }

    res = client.post("/api/retailer/inventory/confirm", json=payload, headers=retailer_headers)
    assert res.status_code == 201
    results = res.json()
    assert len(results) == 1
    assert results[0]["quantity_after"] >= 12


# 13. Duplicate product increments inventory without creating duplicate product row
def test_duplicate_product_increments_inventory(client, retailer_headers, db_session):
    product_name = "Consistent Atta 10kg"
    payload1 = {
        "source": "IMAGE_ASSISTED",
        "items": [
            {
                "product_name": product_name,
                "quantity": 5,
                "unit": "bags",
                "price": 380.0,
                "category": "Groceries",
                "handling_type": "NORMAL",
            }
        ],
    }
    r1 = client.post("/api/retailer/inventory/confirm", json=payload1, headers=retailer_headers)
    assert r1.status_code == 201
    pid1 = r1.json()[0]["product_id"]

    # Second import with same name
    payload2 = {
        "source": "IMAGE_ASSISTED",
        "items": [
            {
                "product_name": product_name,
                "quantity": 8,
                "unit": "bags",
                "price": 380.0,
                "category": "Groceries",
                "handling_type": "NORMAL",
            }
        ],
    }
    r2 = client.post("/api/retailer/inventory/confirm", json=payload2, headers=retailer_headers)
    assert r2.status_code == 201
    pid2 = r2.json()[0]["product_id"]

    # Must increment the same product, not create duplicate
    assert pid1 == pid2
    assert r2.json()[0]["quantity_after"] == r1.json()[0]["quantity_after"] + 8


def test_retried_confirmation_is_idempotent(client, retailer_headers):
    payload = {
        "confirmation_id": "inventory-retry-test-001",
        "source": "IMAGE_ASSISTED",
        "items": [
            {
                "product_name": "Retry Safe Rice 1kg",
                "quantity": 7,
                "unit": "packs",
                "price": 80.0,
                "category": "Groceries",
                "handling_type": "NORMAL",
            }
        ],
    }

    first = client.post("/api/retailer/inventory/confirm", json=payload, headers=retailer_headers)
    retry = client.post("/api/retailer/inventory/confirm", json=payload, headers=retailer_headers)

    assert first.status_code == 201
    assert retry.status_code == 201
    assert retry.json() == first.json()
    products = client.get("/api/retailers/me/products", headers=retailer_headers).json()
    product = next(item for item in products if item["name"] == "Retry Safe Rice 1kg")
    assert product["quantity"] == 7


# 14. Retailer isolation enforced
def test_retailer_isolation_enforced(client, customer_headers):
    # Non-retailer rejected
    res = client.post(
        "/api/retailer/inventory/analyze",
        files={"file": ("bill.png", make_png(), "image/png")},
        headers=customer_headers,
    )
    assert res.status_code == 403


# 15. Gemini timeout handled
def test_gemini_timeout_handled():
    client = MockGenAIClient(error=TimeoutError("Request deadline exceeded"))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    with pytest.raises(HTTPException) as exc:
        analyzer.analyze(make_png(), "bill.png", "image/png")
    assert exc.value.status_code in (503, 504)
    assert "timed out" in exc.value.detail.lower() or "timeout" in exc.value.detail.lower()


# 16. Quota failure handled
def test_gemini_quota_failure_handled():
    from google.genai.errors import APIError

    client = MockGenAIClient(error=APIError(429, {"error": "Resource exhausted: quota exceeded"}))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    GeminiInventoryAnalyzer._quota_blocked_until.clear()
    try:
        with pytest.raises(HTTPException) as exc:
            analyzer.analyze(make_png(), "bill.png", "image/png")
        assert exc.value.status_code == 429
        assert "quota" in exc.value.detail.lower()
        assert int(exc.value.headers["Retry-After"]) >= 60

        with pytest.raises(HTTPException) as cached:
            analyzer.analyze(make_png(), "bill.png", "image/png")
        assert cached.value.status_code == 429
        assert len(client.calls) == 1
    finally:
        GeminiInventoryAnalyzer._quota_blocked_until.clear()


# 17. Malformed Gemini response handled
def test_malformed_gemini_response_handled():
    # Empty products list
    mock_result = GeminiInventoryAnalysisResult(
        document_type="UNKNOWN",
        products=[],
    )
    client = MockGenAIClient(response=MockGenAIResponse(parsed=mock_result))
    analyzer = GeminiInventoryAnalyzer(api_key="test-key", client=client)

    with pytest.raises(HTTPException) as exc:
        analyzer.analyze(make_png(), "bill.png", "image/png")
    assert exc.value.status_code == 422
    assert "manually" in exc.value.detail.lower()


# 18. Manual fallback works
def test_manual_inventory_endpoint(client, retailer_headers):
    payload = {
        "source": "MANUAL",
        "items": [
            {
                "product_name": "Direct Manual Product 1kg",
                "quantity": 20,
                "unit": "kg",
                "price": 50.0,
                "category": "Groceries",
                "handling_type": "NORMAL",
            }
        ],
    }

    res = client.post("/api/retailer/inventory/manual", json=payload, headers=retailer_headers)
    assert res.status_code == 201
    data = res.json()
    assert len(data) == 1
    assert data[0]["quantity_after"] >= 20
