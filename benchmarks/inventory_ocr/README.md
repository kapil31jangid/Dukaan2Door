# Inventory OCR Benchmark

This directory defines a local, opt-in benchmark for representative inventory
documents. Images and generated results are ignored by Git so that bills,
addresses, and supplier details are not committed accidentally.

Create `manifest.json` next to this file:

```json
{
  "cases": [
    {
      "name": "Clean generated receipt",
      "category": "generated-clean",
      "file": "images/clean-receipt.png",
      "expected": [
        {"product_name": "Amul Milk", "quantity": 10, "price": 28}
      ]
    }
  ]
}
```

Recommended categories are `generated-clean`, `printed-kirana-bill`,
`phone-photo`, `tilted`, `low-light`, `handwriting-neat`,
`handwriting-average`, and `handwriting-poor`.

Run:

```bash
source backend/.venv/bin/activate
python scripts/benchmark_paddle_ocr.py
```

Ground truth is optional per field. The tool reports exact normalized
product-name, quantity, and price accuracy only where ground truth is present,
along with processing time. Review the image set before sharing results:
handwriting performance must be measured rather than assumed.
