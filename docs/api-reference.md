# Dukaan2Door API Reference

Complete documentation for the Dukaan2Door REST API and WebSocket interfaces.

- **Base URL**: `http://localhost:8080/api/v1` (or production host)
- **Interactive Swagger UI**: `http://localhost:8080/docs`
- **Interactive ReDoc UI**: `http://localhost:8080/redoc`
- **Authentication**: Bearer Token via HTTP Header: `Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents

- [Authentication & Users](#authentication--users)
- [Customer Profiles](#customer-profiles)
- [Retailer & Store Management](#retailer--store-management)
- [Product Catalog & Inventory](#product-catalog--inventory)
- [Store Matching](#store-matching)
- [Order Lifecycle](#order-lifecycle)
- [Delivery Dispatch & Tracking](#delivery-dispatch--tracking)
- [Delivery Partner Management](#delivery-partner-management)
- [File Uploads](#file-uploads)
- [Real-Time WebSocket API](#real-time-websocket-api)
- [Standard Error Codes](#standard-error-codes)

---

## Authentication & Users

### 1. Register User
`POST /api/v1/auth/register`

Creates a new user account and associated role profile (`customer`, `retailer`, or `delivery_partner`).

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "role": "customer",
  "full_name": "Rahul Sharma",
  "phone": "+919876543210",
  "address": "101 Galaxy Apts, Satellite, Ahmedabad",
  "latitude": 23.0305,
  "longitude": 72.5178
}
```

#### Response `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "customer",
  "is_active": true,
  "created_at": "2026-09-30T00:00:00Z"
}
```

---

### 2. Login
`POST /api/v1/auth/login`

Authenticates credentials and returns a JWT access token. Accepts standard OAuth2 password request (`application/x-www-form-urlencoded`) or JSON body.

#### Request Body (`application/x-www-form-urlencoded` or JSON)
```json
{
  "username": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Response `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "role": "customer",
  "user_id": 1
}
```

---

### 3. Get Current User Profile
`GET /api/v1/auth/me`

Retrieves authenticated user details and active role attributes. Requires `Authorization: Bearer <token>`.

#### Response `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "customer",
  "is_active": true,
  "profile": {
    "id": 1,
    "full_name": "Rahul Sharma",
    "phone": "+919876543210",
    "address": "101 Galaxy Apts, Satellite, Ahmedabad",
    "latitude": 23.0305,
    "longitude": 72.5178
  }
}
```

---

## Customer Profiles

### 1. Get Customer Details
`GET /api/v1/customers/me`

#### Response `200 OK`
```json
{
  "id": 1,
  "user_id": 1,
  "full_name": "Rahul Sharma",
  "phone": "+919876543210",
  "address": "101 Galaxy Apts, Satellite",
  "latitude": 23.0305,
  "longitude": 72.5178
}
```

### 2. Update Customer Profile & Location
`PUT /api/v1/customers/me`

#### Request Body
```json
{
  "full_name": "Rahul Sharma",
  "phone": "+919876543210",
  "address": "204 Sunrise Towers, Bodakdev",
  "latitude": 23.0384,
  "longitude": 72.5120
}
```

---

## Retailer & Store Management

### 1. Get Retailer Profile & Store
`GET /api/v1/retailers/me`

#### Response `200 OK`
```json
{
  "id": 1,
  "user_id": 2,
  "business_name": "Apna Kirana Mart",
  "phone": "+919811223344",
  "store": {
    "id": 1,
    "name": "Apna Kirana Mart - Satellite Branch",
    "address": "Shop 4, Prernatirth Derasar Road, Satellite",
    "latitude": 23.0289,
    "longitude": 72.5184,
    "is_open": true,
    "delivery_radius_km": 5.0,
    "created_at": "2026-09-01T10:00:00Z"
  }
}
```

### 2. Update Store Status / Coordinates
`PUT /api/v1/retailers/me/store`

```json
{
  "name": "Apna Kirana Mart - Satellite",
  "address": "Shop 4, Prernatirth Derasar Road, Satellite",
  "latitude": 23.0289,
  "longitude": 72.5184,
  "is_open": true,
  "delivery_radius_km": 5.0
}
```

---

## Product Catalog & Inventory

### 1. List Products
`GET /api/v1/products`

Query Parameters:
- `category` (optional, string): Filter by category (e.g. `Dairy`, `Snacks`, `Vegetables`)
- `search` (optional, string): Case-insensitive keyword search
- `store_id` (optional, integer): Filter to a specific store's inventory
- `available_only` (optional, boolean, default `true`): Only return products in stock

#### Response `200 OK`
```json
[
  {
    "id": 101,
    "name": "Amul Taaza Toned Milk",
    "description": "Fresh pasteurized toned milk 500ml",
    "category": "Dairy",
    "price": 27.0,
    "image_url": "/uploads/amul_taaza.png",
    "unit": "500 ml",
    "is_available": true,
    "store_id": 1,
    "stock_quantity": 45
  }
]
```

### 2. Create Product (Retailer Only)
`POST /api/v1/products`

```json
{
  "name": "Fortune Sunlite Sunflower Oil",
  "description": "Refined sunflower oil 1L pouch",
  "category": "Edible Oils",
  "price": 145.0,
  "unit": "1 L",
  "image_url": "/uploads/sunflower_oil.png",
  "initial_stock": 25
}
```

### 3. Update Product Stock / Availability
`PATCH /api/v1/products/{product_id}/availability`

```json
{
  "is_available": true,
  "stock_quantity": 30
}
```

---

## Store Matching

### 1. Query Eligible Store
`POST /api/v1/matching/store`

Finds the nearest open store that carries all requested items in required quantities.

#### Request Body
```json
{
  "customer_lat": 23.0305,
  "customer_lng": 72.5178,
  "items": [
    { "product_id": 101, "quantity": 2 },
    { "product_id": 104, "quantity": 1 }
  ]
}
```

#### Response `200 OK`
```json
{
  "matched": true,
  "store": {
    "id": 1,
    "name": "Apna Kirana Mart - Satellite Branch",
    "address": "Shop 4, Prernatirth Road",
    "latitude": 23.0289,
    "longitude": 72.5184,
    "distance_km": 0.21,
    "is_within_primary_radius": true
  }
}
```

---

## Order Lifecycle

### Order State Machine Transitions

```
RECEIVED  ──►  ACCEPTED  ──►  PREPARING  ──►  READY_FOR_PICKUP  ──►  ASSIGNED
                                                                         │
                                                                         ▼
