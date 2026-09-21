# Dukaan2Door Backend API (Member 1 - Tanisha)

Hyperlocal direct-delivery platform backend built with **FastAPI**, **Pydantic v2**, **SQLAlchemy**, and **Neon PostgreSQL**.

---

## Technical Stack & Configuration

- **Framework**: FastAPI (Python 3.11+)
- **Authentication**: JWT (JSON Web Tokens) with Bcrypt password hashing
- **Database**: Neon PostgreSQL (`sslmode=require`, `pool_pre_ping=True`)
- **Containerization**: Docker for Google Cloud Run (Listens on `${PORT:-8080}`)

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
