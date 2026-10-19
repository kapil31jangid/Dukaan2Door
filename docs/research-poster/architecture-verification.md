# Dukaan2Door Poster Architecture Verification

## Scope

This note verifies the components and connections shown in
`dukaan2door-architecture.svg` and `dukaan2door-architecture.drawio` against the
current repository. The diagram is a poster-scale runtime overview, not a full
class or deployment diagram.

Repository inspected: `https://github.com/kapil31jangid/Dukaan2Door.git`

Pinned commit at audit time: `c9f2c5ad03a6f33a51fe357534fa6e7caf4d4ebe`

The working tree contained ongoing inventory and delivery changes during the
audit. Current source was inspected for the poster; no application source,
configuration, migration, test, or supplied poster file was modified by this
task.

## Verified Components

| Diagram component | Repository evidence | Verified responsibility |
|---|---|---|
| Customer Portal | `frontend/src/App.tsx:135-161`, `frontend/src/services/customerService.ts:7-107` | Protected customer routes browse products, place orders, read tracking, and request delivery routes. |
| Retailer Portal | `frontend/src/App.tsx:98-116`, `frontend/src/services/retailerService.ts:24-130` | Protected retailer routes manage products and inventory and advance retailer-owned orders. |
| Delivery Partner Portal | `frontend/src/App.tsx:118-133`, `frontend/src/services/deliveryService.ts:11-91` | Protected rider routes list, decline, and claim ready orders; update delivery status and location. |
| FastAPI REST API | `backend/app/main.py:17-42`, `backend/app/api/v1/api.py:1-31` | FastAPI mounts the versioned endpoint routers and applies CORS and application middleware. |
| JWT and RBAC | `backend/app/core/security.py:11-46`, `backend/app/core/deps.py:27-75` | Bearer tokens are decoded server-side and database-backed roles guard protected endpoints. |
| Catalog and Store Matching | `backend/app/services/store_matching_service.py:37-156` | Open stores are distance-ranked and checked for all requested quantities, with a 2 km preference and 5 km fallback. |
| Order Lifecycle | `backend/app/api/v1/endpoints/orders.py:140-249`, `backend/app/services/order_service.py:7-56` | Order creation locks inventory rows, validates quantities, decrements stock once, creates line items, and commits the order transaction. Role-specific transitions govern retailer fulfillment. |
| Delivery Assignment | `backend/app/api/v1/endpoints/deliveries.py:56-223`, `backend/app/services/delivery_service.py:49-223` | Only ready orders are offered. Partner distance, availability, rejection history, and required equipment are checked. Assignment uses a row lock to preserve exclusive claims. |
| Real-Time Tracking | `backend/app/api/v1/endpoints/deliveries.py:237-357`, `backend/app/api/v1/endpoints/websocket.py:13-47`, `backend/app/services/realtime_service.py:7-35` | Authorized rider GPS and status updates are persisted and broadcast to authorized delivery viewers over WebSockets. |
| PostgreSQL on Neon | `backend/app/core/config.py:6-16`, `backend/app/db/session.py:1-22`, `backend/alembic/versions/` | SQLAlchemy uses the configured PostgreSQL URL with Neon-friendly pool handling; Alembic owns schema migrations. |
| Mapbox GL JS | `frontend/src/components/maps/MapView.tsx:1-140`, `frontend/package.json` | Browser clients create Mapbox maps and render markers and GeoJSON route layers using `VITE_MAPBOX_TOKEN`. |
| OSRM | `backend/app/services/routing_service.py:10-48`, `backend/app/api/v1/endpoints/deliveries.py:303-337` | The backend requests driving routes and returns provider-derived geometry, distance, and duration. |

## Verified Primary Workflow

The actual order path represented in the diagram is:

1. The customer browses the store-scoped catalog and submits an order through
   the React portal and authenticated REST API.
2. The backend matches an open store that can satisfy every requested quantity,
   preferring an eligible store within 2 km and falling back to 5 km.
3. During order creation, the backend locks matching inventory rows, validates
   stock again, decrements inventory, creates the order and line items, and
   commits one transaction with status `RECEIVED`.
4. The retailer advances the order through `ACCEPTED`, `PREPARING`, and
   `READY_FOR_PICKUP` using role-authorized endpoints.
5. Only a `READY_FOR_PICKUP` order becomes claimable. The backend checks rider
   location, availability, prior decline, and equipment eligibility, then uses
   a database row lock so only one rider can claim it.
6. The rider progresses through pickup, out-for-delivery, and completion. The
   route endpoint obtains road geometry from OSRM.