DELIVERED  ◄──  OUT_FOR_DELIVERY  ◄──  PICKED_UP  ◄──────────────────────┘
```

Terminal states: `REJECTED`, `CANCELLED`.

---

### 1. Create Order
`POST /api/v1/orders`

Places a new order. Triggers automatic store matching and atomic inventory locking with `with_for_update()`.

#### Request Body
```json
{
  "delivery_lat": 23.0305,
  "delivery_lng": 72.5178,
  "delivery_address": "Flat 101, Galaxy Apts, Satellite, Ahmedabad",
  "payment_method": "COD",
  "notes": "Please leave at door if no answer",
  "items": [
    { "product_id": 101, "quantity": 2 },
    { "product_id": 104, "quantity": 1 }
  ]
}
```

#### Response `201 Created`
```json
{
  "id": 501,
  "customer_id": 1,
  "store_id": 1,
  "status": "RECEIVED",
  "total_amount": 199.0,
  "delivery_address": "Flat 101, Galaxy Apts, Satellite, Ahmedabad",
  "delivery_lat": 23.0305,
  "delivery_lng": 72.5178,
  "payment_method": "COD",
  "created_at": "2026-09-30T00:30:00Z",
  "items": [
    {
      "id": 1201,
      "product_id": 101,
      "product_name": "Amul Taaza Toned Milk",
      "unit_price": 27.0,
      "quantity": 2,
      "subtotal": 54.0
    }
  ]
}
```

---

### 2. Update Order Status
`PATCH /api/v1/orders/{order_id}/status`

Enforces strict lifecycle state machine rules.

#### Request Body
```json
{
  "status": "ACCEPTED"
}
```

#### Valid Transitions
| Current Status | Allowed Target Statuses | Authorized Roles |
|---|---|---|
| `RECEIVED` | `ACCEPTED`, `REJECTED` | `retailer` |
| `ACCEPTED` | `PREPARING`, `CANCELLED` | `retailer` |
| `PREPARING` | `READY_FOR_PICKUP` | `retailer` |
| `READY_FOR_PICKUP` | `ASSIGNED` | `retailer`, `delivery_partner` |
| `ASSIGNED` | `PICKED_UP`, `CANCELLED` | `delivery_partner`, `retailer` |
| `PICKED_UP` | `OUT_FOR_DELIVERY` | `delivery_partner` |
| `OUT_FOR_DELIVERY` | `DELIVERED` | `delivery_partner` |

---

### 3. Get Order Status & Tracking Summary
`GET /api/v1/orders/{order_id}/status`

Provides full tracking telemetry including store details, delivery partner location, and progress milestones.

#### Response `200 OK`
```json
{
  "order_id": 501,
  "status": "OUT_FOR_DELIVERY",
  "created_at": "2026-09-30T00:30:00Z",
  "store": {
    "id": 1,
    "name": "Apna Kirana Mart",
    "address": "Shop 4, Prernatirth Road",
    "latitude": 23.0289,
    "longitude": 72.5184
  },
  "delivery_partner": {
    "id": 12,
    "name": "Arjun Patel",
    "phone": "+919988776655",
    "vehicle_type": "Electric Scooter",
    "current_lat": 23.0298,
    "current_lng": 72.5180
  },
  "route": {
    "distance_km": 0.42,
    "duration_minutes": 2.5,
    "geometry": "polyline_or_geojson_coordinates"
  }
}
```

---

## Delivery Dispatch & Tracking

### 1. Assign Delivery Partner to Order
`POST /api/v1/deliveries/{order_id}/assign`

Assigns an available rider or selects the nearest partner automatically if `partner_id` is omitted.

#### Request Body (Optional parameter)
```json
{
  "partner_id": 12
}
```

#### Response `200 OK`
```json
{
  "delivery_id": 801,
  "order_id": 501,
  "delivery_partner_id": 12,
  "status": "ASSIGNED",
  "assigned_at": "2026-09-30T00:35:00Z"
}
```

---

### 2. Broadcast Partner Location
`POST /api/v1/deliveries/{delivery_id}/location`

Broadcasts rider location, saves GPS breadcrumb to `delivery_tracking`, and notifies customer via WebSocket.

#### Request Body
```json
{
  "latitude": 23.0298,
  "longitude": 72.5180,
  "accuracy_meters": 4.5,
  "speed_kmh": 22.0
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "recorded_at": "2026-09-30T00:36:12Z"
}
```

---

### 3. Get OSRM Road Route
`GET /api/v1/deliveries/{delivery_id}/route`

Returns computed road-network waypoints, distance, and ETA calculated by OSRM.

#### Response `200 OK`
```json
{
  "pickup": { "lat": 23.0289, "lng": 72.5184 },
  "destination": { "lat": 23.0305, "lng": 72.5178 },
  "distance_km": 0.42,
  "duration_minutes": 2.5,
  "waypoints": [
    [72.5184, 23.0289],
    [72.5182, 23.0295],
    [72.5178, 23.0305]
  ]
}
```

---

## Delivery Partner Management

### 1. Get Available Orders for Pickup
`GET /api/v1/delivery-partners/available-orders`

Lists all orders in `READY_FOR_PICKUP` status awaiting rider acceptance.

### 2. Toggle Online Availability
`PATCH /api/v1/delivery-partners/me/availability`

```json
{
  "is_available": true
}
```

---

## File Uploads

### 1. Upload Product Image
`POST /api/v1/uploads/image`

Accepts `multipart/form-data` with key `file`. Supported types: `image/jpeg`, `image/png`, `image/webp`.

#### Response `201 Created`
```json
{
  "file_url": "/uploads/product_images/501_taaza.png",
  "filename": "501_taaza.png"
}
```

---

## Real-Time WebSocket API

### Connect to Delivery Live Feed
`ws://localhost:8080/ws/delivery/{order_id}?token=<JWT_TOKEN>`

