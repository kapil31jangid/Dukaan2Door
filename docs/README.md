# Dukaan2Door Documentation

This directory contains the current operational and validation documentation.
The repository code, Alembic migrations, and generated FastAPI OpenAPI schema
remain authoritative when implementation details change.

## Current Documents

| Document | Purpose |
|---|---|
| [Interactive runtime architecture](dukaan2door-architecture.html) | Explorable 12-component runtime view with the primary order path, external dependencies, and trust boundaries. |
| [Architecture source](dukaan2door-architecture.json) | Archify source used to regenerate the interactive HTML. |
| [Deployment guide](deployment-guide.md) | Render, Neon, frontend, environment, OSRM, and production operations. |
| [Testing guide](testing-guide.md) | Current three-portal manual workflow and automated validation commands. |
| [Testing users and flow](testing-users-and-flow.md) | Controlled demo accounts, seed commands, and end-to-end story. |
| [Gemini demo readiness](gemini-demo-readiness.md) | Inventory analysis quota, fallback, privacy, and pre-demo checks. |
| [Live tracking validation](live-tracking-validation.md) | Two-device acceptance procedure for real browser GPS. |
| [Rider GPS and routing](rider-gps-routing-fix.md) | Current GPS pipeline, route projection, freshness rules, and labelled demo playback. |
| [Neon migration runbook](neon-migration-runbook.md) | Non-destructive migration, verification, and recovery procedure. |
| [Data ingestion](data-ingestion.md) | Source dataset staging, provenance, and catalog ingestion. |

The current REST and WebSocket contract is available from FastAPI at
`http://localhost:8080/docs` while the backend is running. Database structure
is defined by `backend/app/models/` and `backend/alembic/versions/`; duplicated
static API and schema copies are intentionally not maintained here.

## Local Start

```bash
# Terminal 1
cd backend
source .venv/bin/activate
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080

# Terminal 2
cd frontend
npm install
npm run dev
```

## Validation

```bash
cd backend
python -m pytest -q

cd ../frontend
npm test
npm run build
```

Last repository validation: backend `104 passed`, frontend `12 passed`, and the
TypeScript/Vite production build passed. Re-run these commands after code or
dependency changes rather than treating these recorded counts as permanent.

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Customer | `rahul@example.com` | `DemoPassword123!` |
| Retailer | `satellite.retailer.rahul@example.com` | `DemoPassword123!` |
| Delivery partner | `satellite.rider.arjun.3km@example.com` | `DemoPassword123!` |

See [Testing users and flow](testing-users-and-flow.md) before seeding or using
remote demo data.
