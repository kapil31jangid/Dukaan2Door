# Dukaan2Door Complete Demo Story and Testing Playbook

## Hyperlocal Multi-Retailer and Delivery-Partner Pooling

This guide is the primary setup, user-story, and evaluator runbook for the
Dukaan2Door demonstration. It describes implemented behavior only. Use a
reviewed demo database or disposable Neon branch; do not reseed operational
production data immediately before a presentation.

## Contents

1. Architecture and port map
2. Zero-to-running setup
3. Demo personas and browser layout
4. Lifecycle and pooling model
5. User-story testing playbook
6. Cross-role verification matrix
7. Automated checks
8. Eight-minute faculty story
9. Recovery and sign-off

## 1. Architecture and Port Map

| Component | Technology | Default location | Purpose |
|---|---|---|---|
| Frontend | React, TypeScript, Vite | `http://localhost:3000` | Customer, retailer, and rider portals |
| Backend | FastAPI, Python | `http://localhost:8080` | Authentication and business workflows |
| API documentation | FastAPI OpenAPI | `http://localhost:8080/docs` | Contract inspection and manual requests |
| Database | PostgreSQL / Neon | `DATABASE_URL` | Users, catalog, offers, orders, delivery, tracking |
| Maps | Mapbox GL JS | Browser-side | Maps, markers, and route presentation |
| Routing | OSRM | `OSRM_BASE_URL` | Road geometry, distance, and duration |
| Live tracking | Authenticated WebSocket | `/api/ws/deliveries/{id}` | Rider location and delivery events |

## 2. Zero-to-Running Setup

### 2.1 Prerequisites

- Python 3.11
- Node.js 18 or newer
- PostgreSQL or a reviewed Neon demo branch
- Mapbox public token for Mapbox tiles
- Internet access to the configured OSRM service

### 2.2 Prepare the Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Confirm:

```text
GET http://localhost:8080/health -> 200
GET http://localhost:8080/docs -> Swagger UI
Alembic head -> 20261017_0009
```

### 2.3 Prepare the Pooling Fixtures

Run from the repository root with the intended demo database selected:

```bash
source backend/.venv/bin/activate
python scripts/seed_dashboard_accounts.py --allow-remote
python scripts/seed_satellite_catalog.py --allow-remote --restock
```

The scripts create or update one customer, three nearby retailer stores, and
three nearby delivery partners. Rahul's demo delivery location is Prahlad Nagar,
which produces a distinct pickup-to-customer road route from the Satellite
stores. The catalog command synchronizes actual source
catalog metadata into the three allowlisted demo stores. `--restock` resets
only those demo-store quantities. It does not delete orders or deliveries.
Existing orders retain the coordinates captured at checkout, so always create a
new order after changing demo-account locations.

### 2.4 Prepare the Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Required frontend values include `VITE_API_URL`, `VITE_WS_URL`, and the
operational `VITE_CUSTOMER_STORE_ID`. Mapbox tiles require
`VITE_MAPBOX_TOKEN`.

## 3. Demo Personas and Browser Layout

All controlled accounts use `DemoPassword123!`.

| Window | Persona | Email | Intended demonstration |
|---|---|---|---|
| C | Customer Rahul | `rahul@example.com` | Checkout and live tracking |
| R-A | Rahul Kirana | `satellite.retailer.rahul@example.com` | Winning retailer |
| R-B | Neha Daily Needs | `satellite.retailer.neha@example.com` | Losing first-accept contender |
| R-C | Priya Fresh Mart | `satellite.retailer.priya@example.com` | Retailer decline without cancellation |
| D-A | Rider Rahul | `satellite.rider.rahul@example.com` | Winning rider near pickup |
| D-B | Rider Arjun | `satellite.rider.arjun.3km@example.com` | Losing first-claim contender |
| D-C | Rider Meera | `satellite.rider.meera@example.com` | Decline test and frozen capability |

Authentication uses `sessionStorage`, so separate tabs can hold different
accounts. Separate browser profiles or private windows are still recommended
because they make the three-store and three-rider demonstration easier to see.

Open these routes before starting:

| Persona | Route |
|---|---|
| Customer | `/customer/store` |
| Retailers A/B/C | `/retailer/orders` |
| Riders A/B/C | `/delivery/orders` |

## 4. Lifecycle and Pooling Model

### Retailer opportunity pool

```text
Customer checkout
  -> complete-cart stock and distance matching
  -> one order with three retailer opportunities
  -> first retailer acceptance wins atomically
  -> winner inventory decreases once
  -> losing or declined stores do not lose stock
```

### Order lifecycle

```text
RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP
         -> OUT_FOR_DELIVERY -> DELIVERED
```

### Rider opportunity pool

```text
READY_FOR_PICKUP
  -> visible to all available, nearby, capable riders
  -> rider may decline without affecting other riders
  -> first valid claim wins atomically
  -> ASSIGNED -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
```