Establishes a bidirectional WebSocket connection. Authorizes connection against the JWT token and verifies user permissions for the specified order.

#### Message Payload: Location Update
```json
{
  "event": "location_update",
  "data": {
    "order_id": 501,
    "delivery_id": 801,
    "partner_id": 12,
    "latitude": 23.0298,
    "longitude": 72.5180,
    "accuracy_meters": 4.5,
    "timestamp": "2026-09-30T00:36:12Z"
  }
}
```

#### Message Payload: Status Change
```json
{
  "event": "status_update",
  "data": {
    "order_id": 501,
    "status": "OUT_FOR_DELIVERY",
    "timestamp": "2026-09-30T00:36:00Z"
  }
}
```

---

## Standard Error Codes

| HTTP Status | Meaning | Typical Scenario |
|---|---|---|
| `400 Bad Request` | Malformed payload or invalid coordinates | Latitude out of `[-90, 90]` range |
| `401 Unauthorized` | Missing or expired JWT token | Authorization header missing |
| `403 Forbidden` | Insufficient role permissions | Customer trying to update inventory |
| `404 Not Found` | Resource does not exist | No matching store within 5 km |
| `409 Conflict` | State transition or inventory conflict | Stock exhausted during checkout |
| `422 Unprocessable` | Pydantic schema validation failure | Missing required field |
| `503 Service Unavailable` | External service unreachable | OSRM routing engine timeout |
