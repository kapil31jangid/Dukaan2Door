# Faculty Feedback Resolution

## Scope and safety

The repository was audited before implementation. Changes are limited to two
verified technical gaps and academic deliverables. Existing authentication,
shopping, order lifecycle, matching, retailer acceptance, inventory
confirmation, delivery locking, frozen-box eligibility, Mapbox, OSRM, and
WebSocket behavior were retained. No operational Neon data was reset, seeded,
or migrated.

## Resolution matrix

| Faculty comment | Previous status | Final status | Implementation evidence | Remaining limitations |
|---|---|---|---|---|
| 1. Inventory management | IMPLEMENTED AND VERIFIED | RESOLVED AND VERIFIED | `backend/app/api/v1/endpoints/inventory.py`; `backend/app/models/inventory_adjustment.py`; `frontend/src/pages/retailer/RetailerInventoryPage.tsx`; inventory integration tests | Operational verification still requires applying current head `20261017_0009` through the controlled deployment runbook |
| 2. Shopkeeper product-photo inventory management | PARTIALLY IMPLEMENTED | RESOLVED AND VERIFIED | `POST /api/retailer/inventory/analyze-product-photo`; `POST /api/retailer/inventory/adjust`; `GeminiInventoryAnalyzer.analyze_product_photo`; `InventoryOnboardingModal.tsx`; product-photo tests | Recognition remains best effort; no barcode field exists; unmatched products must use the authorized product-creation workflow |
| 3. Sufficient-stock matching and retailer acceptance before rider dispatch | PARTIALLY IMPLEMENTED | RESOLVED AND VERIFIED | `find_eligible_stores`; retailer offer tables; atomic accept/reject endpoints; SQLite workflow tests and PostgreSQL race test | Opportunities refresh by polling rather than push; matching radii remain 2 km then 5 km |
| 4. Product categorization and frozen-box eligibility | IMPLEMENTED AND VERIFIED | RESOLVED AND VERIFIED | Product handling metadata; `required_capabilities_for_order`; available-order filtering; frozen rider integration test; handling labels in `AvailableOrdersPage.tsx` | Correct eligibility depends on retailer-reviewed product handling metadata |
| 5. Exclusive rider acceptance | IMPLEMENTED AND VERIFIED | RESOLVED AND VERIFIED | Locked `assign_delivery_partner`; `POST /available-orders/{order_id}/claim`; duplicate-assignment integration tests | PostgreSQL is authoritative; UI state alone is never treated as a lock |
| 6. Rider rejection | PARTIALLY IMPLEMENTED | RESOLVED AND VERIFIED | Existing assigned rejection plus new `POST /available-orders/{order_id}/decline`; `DeliveryRejection`; Accept/Decline UI; decline integration tests | Accepted-delivery cancellation remains controlled by the existing state machine; picked-up withdrawal/reassignment is intentionally not implemented |
| 7. Business model | NOT IMPLEMENTED | RESOLVED AND VERIFIED | `docs/business-model.md` contains value propositions, revenue hypotheses, costs, editable unit economics, canvas, and validation plan | Commercial assumptions and profitability are not financially validated; payment, billing, commission, settlement, and payout are not implemented |
| 8. Survey | NOT IMPLEMENTED | PARTIALLY RESOLVED | Two consent-ready questionnaires, methodology, empty CSV templates, results template, and `scripts/analyze_survey.py` | Human distribution, genuine responses, analysis review, and evidence-based findings remain pending |

## Technical changes

### Product-photo and stock adjustment

```text
Capture/upload photo
  -> validate image
  -> Gemini packaging extraction (PaddleOCR text fallback when available)
  -> deterministic store-catalog candidates
  -> retailer selects exact product and pack size
  -> retailer selects ADD or REDUCE, quantity, and reason
  -> preview current +/- adjustment = expected stock
  -> confirmed, locked inventory transaction
  -> inventory adjustment audit record
```

Safety properties:

- Analysis performs no stock write.
- Product-photo adjustment cannot create a catalog product.
- Quantity is never inferred from one visible package.
- A multiple-unit visual count remains marked for review.
- Reductions cannot produce negative stock.
- Product and inventory records are store-scoped and locked.
- Confirmation keys return the original result instead of applying twice.
- Adjustment history records delta, resulting quantity, source, reason, batch
  reference, timestamp, store/product, and authorized retailer user.

Migration `20261012_0008` adds nullable inventory-adjustment actor attribution.
Current head `20261017_0009` adds retailer opportunities, checkout idempotency,
and deferred store assignment. These were not applied to operational Neon.

### Rider decline semantics

The application uses a shared claimable-order pool. Declining an offer records
the rider against the order's delivery record, hides that offer from the same
rider, and leaves it available to other eligible riders. It does not claim the
delivery, cancel the customer order, or modify inventory. The existing assigned
but unaccepted rejection remains separate. Unrestricted cancellation after
acceptance was not added.

## API evidence

| Endpoint | Purpose |
|---|---|
| `POST /api/retailer/inventory/analyze` | Existing bill/list review drafts |
| `POST /api/retailer/inventory/analyze-product-photo` | New packaging analysis and catalog candidates; read-only |
| `POST /api/retailer/inventory/confirm` | Existing reviewed inventory additions |
| `POST /api/retailer/inventory/adjust` | New idempotent add/reduce transaction for an existing catalog product |
| `GET /api/retailer/inventory/history` | Store-scoped adjustment audit history |
| `POST /api/deliveries/available-orders/{order_id}/claim` | Existing exclusive claim |
| `POST /api/deliveries/available-orders/{order_id}/decline` | New pre-claim offer decline |
| `POST /api/deliveries/{delivery_id}/reject` | Existing assigned-but-unaccepted rejection |

## Verification evidence

Focused tests cover:

- Product-photo image type and role validation
- Read-only analysis and catalog match/current stock
- Pack-size separation
- Add/reduce, insufficient stock, duplicate confirmation, store isolation, and
  adjustment audit actor
- Offer decline authorization/state restrictions
- Decline visibility, no claim/cancellation, no additional decrement, and claim
  by another rider
- Existing matching, stock decrement, frozen eligibility, and exclusive claim
  regression behavior

Latest regression executed on 2026-10-17 against the completed working tree:

| Validation | Result |
|---|---|
| Backend pytest | `122 passed, 1 PostgreSQL-only test skipped`, 9 deprecation warnings |
| Gemini-focused pytest | `23 passed`, 3 deprecation warnings |
| Frontend tests | `23 passed` |
| Frontend TypeScript/Vite build | Passed; existing Mapbox chunk-size warning remains |
| Responsive authenticated browser smoke | `90/90` checks passed on isolated PostgreSQL and ports; no overflow, page errors, or failed API responses |
| Isolated API story | All 10 customer-retailer-rider lifecycle checkpoints passed |
| Python compile check | Passed |
| Alembic heads | One head: `20261017_0009` |
| Disposable PostgreSQL 16 migration | Fresh upgrade passed; `0009 -> 0008 -> 0009` round trip passed |
| PostgreSQL retailer/rider race test | Passed; one retailer and one rider persisted |
| PostgreSQL inventory verifier | Schema, actor audit, replay, adjustment safety, isolation, and rollback passed |
| Survey empty-input guard | Exit `2`; no findings file generated |
| Git whitespace check | Passed |

The browser smoke used a disposable PostgreSQL container and allowlisted local
demo accounts. The migration verifier and browser test did not connect to or
modify operational Neon.

## Human actions still required

1. Obtain faculty approval for survey distribution and sample targets.
2. Enter the questionnaires into an approved form tool and collect voluntary,
   genuine responses.
3. Export private CSV files, run the analyzer, review free-text privacy, and
   complete `survey-results-template.md` with actual evidence.
4. Validate commercial assumptions through retailer interviews and a supervised
   pilot; update unit economics from measured costs and completed orders.
5. Apply migration `20261017_0009` to a production-like Neon branch first, then
   follow the controlled production migration runbook after authorization.
