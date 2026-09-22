# Dukaan2Door Backend API (Member 1 - Tanisha)

Hyperlocal direct-delivery platform backend built with **FastAPI**, **Pydantic v2**, **SQLAlchemy**, and **Neon PostgreSQL**.

---

## Technical Stack & Configuration

- **Framework**: FastAPI (Python 3.11+)
- **Authentication**: JWT (JSON Web Tokens) with Bcrypt password hashing
- **Database**: Neon PostgreSQL (`sslmode=require`, `pool_pre_ping=True`)
- **Backend Deployment Target**: Render Web Service
- **Containerization**: Optional Docker support for local/containerized runs

---

## Current Readiness Status

Backend 2 implementation must not begin until the shared database and Backend 1 foundations are confirmed.

Known blockers:
- No `app/models/` package exists yet.
- No SQLAlchemy declarative `Base` exists yet.
- No SQLAlchemy ORM models exist yet.
- No Alembic configuration or migrations exist yet.
- No confirmed database schema source of truth exists in this repository.
- Authentication, product, profile, and order APIs currently return stubbed/sample data.
- Delivery and delivery tracking persistence does not exist yet.

Team ownership:
- **Database Member** owns SQLAlchemy models, schema, relationships, Alembic migrations, and database integrity.
- **Backend Member 1** owns authentication, users, products, orders, and related APIs.
- **Backend Member 2** owns store matching, delivery assignment, delivery workflow, routing, tracking, and WebSockets after the required foundations are ready.

Backend 2 must reuse the confirmed models, migrations, auth dependencies, and order status flow instead of creating duplicate systems.

---

## Local Development & Setup

### 1. Environment Setup
Copy `.env.example` to `.env` and provide your secrets:
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run FastAPI Dev Server
```bash
uvicorn app.main:app --reload --port 8080
```
Interactive API Swagger Documentation will be available at: [http://localhost:8080/docs](http://localhost:8080/docs)

### 4. Run Test Suite
```bash
pytest
```

---

## Render Deployment

Render is the intended backend deployment platform. The backend should remain a standard FastAPI application and must not depend on provider-specific SDKs, environment variables, or deployment commands.

Recommended Render Web Service settings:
- **Root Directory**: `backend`
- **Environment**: Python
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Database**: Neon PostgreSQL via `DATABASE_URL`

Required Render environment variables:
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS`
- `OSRM_BASE_URL`

Render supplies `PORT` at runtime, so do not hardcode the production port and do not put `PORT` in `.env.example`.

Docker may remain useful for local/containerized development. It is not a requirement for Render deployment.

---

## Backend 2 Implementation Plan After Blockers

Backend 2 will implement these modules only after the Database Member and Backend Member 1 foundations are merged:

1. **Automatic Store Matching**
   - Use customer location and requested order items.
   - Search eligible stores within 2 km.
   - Check confirmed inventory/product availability tables.
   - Select a deterministic eligible store.
   - Expand to 5 km if no eligible store exists within 2 km.
   - Return a clear no-store-available response if no eligible store exists within 5 km.

2. **Delivery Assignment**
   - Use real orders and confirmed delivery schema.
   - Assign available delivery partners to eligible orders.
   - Prevent duplicate active assignments.
   - Preserve the existing order status enum and transition rules unless a concrete issue is found.

3. **Delivery Workflow**
   - Support ready-for-pickup, assigned, picked-up/out-for-delivery, and delivered states through the confirmed order/delivery contract.

4. **Routing**
   - Use OpenStreetMap/OSRM.
   - Keep routing behind a service abstraction using `OSRM_BASE_URL`.
   - Do not introduce paid map APIs.

5. **Real-Time Tracking**
   - Use FastAPI WebSockets where appropriate.
   - Start with an in-process WebSocket manager.
   - Do not add Redis or other infrastructure unless the need is demonstrated.

Expected Backend 2 files after readiness:
- `app/services/store_matching_service.py`
- `app/services/delivery_assignment_service.py`
- `app/services/routing_service.py`
- `app/routers/deliveries.py`
- `app/websocket/manager.py`
- `app/websocket/tracking.py`
- `app/schemas/delivery.py`
- focused tests for matching, delivery assignment, routing, authorization, and tracking

---

## Readiness Checklist

DATABASE:
- [ ] SQLAlchemy Base
- [ ] SQLAlchemy models
- [ ] Relationships
- [ ] Alembic
- [ ] Initial migration
- [ ] Neon compatibility

BACKEND 1:
- [ ] Real registration
- [ ] Real login
- [ ] Password hashing
- [ ] JWT
- [ ] Current user
- [ ] Role authorization
- [ ] Real product persistence
- [ ] Real order persistence

BACKEND 2 DEPENDENCIES:
- [ ] Store schema confirmed
- [ ] Inventory schema confirmed
- [ ] Order schema confirmed
- [ ] Delivery schema confirmed
- [ ] Delivery tracking schema confirmed
- [ ] Location fields confirmed

DEPLOYMENT:
- [ ] Old deployment platform references removed or updated
- [ ] Render configuration
- [ ] Render environment variables
- [ ] Neon DATABASE_URL
- [ ] Production start command
- [ ] CORS configuration
- [ ] WebSocket deployment compatibility

Current status: **NOT READY — WAIT FOR DATABASE/BACKEND 1**

---

## Complete API Reference (For Frontend Integration)

### 1. Authentication Endpoints

#### `POST /api/auth/register`
- **Role Required**: Public
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "SecretPassword123",
  "role": "customer",
  "name": "Jane Doe",
  "phone": "9876543210",
  "delivery_address": "123 Green Avenue",
  "lat": 28.6139,
  "lng": 77.2090
}
```
- **Response** `201 Created`:
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer",
  "role": "customer",
  "user_id": 1
}
```

#### `POST /api/auth/login`
- **Role Required**: Public
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "SecretPassword123"
}
```
- **Response** `200 OK`:
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer",
  "role": "customer",
  "user_id": 1
}
```

#### `GET /api/auth/me`
- **Role Required**: Authenticated (Any role)
- **Response** `200 OK`:
```json
{
  "user_id": 1,
  "email": "customer@example.com",
  "role": "customer",
  "name": "Jane Doe"
}
```

---

### 2. User & Profile Endpoints

#### `GET /api/customers/me`
- **Role Required**: `customer`
- **Response** `200 OK`:
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Jane Doe",
  "phone": "9876543210",
  "delivery_address": "123 Green Avenue",
  "lat": 28.6139,
  "lng": 77.2090
}
```

