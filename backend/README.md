# Dukaan2Door Backend API

The Dukaan2Door backend is a FastAPI application for hyperlocal ordering and direct delivery. It integrates authentication, role-based access, product and inventory management, automatic store matching, order lifecycle management, delivery assignment, OSRM routing, delivery tracking, and WebSocket-based real-time updates.

## Stack

- **Framework**: FastAPI, Pydantic v2
- **Database**: PostgreSQL on Neon
- **ORM and migrations**: SQLAlchemy, Alembic
- **Authentication**: JWT access tokens with bcrypt password hashing
- **Routing**: OpenStreetMap/OSRM through `OSRM_BASE_URL`
- **Real-time updates**: FastAPI WebSockets
- **Deployment target**: Render web service

## Configuration

Create `backend/.env` from `backend/.env.example` and provide environment-specific values.

Required variables:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS`
- `OSRM_BASE_URL`

Do not commit `.env`, database credentials, JWT secrets, Kaggle credentials, or raw datasets.

## Local Development

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Swagger documentation:

```text
http://localhost:8080/docs
```

Health check:

```text
GET /health
```

## Render Deployment

Recommended Render Web Service settings:

- **Root Directory**: `backend`
- **Environment**: Python
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Database**: Neon PostgreSQL through `DATABASE_URL`

Render supplies `PORT` at runtime. Do not hardcode the production port.

## Integrated Backend Architecture

```text
Customer
  |
  v
Product selection
  |
  v
Order request
  |
  v
Automatic store selection
  |
  v
Atomic inventory validation and decrement
  |
  v
Retailer processing
  |
  v
Delivery assignment
  |
  v
Pickup, routing, tracking, and completion
```

## Authentication and Authorization

Endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Supported roles:

- `customer`
- `retailer`
- `delivery_partner`

The backend validates JWT tokens, loads the current user from the database, and applies role-based and object-level authorization checks across orders, deliveries, tracking, and profile operations.

## Customer, Retailer, and Delivery Partner Profiles

Customer endpoints:

- `GET /api/customers/me`
- `PUT /api/customers/me`

Retailer and store endpoints:

- `GET /api/retailers/me`
- `PUT /api/retailers/me`
- `GET /api/retailers/me/store`
- `PUT /api/retailers/me/store`
- `GET /api/retailers/me/products`

Delivery partner endpoints:

- `GET /api/delivery-partners/me`
- `PUT /api/delivery-partners/me`

Profile records store the location fields used by matching and delivery assignment where applicable.

## Products and Inventory

Endpoints:

- `GET /api/products`
- `GET /api/products/search`
- `GET /api/products/{product_id}`
- `POST /api/products`
- `PUT /api/products/{product_id}`
- `DELETE /api/products/{product_id}`
- `PATCH /api/products/{product_id}/availability`

Products belong to stores. Inventory records connect products to stores and store the available quantity plus availability flag.

## Intelligent Store Matching

Order creation uses the backend's store-matching service as the authoritative store-selection mechanism.

Matching behavior:

- Uses explicit order coordinates when provided.
- Falls back to saved customer coordinates when order coordinates are omitted.
- Rejects missing, invalid, or non-finite coordinates.
- Searches eligible stores within 2 km first.
- Expands to 5 km only when no eligible store is found within 2 km.
- Requires the store to be open and have valid coordinates.
- Requires every requested product to belong to the same candidate store.
- Requires products to be active.
- Requires inventory to exist, be available, and have sufficient quantity.
- Selects deterministically by shortest Haversine distance, then lowest store ID.
- Fails clearly when no eligible store exists within 5 km.

## Orders

Endpoints:

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/{order_id}`
- `PATCH /api/orders/{order_id}/status`
- `PUT /api/orders/{order_id}`
- `GET /api/orders/{order_id}/status`

Order lifecycle:

```text
RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
```

Additional terminal statuses:

- `REJECTED`
- `CANCELLED`

During order creation, the selected store is determined through matching. The final transaction locks matching inventory rows with `with_for_update()`, rechecks stock, decrements inventory, creates the order, and creates order items atomically.

## Deliveries and Tracking

Endpoints:

- `POST /api/deliveries/{order_id}/assign`
- `GET /api/deliveries/{delivery_id}`
- `PATCH /api/deliveries/{delivery_id}/status`
- `POST /api/deliveries/{delivery_id}/location`
- `GET /api/deliveries/{delivery_id}/route`
- `GET /api/deliveries/{delivery_id}/tracking`

Delivery assignment requires the order to be `READY_FOR_PICKUP`. The nearest available delivery partner with valid coordinates is selected deterministically by distance, then delivery partner ID. Duplicate delivery assignments are prevented.

Delivery status flow:

```text
ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
```

Cancellation is supported from the assigned state. Partner availability is set to unavailable on assignment and restored when a delivery completes or is cancelled.

Location updates validate coordinates, update the delivery partner's current location, and append a `delivery_tracking` history record.

## Routing and Maps

The route endpoint calls OSRM using `OSRM_BASE_URL`. It returns pickup coordinates, destination coordinates, route distance, duration, and geometry when OSRM provides it.

The backend does not use Google Maps or paid mapping APIs.

## WebSockets

Endpoint:

```text
WebSocket /api/ws/deliveries/{delivery_id}?token=<JWT>
```

Events:

- `delivery_assigned`
- `delivery_status_updated`
- `delivery_location_updated`
- `delivery_completed`

The WebSocket connection authenticates the JWT and checks delivery access before accepting. Broadcasting currently uses in-memory connection management and is suitable for a single Render service instance. Multi-instance deployment would require shared pub/sub infrastructure.

## Database and Migrations

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

Staging tables preserve real source-data provenance and remain separate from operational application tables.

## Testing

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

Test coverage includes authentication, authorization, coordinate validation, 2 km matching, 5 km fallback, inventory-aware matching, order creation, inventory decrement behavior, delivery assignment, delivery state transitions, routing failures, WebSockets, tracking authorization, saved-location fallback, delivery partner availability, and full lifecycle completion.