7. Authorized GPS and status updates are stored in PostgreSQL and broadcast
   through an authenticated delivery-specific WebSocket. Mapbox renders the
   route and markers in the browser.

This ordering intentionally corrects a common simplified description: retailer
acceptance occurs after backend store matching and transactional inventory
decrement, while rider dispatch is gated by `READY_FOR_PICKUP`.

## Trust Boundaries

- **Browser boundary:** the three role portals are untrusted clients. Their
  requests are validated and authorized by FastAPI; frontend role checks are
  navigation aids, not the security authority.
- **Application boundary:** FastAPI owns authentication, authorization,
  validation, state transitions, inventory writes, assignment locking, and
  WebSocket access checks.
- **Data boundary:** PostgreSQL is the authoritative store for users, stores,
  products, inventory, orders, deliveries, rejections, and tracking history.
- **External services:** Mapbox serves browser map content; OSRM returns route
  calculations. Neither service owns order, inventory, or delivery state.

## Supporting Capability Kept Outside the Main Diagram

AI-assisted inventory onboarding is implemented, but it is not part of every
customer order and would make the poster diagram harder to read. The retailer
can upload a bill/stock list or product photo, receive review-only candidates,
select catalog matches, and explicitly confirm an inventory change.

Evidence:

- `backend/app/api/v1/endpoints/inventory.py:123-222`
- `backend/app/services/inventory_image_analyzer.py:19-136`
- `backend/app/services/gemini_inventory_analyzer.py`
- `frontend/src/components/retailer/InventoryOnboardingModal.tsx`

Gemini is used only when `GEMINI_API_KEY` is configured. PaddleOCR is an
optional local fallback. Analysis does not write stock by itself; confirmation
and stock-adjustment endpoints perform the authorized transaction.

## Deliberate Exclusions

| Excluded item | Reason |
|---|---|
| Gemini and PaddleOCR nodes | Verified optional inventory-onboarding providers, but not essential dependencies of the primary order runtime. Documented above instead of adding poster edges. |
| Payment gateway | Checkout explicitly states that online payments are not enabled; no Razorpay or Stripe runtime integration was found. |
| Commission, subscription, rider payout | These are business-model proposals, not implemented transaction systems. |
| Render and Vercel runtime boxes | Deployment guides describe these targets, but the repository contains no `render.yaml` or `vercel.json` proving an active deployment topology. The backend Dockerfile is retained as packaging evidence only. |
| Redis or message broker | WebSocket broadcasting uses an in-memory connection manager; no shared pub/sub service is implemented. |
| Demo rider simulation | Development-only presentation behavior is not authoritative GPS and is intentionally omitted from the production architecture. |
| Product datasets and survey tooling | They support ingestion or academic validation, not the live order request path shown here. |

## Validation Checklist

- SVG is XML-valid and uses a `3000 × 1800` viewBox.
- PNG is rendered from the SVG on a white background at `3000 × 1800` pixels.
- Draw.io source is XML-valid and contains editable text, boxes, and connectors.
- The compact three-column diagram uses 11 verified runtime modules and only
  five panel-level connectors.
- REST, database, Mapbox, and OSRM links use thin solid connectors; the
  server-to-client WebSocket path is dashed.
- Labels use large poster-safe text and remain inside their boxes.
- No application source, database, configuration, migration, or test was
  changed to produce the assets.

## Poster Placement

Recommended asset ratio: **1.67:1**.

For the supplied 4608 × 4608 poster, place the diagram at approximately
**1700 × 1020 pixels** in the center column. The current Methodology section has
no unused area large enough for readable insertion, so reserve roughly
`x = 1470-3170`, `y = 1780-2800` by shortening or moving the lower Methodology
bullets; do not overlay the diagram on the existing text. This preserves the
poster's columns, maroon section header, and Data Analysis band. Keep at least
70 pixels of clear space around the asset. For print layout, an equivalent size
is approximately **13.3 × 8 inches**; the SVG should be preferred because it
remains sharp at any print resolution.

Use the PNG only where the poster editor cannot import SVG. The Draw.io file is
the editing master for changing labels, colors, or spacing.

## Presentation Summary

Dukaan2Door has three role-specific React portals backed by one secured FastAPI
application. A customer order is matched to a nearby store with sufficient
stock, inventory is validated and updated transactionally, and the retailer
moves the order to ready-for-pickup. An eligible rider then claims the order
exclusively, OSRM supplies the road route, and authenticated GPS/status events
are persisted in PostgreSQL and sent live to the tracking interface. Mapbox is
the browser visualization layer; the backend and database remain authoritative
for all operational state.
