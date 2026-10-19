# Dukaan2Door Complete Workflow Audit

**Audit date:** 2026-10-17  
**Verdict:** **READY WITH LIMITATIONS** for a supervised local demonstration.

## Executive summary

The repository previously assigned an order to one store and decremented that
store's inventory during checkout. It now creates one customer order, finds all
stores in the active 2 km service tier (or the 5 km fallback tier) that can fill
the whole cart, and creates a durable opportunity for each store. The first
valid retailer acceptance locks the order and relevant inventory rows,
revalidates stock, assigns the store, deducts only that store's inventory, and
closes competing opportunities.

Delivery opportunities already used a shared eligible-rider pool. The claim
path locks the order and rider, so one rider wins. Declines are per rider and do
not cancel the order. A PostgreSQL 16 concurrency test verified both retailer
and rider races.

Tracking now preserves raw GPS positions, sends a persisted latest-location
snapshot on WebSocket connection, orders updates by database sequence, and
uses OSRM road geometry for the displayed route. Controlled route playback is
disabled by default. When enabled, the backend owns both route legs, continues
movement across browser tab changes, enforces a two-minute pickup dwell, and
broadcasts persisted route points through the authenticated WebSocket channel.

## Architecture evidence

| Area | Frontend | API / service | Data |
|---|---|---|---|
| Customer checkout | `CheckoutPage`, `CartContext` | `POST /api/orders`, `find_eligible_stores` | `orders`, `order_items`, retailer offer tables |
| Retailer fulfillment | `RetailerOrdersPage`, `OrderDetailModal` | retailer accept/reject and status endpoints; `accept_retailer_offer` | orders, offers, inventory, adjustments |
| Inventory onboarding | `RetailerInventoryPage`, `InventoryOnboardingModal` | `/api/retailer/inventory/*` | products, inventory, adjustments |
| Rider opportunity | `AvailableOrdersPage` | available/claim/decline; `assign_delivery_partner` | deliveries, partners, rejections |
| Tracking | `PartnerLocationTracker`, customer tracking pages, `DeliveryMap` | location, route, tracking, authenticated WebSocket | delivery tracking and partner coordinates |
| External routing/maps | `MapView` / Mapbox GL JS | `routing_service` / OSRM | no external map data persisted |

Authentication uses JWT user context and endpoint role dependencies. CORS is
environment-configured. PostgreSQL is accessed through SQLAlchemy and schema
changes are managed by Alembic.

## Expected versus actual workflow

1. **Checkout:** the customer submits validated items, address, coordinates,
   and an idempotency token. Success is shown only after the API returns.
2. **Retailer opportunities:** one order and multiple store-specific offers are
   persisted. Ineligible or partially stocked stores receive no offer.
3. **Retailer claim:** the first committed acceptance wins. Stock remains
   unchanged until this transaction.
4. **Fulfillment:** the winner moves `ACCEPTED -> PREPARING -> READY_FOR_PICKUP`.
5. **Rider opportunities:** all eligible riders see the shared ready-order pool.
   Frozen requirements are checked from product metadata and partner capability.
6. **Rider claim:** the first committed claim assigns one rider and marks that
   rider unavailable. Other claims fail or return an already-assigned result.
7. **Trip:** delivery states progress through `ASSIGNED -> ACCEPTED -> PICKED_UP
   -> OUT_FOR_DELIVERY -> DELIVERED`; corresponding order state is synchronized.
8. **Tracking:** assigned-rider coordinates are validated, persisted, broadcast,
   restored after reconnect, and displayed against an OSRM route.

## Findings and corrections

| Severity | Finding | Root cause | Correction |
|---|---|---|---|
| P0 | Checkout selected one retailer | Order required `store_id` immediately | Nullable pre-claim store plus durable retailer offers |
| P0 | Stock changed before retailer accepted | Checkout owned inventory transaction | Deduction moved into row-locked acceptance transaction |
| P0 | No retailer checkout retry key | Duplicate submissions created duplicate orders | Customer-scoped `checkout_token` unique constraint |
| P0 | Customer could miss current rider point after reconnect | WebSocket sent only future events | Server sends latest persisted snapshot at connection |
| P0 | Route playback lacked a server configuration gate | Browser-owned movement | Backend-owned playback requires `ENABLE_ROUTE_PLAYBACK=true` |
| P1 | Timestamp ties could discard valid tracking updates | Client freshness used timestamp only | Database tracking sequence takes precedence |
| P1 | Browser tab suspension stopped route movement | Movement used `requestAnimationFrame` | Backend task owns both OSRM legs and resumes active trips after restart |

## Retailer broadcast and inventory consistency

`find_eligible_stores` evaluates complete-cart stock and store status, then
returns every matching store in the first non-empty radius tier. Offer items
retain each store's exact product and inventory mapping, including pack-size
identity. Checkout performs no stock write. Acceptance locks the order, offer,
and mapped inventory rows; it rejects stale or insufficient offers and records
one adjustment per deducted line. Other pending offers become `LOST`.

