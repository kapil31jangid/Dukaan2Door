# Gemini Inventory Demo Readiness

Gemini is the primary inventory image analyzer. PaddleOCR remains a local
fallback when Gemini is unavailable; manual entry is always available. No AI
result writes stock until the retailer reviews and confirms it.

## Configuration

Set these only in the backend environment:

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
```

Never place the key in `frontend/.env`, screenshots, logs, benchmark output, or
Git. Restart the backend after changing environment variables.

## Pre-Demo Checklist

1. Confirm the backend and frontend health using the normal test commands.
2. Confirm the configured Gemini project has quota for the planned session.
3. Use one sanitized, consented sample bill to warm and verify the workflow.
4. Do not run the nine-case live benchmark immediately before a demo; it spends
   provider quota without improving the demo state.
5. Keep the selected image in the review flow and verify that detected rows are
   editable, removable, and not saved before confirmation.
6. Verify manual entry once so the demonstration can continue if AI is down.
7. Never demonstrate against operational stock unless the retailer has approved
   the exact inventory change.

## Quota And Failure Behavior

- A Gemini HTTP 429 starts a server-side cooldown keyed by model and API key.
  Requests during the cooldown do not call the provider again and include a
  `Retry-After` response internally.
- Concurrent Gemini calls are serialized in the current single-process backend
  to reduce quota bursts.
- The inventory analyzer attempts local PaddleOCR for provider 429/5xx failures.
- If fallback cannot produce reliable rows, the UI must show the manual-entry
  action. It must not generate sample products or claim success.
- In a multi-instance deployment the cooldown is process-local. Provider quota
  is still authoritative; shared throttling would require external coordination.

## Current Accuracy Evidence

The last complete live synthetic benchmark completed 9/9 cases with normalized
product-name accuracy 81.8%, quantity accuracy 100%, unit-price accuracy 38.1%,
review-flag agreement 54.5%, and average response time 6.46 seconds. These images
were generated/transformed fixtures, not genuine retailer photographs.

Price extraction is not trusted for automatic import. Positive selling price is
required at confirmation, and every field remains subject to retailer review.
Use `benchmarks/inventory_ocr/genuine/README.md` to collect representative,
consented evidence before making field-accuracy claims.
