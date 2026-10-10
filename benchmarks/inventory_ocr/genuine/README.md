# Genuine Inventory Fixture Guide

Use this directory for consented, sanitized photographs of real kirana bills and
handwritten lists. Images, local manifests, and results are ignored by Git.

## Privacy Rules

Remove or mask names, phone numbers, addresses, GST identifiers, payment details,
signatures, and any other personal or supplier-confidential data. Obtain consent
before collecting a retailer document. Never commit raw images.

## Recommended Corpus

Collect at least two examples for each available category: printed invoice,
phone photograph, tilted document, low light, neat handwriting, average
handwriting, and poor handwriting. Keep hard cases; do not curate only successes.

## Ground Truth

Copy `manifest.example.json` to the ignored `manifest.json`, place files under
the ignored `images/` directory, and transcribe only fields visibly present.
Use `null` for missing information. Mark whether each expected row should require
review. A second person should check the transcription.

Run from the repository root:

```bash
source backend/.venv/bin/activate
python scripts/benchmark_gemini_inventory.py benchmarks/inventory_ocr/genuine/manifest.json
```

The report includes provider failures, missing rows, extra/hallucinated rows,
field accuracy, category summaries, and latency. Do not publish accuracy from a
partial run or from fixtures without verified ground truth.