All-retailer rejection leaves stock unchanged and moves the order to `REJECTED`
when no pending offer remains. Pending opportunities expire lazily when a
retailer list is read; there is no background scheduler. If the winning
retailer abandons an already accepted order, automatic timeout/rebroadcast is
not implemented.

## Rider broadcast and exclusivity

The delivery pool filters ready orders by partner availability, valid current
location, 5 km pickup distance, required capabilities, and prior per-order
decline. A decline records `delivery_rejections`, does not claim the delivery,
and does not cancel the order. A claim locks the order and partner. The current
design has no timed offer object: if all known riders decline, the order stays
`READY_FOR_PICKUP` and can be seen by a newly eligible rider. Accepted/picked-up
cancellation and silent reassignment are intentionally unsupported.

## GPS, routing, and synchronization

Real GPS comes from `navigator.geolocation.watchPosition`, including accuracy,
capture time, and heading. Only the assigned rider can publish. The backend
validates coordinates, persists a `DeliveryTracking` row, updates the partner,
and broadcasts the exact accepted position. Real coordinates are not forced
onto the polyline. OSRM is recalculated after status changes and after bounded,
meaningful movement; pickup is the destination before pickup and the customer
after pickup. Customer screens combine WebSocket events with a 2.5-second
tracking fallback and reject stale sequence numbers.

Controlled route coordinates are sampled from the OSRM GeoJSON line, so covered
and remaining route layers agree with marker progress. They are stored as
`ROUTE_PLAYBACK`, separately from real GPS updates.

## Frontend and security audit

- Protected role routes and backend role checks cover all three portals.
- Important mutations expose loading/error states and refresh after conflicts.
- Retailer and rider opportunities use polling (10 seconds on retailer orders),
  not push notifications. A passive losing retailer can therefore see a stale
  card until its next refresh; a stale acceptance is still rejected server-side.
- WebSocket rooms are authenticated and delivery-authorized.
- The WebSocket manager is process-local. Multiple backend instances need a
  shared pub/sub layer and sticky/session-aware deployment.
- Controlled route mode requires both `VITE_ENABLE_ROUTE_PLAYBACK=true` and
  `ENABLE_ROUTE_PLAYBACK=true`; defaults are false.

## Test evidence

| Command / environment | Actual result |
|---|---|
| `cd backend && python -m pytest -q` | 122 passed, 1 skipped, 9 warnings |
| Focused backend API/integration suite | 50 passed, 2 warnings |
| PostgreSQL row-lock race test (`postgres:16-alpine`) | 1 passed |
| Alembic empty upgrade, downgrade to `0008`, re-upgrade | Passed; head `20261017_0009` |
| `cd frontend && npm test` | 23 passed |
| `cd frontend && npm run build` | Passed; Vite chunk-size warning only |
| Isolated `scripts/run_story.py` on PostgreSQL 16 | Passed all 10 API lifecycle checkpoints |
| Isolated authenticated Playwright responsive smoke | 90 checks; no overflow, page errors, or failed API responses |
| `python -m compileall -q backend/app backend/tests scripts` | Passed |

The default backend run skips the PostgreSQL-only row-lock test by design; it
was separately executed with `TEST_POSTGRES_URL` against the disposable local
container. No operational Neon rows or migrations were touched.

## Acceptance status

| Criterion | Status |
|---|---|
| Customer checkout, validation, duplicate protection | Verified automated |
| Every eligible store receives one shared-order opportunity | Verified automated |
| Exactly one retailer wins; winner stock only | Verified on PostgreSQL |
| Retailer preparation and ready state | Verified automated |
| Eligible rider pool, decline, frozen capability | Verified automated |
| Exactly one rider wins | Verified on PostgreSQL |
| Pickup/customer route switching | Verified automated and code traced |
| Assigned-rider GPS authorization and persistence | Verified automated |
| WebSocket reconnect snapshot and ordering | Verified automated |
| OSRM road geometry and Mapbox layers | Code/unit verified; live visual check pending |
| Browser-independent OSRM route playback | Unit/API verified; persisted live route reached the configured destination |
| Authenticated portal rendering across three roles | 90-check browser smoke passed |
| Full multi-session browser mutation and map lifecycle | **Not executed in this audit** |

## Remaining limitations

1. Authenticated responsive routes were browser-tested, but no live
   multi-session retailer race or real Mapbox/OSRM movement demonstration was
   executed. That visual acceptance remains a human pre-demo step.
2. Opportunity delivery is query/poll based rather than server-pushed.
3. In-memory WebSockets support one backend process only.
4. Retailer offer expiry is lazy, with no scheduled recovery or post-accept SLA.
5. No unrestricted cancellation/reassignment exists after retailer or rider
   commitment; this is safer than silent stock or custody changes but leaves an
   operational exception for future design.

These limitations are non-blocking for a single-instance supervised local demo
after the manual checklist is completed. They block an unconditional
production-readiness claim.