#### `PUT /api/customers/me`
- **Role Required**: `customer`
- **Request Body**: (all fields optional)
```json
{
  "delivery_address": "456 Park Street",
  "lat": 28.6150,
  "lng": 77.2100
}
```

#### `GET /api/retailers/me`
- **Role Required**: `retailer`

#### `PUT /api/retailers/me`
- **Role Required**: `retailer`

#### `GET /api/retailers/me/store`
- **Role Required**: `retailer`
- **Response** `200 OK`:
```json
{
  "id": 1,
  "retailer_id": 1,
  "store_name": "Fresh Mart",
  "address": "456 Market Lane",
  "lat": 28.6150,
  "lng": 77.2100,
  "operating_hours": "08:00 - 22:00",
  "is_open": true
}
```

#### `PUT /api/retailers/me/store`
- **Role Required**: `retailer`
- **Request Body**:
```json
{
  "is_open": false
}
```

#### `GET /api/delivery-partners/me`
- **Role Required**: `delivery_partner`

#### `PUT /api/delivery-partners/me`
- **Role Required**: `delivery_partner`
- **Request Body**:
```json
{
  "vehicle_info": "Hero Splendor DL-02-CD-5678",
  "is_available": true
}
```

---

### 3. Product Catalog & Inventory Endpoints

#### `GET /api/products`
- **Role Required**: Public / Customer
- **Query Params**: `category` (optional), `page` (default 1), `page_size` (default 20)

#### `GET /api/products/search`
- **Role Required**: Public / Customer
- **Query Params**: `q` (required, case-insensitive string), `category` (optional), `page`, `page_size`

#### `GET /api/products/{id}`
- **Role Required**: Public / Customer

#### `POST /api/products`
- **Role Required**: `retailer`
- **Request Body**:
```json
{
  "name": "Fresh Organic Milk 1L",
  "description": "Pure pasteurized whole milk",
  "category": "Dairy",
  "price": 65.00,
  "initial_stock": 50,
  "is_available": true
}
```

#### `PUT /api/products/{id}`
- **Role Required**: `retailer` (own store's product)

#### `DELETE /api/products/{id}`
- **Role Required**: `retailer` (own store's product) - Soft deletes product (`is_active=false`).

#### `PATCH /api/products/{id}/availability`
- **Role Required**: `retailer` (own store's product)
- **Request Body**:
```json
{
  "is_available": true,
  "quantity": 30
}
```

---

### 4. Order Management & Lifecycle Endpoints

#### `POST /api/orders`
- **Role Required**: `customer`
- **Request Body**:
```json
{
  "items": [
    {"product_id": 1, "quantity": 2},
    {"product_id": 4, "quantity": 1}
  ],
  "delivery_address": "123 Green Avenue",
  "delivery_lat": 28.6139,
  "delivery_lng": 77.2090,
  "notes": "Please leave at gate"
}
```

#### `GET /api/orders`
- **Role Required**: Authenticated (`customer`, `retailer`, `delivery_partner`)
- **Query Params**: `status` (optional filter, e.g. `RECEIVED`), `page`, `page_size`

#### `GET /api/orders/{id}`
- **Role Required**: Customer (owner), Retailer (store owner), Delivery Partner (assigned), or Admin.

#### `PATCH /api/orders/{id}/status`
- **Role Required**: Authorized role based on lifecycle transition
- **Lifecycle Transition Rules**:
  - `RECEIVED` → `ACCEPTED` | `REJECTED` | `CANCELLED`
  - `ACCEPTED` → `PREPARING` | `CANCELLED`
  - `PREPARING` → `READY_FOR_PICKUP`
  - `READY_FOR_PICKUP` → `OUT_FOR_DELIVERY`
  - `OUT_FOR_DELIVERY` → `DELIVERED`
- **Request Body**:
```json
{
  "status": "ACCEPTED"
}
```

#### `GET /api/orders/{id}/status`
- **Role Required**: Authenticated
- **Response** `200 OK`:
```json
{
  "order_id": 1,
  "current_status": "RECEIVED",
  "updated_at": "2026-09-21T22:00:00Z",
  "history": [
    {
      "status": "RECEIVED",
      "timestamp": "2026-09-21T22:00:00Z",
      "note": "Order received by platform"
    }
  ]
}
```