## 5. User-Story Testing Playbook

### Epic 1: Customer Discovery and Idempotent Checkout

#### Story 1.1: Place a real catalog order

**As a customer, I want to order available products from nearby stores so that
one eligible local retailer can fulfil the complete cart.**

Test steps:

1. Sign in through `/login/customer` as Customer Rahul.
2. Open the Satellite catalog and select one normal-handling in-stock product.
3. Add a small quantity to the cart and continue to checkout.
4. Confirm the Prahlad Nagar delivery address and coordinates. They must differ
   from the selected store coordinates.
5. Select **Place order** once.
6. Keep the confirmation or status page open.

Expected result:

- `POST /api/orders` returns `201`.
- Status is `RECEIVED`; `store_id` remains empty until acceptance.
- Confirmation says the order was shared with three eligible stores.
- No store inventory changes during checkout.
- Repeating the same checkout token returns the same order.

### Epic 2: Multi-Retailer Pooling

#### Story 2.1: All qualified vendors receive one request

**As an eligible retailer, I want to receive complete-cart opportunities so
that nearby stores can compete on response time without partial fulfilment.**

Test steps:

1. Refresh R-A, R-B, and R-C.
2. Locate the same order number on each dashboard.
3. Confirm each row says `Shared with 3 stores`.
4. Open the order on each dashboard and compare items and quantities.

Expected result:

- All three stores see the same order while their offer is pending.
- An unrelated retailer cannot retrieve or accept it.
- A store missing any cart line would receive no offer.

#### Story 2.2: Decline one vendor without cancelling the order

1. On R-C, reject the opportunity.
2. Refresh R-C and confirm the order is removed.
3. Refresh R-A and R-B and confirm it remains available.

Expected result:

- Priya's offer becomes rejected.
- The customer order remains `RECEIVED`.
- No stock changes at any store.

#### Story 2.3: First retailer acceptance wins

1. Record the selected product stock on R-A and R-B.
2. Accept from R-A.
3. Immediately try to accept the stale request from R-B.
4. Refresh both dashboards.

Expected result:

- R-A receives `200`; R-B receives conflict behavior and refreshes.
- The order is assigned to Rahul Satellite Kirana.
- Only R-A stock decreases, exactly once.
- R-B and R-C cannot update the winner's order.

Detailed cases: [Multi-retailer testing guide](multi-retailer-testing-guide.md).

### Epic 3: Retailer Preparation

#### Story 3.1: Prepare the accepted order

1. On R-A, move `ACCEPTED -> PREPARING`.
2. Select **Mark Ready for Pickup**.
3. Stop retailer actions at `READY_FOR_PICKUP`.

Expected result:

- Riders cannot see the order before `READY_FOR_PICKUP`.
- The ready order enters the shared rider pool.
- The retailer does not need to choose a rider.

### Epic 4: Multi-Rider Pooling

#### Story 4.1: All eligible riders receive one ready job

1. Refresh D-A, D-B, and D-C.
2. Confirm the same order is shown on all three request pages.
3. Confirm each card says `Shared rider pool · 3 eligible`.
4. Compare pickup store, destination, items, and handling labels.

Expected result:

- All available riders within 5 km with required capability see the request.
- A rider outside 5 km cannot list or directly claim it.
- A rider missing required frozen equipment cannot see a frozen job.

#### Story 4.2: Decline without removing the shared job

1. On D-C, select **Decline** and confirm.
2. Refresh D-C, D-A, and D-B.

Expected result:

- D-C no longer sees that order.
- D-A and D-B still see it.
- The customer order remains ready and unassigned.

#### Story 4.3: First rider claim wins

1. Claim from D-A.
2. Attempt the stale claim from D-B before refreshing.
3. Refresh all rider sessions.

Expected result:

- D-A receives the assignment.
- D-B receives a conflict or sees the job disappear.
- Exactly one delivery partner is persisted.

Detailed cases: [Multi-rider testing guide](multi-rider-testing-guide.md).

### Epic 5: Pickup, Route, and Live Tracking

#### Story 5.1: Controlled delivery progression

1. On D-A, select **Accept delivery**.
2. Select **Mark picked up**.
3. Verify the route target changes to the customer.
4. Select **Start delivery**.

Expected result:

- Delivery progresses through `ACCEPTED`, `PICKED_UP`, and
  `OUT_FOR_DELIVERY` in order.
- The customer timeline reflects backend status changes.
- OSRM supplies one canonical pickup-to-customer road geometry; Mapbox renders
  that same geometry on rider and customer screens.

#### Story 5.2: Live location and completion

Real-device mode:

1. Allow browser location access on the rider device.
2. Move while keeping the trip page active.
3. Compare rider and customer maps.

Controlled classroom mode:

1. Enable route playback in both backend and frontend environments.
2. Accept the delivery and show the automatic rider-to-store OSRM leg.
3. Switch tabs and verify that movement continues on the customer map.
4. Wait for the two-minute pickup verification, then mark picked up.
5. Verify that the store-to-customer leg starts automatically.
6. Mark delivered only after arrival.

Expected result:

- Customer receives persisted location updates through WebSocket and polling.
- Marker coordinates are sampled only from the canonical OSRM geometry; the
  covered route turns gray and the remaining route stays blue.
- Reloading customer tracking restores the latest persisted point.
- Completion is manual; movement never marks the delivery complete itself.

### Epic 6: Inventory and Role Isolation

#### Story 6.1: Retailer stock adjustment

1. Open `/retailer/inventory` as R-A.
2. Choose Add/Adjust Stock.
3. Select an existing catalog product, direction, quantity, and reason.
4. Review current and resulting quantity, then confirm.

Expected result:

- Analysis or selection does not write stock before confirmation.
- Reduction cannot produce negative inventory.
- Another retailer cannot modify R-A inventory.
- Reusing a confirmation ID does not apply the change twice.

## 6. Cross-Role Verification Matrix

| ID | Scenario | Actors | Expected outcome |
|---|---|---|---|
| P-01 | One cart, three qualified stores | C, R-A/B/C | Same order visible to all three |
| P-02 | Retailer C declines | R-C, R-A/B | C loses offer; A/B retain it |
| P-03 | Two retailer accept attempts | R-A, R-B | One winner; loser conflict |
| P-04 | Stock after retailer race | R-A/B/C | Winner only, one decrement |
| P-05 | Ready order fan-out | D-A/B/C | Same order visible to three riders |
| P-06 | Rider C declines | D-C, D-A/B | C hides offer; A/B retain it |
| P-07 | Two rider claim attempts | D-A, D-B | One persisted assignment |
| P-08 | Far rider direct claim | API | `409`, outside 5 km |
| P-09 | Frozen eligibility | D-A/B/C | Only frozen-capable rider sees job |
| P-10 | Tracking page refresh | C, D-A | Latest point restored, updates continue |
| P-11 | Unauthorized order access | unrelated account | `403` |
| P-12 | Duplicate checkout | C | Same order, no duplicate stock effect |

## 7. Automated Checks

```bash
cd backend
.venv/bin/python -m pytest -q

cd ../frontend
npm test
npm run build

cd ..
python -m compileall -q backend/app backend/tests scripts
```

Current recorded result: backend `122 passed, 1 PostgreSQL-only test skipped`;
the PostgreSQL race test passed separately. Frontend `23 passed`; production
build passed. Treat these as recorded evidence and rerun after changes.

## 8. Eight-Minute Faculty Story

| Time | Presenter action | Point being demonstrated |
|---|---|---|
| 0:00-0:45 | Show customer cart and checkout | Real catalog and location-aware order |
| 0:45-1:30 | Place order; show three-store count | Complete-cart retailer pooling |
| 1:30-2:30 | Show same order on R-A/B/C; decline C | Shared request and independent decline |
| 2:30-3:15 | Accept A, attempt stale B acceptance | Atomic first-retailer winner |
| 3:15-4:00 | Prepare and mark ready | Retailer-controlled fulfilment gate |
| 4:00-5:00 | Show same job on D-A/B/C; decline C | Eligible-rider pooling |
| 5:00-5:45 | Claim A; show B conflict/removal | Atomic first-rider winner |
| 5:45-7:15 | Accept, pickup, start route | Controlled delivery state machine |
| 7:15-8:00 | Show synchronized customer tracking | Persisted real-time delivery visibility |

Suggested explanation:

> Dukaan2Door does not preassign a store or rider at checkout. It creates one
> order and offers it to every nearby store that can fulfil the complete cart.
> The first verified retailer acceptance locks the order and deducts only that
> store's stock. Once prepared, the order enters a capability-aware rider pool.
> The first valid rider claim wins, and the customer follows the same persisted
> delivery events and locations in real time.

## 9. Recovery and Sign-Off

- Old cart product: clear `d2d_cart`, reload, and add from the refreshed catalog.
- Pool count below three: rerun both seed commands with `--restock`; verify all
  three stores are open and all riders are available with valid coordinates.
- Stale retailer/rider card: select Refresh or wait for the 10-second poll.
- API timeout: verify `/health` and frontend API configuration.
- Route unavailable: verify `OSRM_BASE_URL`; do not present a straight line as a
  road route.
- Route reports `0.0 km`: the order captured identical pickup and drop-off
  coordinates. Complete that no-travel order, rerun the allowlisted account
  seed, and create a new order; existing order coordinates are immutable.
- Tracking disconnected: refresh the customer page and verify the persisted
  snapshot appears before continuing.

Record the order ID, winning store, winning rider, browser profiles, tested
viewport, stock before/after, and any console or network errors.
