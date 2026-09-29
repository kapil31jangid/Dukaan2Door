# Dukaan2Door Documentation Hub

Welcome to the comprehensive technical documentation for **Dukaan2Door**, the hyperlocal direct delivery platform for local retailers.

---

## 📚 Core Documentation Index

| Document | Description |
|---|---|
| 🗺️ [Architecture & Backend Services](backend-architecture.md) | High-level system architecture, service breakdown, state machines, and lifecycle rules. |
| 💻 [Frontend Architecture](frontend-architecture.md) | 3-Portal UI design (Customer, Retailer, Delivery), state management, Leaflet/OSM maps, and geolocation. |
| 🔌 [API Reference & WebSockets](api-reference.md) | Comprehensive REST API specifications, request/response models, status codes, and WebSocket events. |
| 🗄️ [Database Schema & ERD](database-schema.md) | PostgreSQL table structures, foreign key constraints, indexes, data types, and Alembic migrations. |
| 🚀 [Deployment & Operations Guide](deployment-guide.md) | Step-by-step production deployment instructions for Render, Neon PostgreSQL, Vercel, and OSRM. |
| 🧪 [Testing & Verification Guide](testing-guide.md) | Manual parallel browser test walkthroughs across Customer, Retailer, and Delivery Partner windows. |
| 👥 [Testing Users & Story Walkthrough](testing-users-and-flow.md) | Demo account credentials, test cases, and automated API story execution (`run_story.py`). |
| 📊 [Data Ingestion Pipeline](data-ingestion.md) | External dataset staging, Kirana catalog normalization, provenance tracking, and data cleaning scripts. |
| ⚡ [Neon Operational Readiness](neon-operational-readiness.md) | Serverless Postgres configuration, connection pooling, scaling rules, and database branching. |
| 📝 [Backend Completion Report](backend-completion-report.md) | Historical verification audit and backend service compliance report. |

---

## ⚡ Quick Links & Cheatsheet

### Local Service Launch
```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Run Tests & Validation
```bash
# Backend pytest suite (40 tests)
cd backend && python -m pytest -q

# Run end-to-end automated story
python scripts/run_story.py
```

### Demo Accounts
- **Customer**: `rahul@example.com` / `DemoPassword123!`
- **Retailer**: `satellite.retailer.rahul@example.com` / `DemoPassword123!`
- **Delivery Partner**: `satellite.rider.arjun.3km@example.com` / `DemoPassword123!`
