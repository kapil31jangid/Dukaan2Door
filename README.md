# Dukaan2Door

Dukaan2Door is a hyperlocal e-commerce and direct-delivery backend for local retailers. The system supports customer ordering, automatic nearby-store selection, retailer order processing, delivery assignment, OSRM-based routing, delivery tracking, and WebSocket-based real-time updates.

## Backend Architecture

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
|-- Delivery Partner Management
|-- Delivery Lifecycle Management
|-- Geographic Distance Services
|-- OSRM Routing Services
|-- Real-Time Tracking
|-- WebSocket Events
|-- Database Models and Migrations
|-- Dataset Ingestion and Staging
`-- Testing and Deployment Readiness
```

## Technology Stack

- **Backend**: Python, FastAPI, Pydantic v2
- **Database**: PostgreSQL on Neon
- **ORM and migrations**: SQLAlchemy, Alembic
- **Authentication**: JWT with bcrypt password hashing
- **Routing**: OpenStreetMap/OSRM
- **Real-time updates**: FastAPI WebSockets
- **Deployment target**: Render web service

## Core Workflow

```text
Customer Order
  -> Automatic Store Selection
  -> Inventory Validation
  -> Retailer Preparation
  -> Delivery Assignment
  -> Store Pickup
  -> Route Navigation
  -> Customer Delivery
  -> Order Completion
```

## Backend Capabilities

- Register and authenticate users with roles: `customer`, `retailer`, and `delivery_partner`.
- Manage customer profiles, retailer/store profiles, delivery partner profiles, products, and inventory.
- Create orders through the automatic store-matching workflow.
- Search first within 2 km, then expand to 5 km when no eligible store exists.
- Select stores deterministically by shortest Haversine distance, then lowest store ID.
- Recheck and lock inventory during order creation before decrementing stock.
- Enforce order status transitions: `RECEIVED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`, `CANCELLED`.
- Assign the nearest available delivery partner with valid coordinates.
- Track delivery status and location history.
- Calculate routes through OSRM using pickup and destination coordinates.
- Broadcast delivery events over authenticated WebSocket connections.

## Data Model

Operational tables include:

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

Dataset staging tables include:

- `source_datasets`
- `source_products`
- `source_inventory`
- `source_orders`
- `source_order_items`

Source dataset records are kept separate from operational application records. External datasets are not converted into operational stores, customers, delivery partners, or coordinates when the source data does not provide those fields.

## Neon Operational Readiness

The live Neon database is aligned with the current SQLAlchemy models and Alembic head `20260922_0002`. Existing rows were preserved during schema alignment; legacy source/staging tables remain separate from operational tables.

The repository includes scripts for controlled demo readiness:

```bash
python scripts/seed_operational_demo.py
python scripts/verify_neon_demo_workflow.py
```

The seed script creates fictional operational demo accounts, stores, products, inventory, customers, and delivery partners. The verification script creates orders through the API and exercises store matching, inventory decrement, delivery assignment, delivery state transitions, and tracking against Neon.

## Local Backend Setup

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

API documentation is available at:

```text
http://localhost:8080/docs
```

## Tests

```bash
python -m compileall -q backend/app backend/tests scripts
cd backend
python -m pytest -q
```

Current verified result:

```text
39 passed
```

## Deployment

The backend is compatible with Render using:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required environment variables include:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS`
- `OSRM_BASE_URL`

Render supplies `PORT` at runtime. Do not commit `.env` or production credentials.

## Documentation

- [Backend Architecture & Services](docs/backend-architecture.md)
- [Backend Completion Report](docs/backend-completion-report.md)
- [Neon Operational Readiness](docs/neon-operational-readiness.md)
- [Data Ingestion](docs/data-ingestion.md)
- [Data Assets](data/README.md)
