# Backend 2

Backend 2 owns store matching, delivery assignment, routing, delivery tracking, and real-time delivery updates.

## Architecture

```text
Customer
  |
  v
POST /api/orders
  |
  v
Store matching service
  |
  +-- 2 km eligible store search
  |
  +-- 5 km fallback if no 2 km match
  |
  v
Atomic order creation + inventory decrement
  |
  v
Retailer marks READY_FOR_PICKUP
  |
  v
Delivery assignment service
  |
  v
Routing + tracking + WebSocket updates
```

## Store Matching

`app.services.store_matching_service.find_matching_store` accepts customer coordinates and requested product quantities.

Eligibility rules:

- store is open
- store has valid latitude and longitude
- product belongs to that store
- product is active
- inventory exists
- inventory is available
- inventory quantity is sufficient
- store is within the active search radius

Search order:

1. Search eligible stores within 2 km.
2. If none exists, search eligible stores within 5 km.
3. If none exists, return a no-match result.

Selection rule:

1. shortest Haversine distance
2. lowest stable store ID as tie-breaker

## Inventory Validation

Order creation calls store matching first, then locks the selected store inventory rows with SQLAlchemy `with_for_update()`, rechecks availability and quantity, decrements inventory, and creates the order/order items in one transaction.

## APIs

- `POST /api/matching/store`
- `POST /api/orders`
- `POST /api/deliveries/{order_id}/assign`
- `GET /api/deliveries/{delivery_id}`
- `PATCH /api/deliveries/{delivery_id}/status`
- `POST /api/deliveries/{delivery_id}/location`
- `GET /api/deliveries/{delivery_id}/route`
- `GET /api/deliveries/{delivery_id}/tracking`
- `WebSocket /api/ws/deliveries/{delivery_id}` using a `token` query parameter

## Delivery Assignment

Delivery assignment is allowed only after an order reaches `READY_FOR_PICKUP`.

The assignment service selects the nearest available delivery partner with valid coordinates. Ties are resolved by lowest delivery partner ID. Duplicate delivery rows are prevented by checking the existing one-to-one order delivery relationship and the database unique constraint on `deliveries.order_id`.

## Delivery Status Flow

Allowed delivery transitions:

- `ASSIGNED -> PICKED_UP`
- `PICKED_UP -> OUT_FOR_DELIVERY`
- `OUT_FOR_DELIVERY -> DELIVERED`
- `ASSIGNED -> CANCELLED`

Order status is kept consistent:

- `PICKED_UP` and `OUT_FOR_DELIVERY` move the order to `OUT_FOR_DELIVERY`
- `DELIVERED` moves the order to `DELIVERED`

## Routing

`app.services.routing_service.get_route` calls OSRM using `OSRM_BASE_URL` from settings.

It returns:

- distance in kilometers
- duration in minutes
- route geometry when OSRM provides it

Timeouts, HTTP failures, missing routes, and invalid OSRM payloads return `503 Service Unavailable`.

## Tracking

Delivery partner location updates:

1. validate latitude and longitude
2. update the partner's current location
3. insert a `delivery_tracking` history record
4. broadcast a WebSocket event to subscribers

Historical tracking rows are never overwritten.

## WebSocket Flow

Clients connect to:

```text
/api/ws/deliveries/{delivery_id}?token=<JWT>
```

The socket validates the JWT and checks delivery ownership:

- customer can subscribe to their own delivery
- retailer can subscribe to deliveries for their store orders
- delivery partner can subscribe to assigned deliveries

Events:

- `delivery_assigned`
- `delivery_location_updated`
- `delivery_status_updated`
- `delivery_completed`

The current manager is in-memory and suitable for a single Render web service instance. A multi-instance deployment would need shared pub/sub infrastructure.

## Authorization

Backend 2 uses the existing JWT and role dependencies.

- customer: match stores, create orders, view own delivery/tracking
- retailer: assign deliveries for own store orders
- delivery partner: update only their assigned delivery status/location

## Error Handling

- invalid coordinates: `400`
- no matching store: `404`
- insufficient inventory: `409`
- order not found: `404`
- delivery partner unavailable: `409`
- invalid delivery transition: `409`
- OSRM unavailable: `503`
- unauthorized: `401`
- forbidden: `403`

## Testing

Backend 2 tests cover:

- Haversine distance
- invalid coordinates
- 2 km store matching
- 5 km fallback
- no-store matching failure
- closed/unavailable/insufficient inventory behavior
- order integration and inventory decrement
- delivery assignment and duplicate prevention
- invalid delivery transition
- tracking persistence
- partner current location update
- mocked OSRM route response

Run:

```bash
python -m compileall -q backend/app backend/tests scripts
cd backend
python -m pytest -q
```
