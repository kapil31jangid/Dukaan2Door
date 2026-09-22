# Backend Architecture & Services

The Dukaan2Door backend is an integrated FastAPI system for hyperlocal ordering, inventory-aware store selection, delivery assignment, routing, live tracking, and completion of customer deliveries.

## System Architecture

```text
Dukaan2Door Backend
|
|-- Authentication & Authorization
|-- User and Role Management
|-- Customer Management
|-- Retailer and Store Management
|-- Product and Inventory Management
|-- Intelligent Store Matching
|-- Order Management
|-- Delivery Management
|-- Geographic Services
|-- Routing Services
|-- Real-Time Tracking
|-- WebSocket Events
|-- Database and Migrations
|-- Dataset Ingestion
`-- Testing and Deployment
```

## Request Flow

```text
Customer
  |
  v
POST /api/orders
  |
  v
Automatic store selection
  |
  +-- 2 km eligible store search
  |
  +-- 5 km fallback when no 2 km match exists
  |
  v
Atomic order creation and inventory decrement
  |
  v
Retailer processing
  |
  v
Delivery assignment
  |
  v
Routing, tracking, and WebSocket updates
```

## Authentication and Authorization

The backend uses JWT authentication and role-based access control. Tokens contain the authenticated user identity and role. Protected endpoints load the current user from the database and enforce both role-level and object-level access checks.

Supported roles:

- `customer`
- `retailer`
- `delivery_partner`

Access rules:

- Customers can manage their own profile, create orders, and view their own orders, deliveries, routes, and tracking history.
- Retailers can manage their own store, products, inventory, and store orders.
- Delivery partners can view and update only their assigned deliveries and location updates.

## Intelligent Store Matching

`app.services.store_matching_service.find_matching_store` accepts customer/order coordinates and requested product quantities.

The store matching service is authoritative for selecting the store during order creation. `POST /api/orders` must not bypass matching by trusting product-owned `store_id` values as the store-selection decision.

Coordinate source:

1. explicit `delivery_lat` and `delivery_lng` in the order request
2. saved customer `lat` and `lng`
3. `400 Bad Request` if no valid coordinates are available

Eligibility rules:

- store is open
- store has valid latitude and longitude
- store is inside the active radius
- every requested product belongs to the candidate store
- every requested product is active
- inventory exists for every requested product
- inventory is available
- inventory quantity is sufficient for the requested quantity

Search behavior:

1. Search eligible stores within 2 km.
2. If no eligible store exists within 2 km, search within 5 km.
3. If no eligible store exists within 5 km, reject order creation with a clear no-store response.

Selection rule:

1. shortest Haversine distance
2. lowest stable store ID as tie-breaker

No random selection is used.

## Order Management

Order creation integrates matching, inventory validation, and order item creation.

Lifecycle:

```text
RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
```

Additional terminal statuses:

- `REJECTED`
- `CANCELLED`

During order creation:

1. Request items are validated.
2. Customer/order coordinates are validated.
3. Store matching selects the fulfillment store.
4. Relevant inventory rows are locked with SQLAlchemy `with_for_update()`.
5. Availability and quantity are rechecked.
6. Inventory is decremented.
7. The order and order items are created atomically.

If any step fails, the transaction rolls back and partial orders/items are not preserved.

## Delivery Management

Delivery assignment is available after an order reaches `READY_FOR_PICKUP`.

Assignment behavior:

- order must exist
- order must belong to the retailer's store
- order must be `READY_FOR_PICKUP`
- order must not already have a delivery
- available delivery partners are considered
- partner coordinates must be valid
- nearest partner is selected by Haversine distance
- delivery partner ID is used as a deterministic tie-breaker
- no fake partners are created

Delivery status flow:

```text
ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
```

Cancellation is supported from `ASSIGNED`. Delivery status updates synchronize the related order status where appropriate, and partner availability is restored when delivery completes or is cancelled.

## Geographic Services

The backend validates coordinates before using them:

- latitude must be between `-90` and `90`
- longitude must be between `-180` and `180`
- missing, NaN, or infinite coordinate values are rejected

Distances are calculated with the Haversine formula and returned in kilometers.

## Routing

`app.services.routing_service.get_route` calls OSRM using `OSRM_BASE_URL` from settings.

The route endpoint returns:

- pickup coordinates
- destination coordinates
- distance in kilometers
- duration in minutes
- route geometry when OSRM provides it

Timeouts, HTTP failures, missing routes, and invalid OSRM payloads return `503 Service Unavailable`.

The backend uses OpenStreetMap/OSRM and does not use Google Maps or paid mapping APIs.

## Tracking

Delivery partner location updates:

1. validate latitude and longitude
2. update the delivery partner's current location
3. insert a `delivery_tracking` history record
4. broadcast a WebSocket event to active subscribers

Historical tracking rows are append-only. Current location belongs to the delivery partner profile; historical points belong to `delivery_tracking`.

## WebSocket Events

Clients connect to:

```text
/api/ws/deliveries/{delivery_id}?token=<JWT>
```

The socket validates the JWT and checks delivery access before accepting.

Events:

- `delivery_assigned`
- `delivery_location_updated`
- `delivery_status_updated`
- `delivery_completed`

Real-time WebSocket broadcasting currently uses in-memory connection management and is suitable for a single Render service instance. A multi-instance deployment would require shared pub/sub infrastructure.

## Database

Operational entities:

- `users`
- `customers`
- `retailers`
- `stores`
- `products`
- `inventory`
- `orders`
- `order_items`
- `delivery_partners`
- `deliveries`
- `delivery_tracking`

Dataset staging entities:

- `source_datasets`
- `source_products`
- `source_inventory`
- `source_orders`
- `source_order_items`

The staging tables preserve real source-data provenance while keeping external data separate from operational application records.

## APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/customers/me`
- `PUT /api/customers/me`
- `GET /api/retailers/me`
- `PUT /api/retailers/me`
- `GET /api/retailers/me/store`
- `PUT /api/retailers/me/store`
- `GET /api/retailers/me/products`
- `GET /api/delivery-partners/me`
- `PUT /api/delivery-partners/me`
- `GET /api/products`
- `GET /api/products/search`
- `GET /api/products/{product_id}`
- `POST /api/products`
- `PUT /api/products/{product_id}`
- `DELETE /api/products/{product_id}`
- `PATCH /api/products/{product_id}/availability`
- `POST /api/matching/store`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/{order_id}`
- `PATCH /api/orders/{order_id}/status`
- `GET /api/orders/{order_id}/status`
- `POST /api/deliveries/{order_id}/assign`
- `GET /api/deliveries/{delivery_id}`
- `PATCH /api/deliveries/{delivery_id}/status`
- `POST /api/deliveries/{delivery_id}/location`
- `GET /api/deliveries/{delivery_id}/route`
- `GET /api/deliveries/{delivery_id}/tracking`
- `WebSocket /api/ws/deliveries/{delivery_id}`

## Error Handling

- invalid coordinates: `400`
- unauthenticated request: `401`
- forbidden access: `403`
- missing resource or no eligible store: `404`
- inventory conflict or invalid state transition: `409`
- validation error: `422`
- unavailable routing service: `503`

## Testing

Tests verify:

- authentication and JWT handling
- role and object-level authorization
- coordinate validation
- Haversine distance calculation
- 2 km store matching
- 5 km fallback
- inventory-aware matching
- saved-location fallback
- order creation and inventory decrement
- no-decrement failure paths
- delivery assignment and duplicate prevention
- delivery status transitions
- delivery partner availability restoration
- OSRM success and failure handling
- delivery tracking history
- WebSocket authentication and events
- complete order-to-delivery lifecycle

Run:

```bash
python -m compileall -q backend/app backend/tests scripts
cd backend
python -m pytest -q
```

Current verified result:

```text
39 passed
```
