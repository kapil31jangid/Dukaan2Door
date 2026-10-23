# Dukaan2Door Documentation

This directory contains the current operational and validation documentation.
The repository code, Alembic migrations, and generated FastAPI OpenAPI schema
remain authoritative when implementation details change.

## Current Documents

| Document | Purpose |
|---|---|
| [Interactive runtime architecture](dukaan2door-architecture.html) | Explorable operational view of retailer and rider pools, backend route playback, persistence, and external dependencies. |
| [Architecture source](dukaan2door-architecture.json) | Archify source used to regenerate the interactive HTML. |
| [Deployment guide](deployment-guide.md) | Render, Neon, frontend, environment, OSRM, and production operations. |
| [Complete demo story](demo/dukaan2door-story-testing-guide.md) | Zero-to-running setup, user stories, pooling matrix, and eight-minute faculty script. |
| [Multi-retailer testing](demo/multi-retailer-testing-guide.md) | Three-store fan-out, decline, first-accept race, stock evidence, and isolation tests. |
| [Multi-rider testing](demo/multi-rider-testing-guide.md) | Three-rider fan-out, decline, first-claim race, eligibility, and tracking tests. |
| [Gemini demo readiness](gemini-demo-readiness.md) | Inventory analysis quota, fallback, privacy, and pre-demo checks. |
| [Live tracking validation](live-tracking-validation.md) | Two-device acceptance procedure for real browser GPS. |
| [Neon migration runbook](neon-migration-runbook.md) | Non-destructive migration, verification, and recovery procedure. |
| [Data ingestion](data-ingestion.md) | Source dataset staging, provenance, and catalog ingestion. |
| [Business model](business-model.md) | Commercial hypotheses, editable unit economics, canvas, and validation plan. |
| [Faculty feedback resolution](faculty-feedback-resolution.md) | Evidence and limitations for the eight faculty comments. |
| [IDT-I project report draft](report/IDT-I-Dukaan2Door-Report.md) | Editable report following the supplied IDT-I format, with project-specific content and submission placeholders. |
| [Complete workflow audit](audits/dukaan2door-complete-workflow-audit.md) | Verified customer-to-retailer-to-rider workflow and readiness verdict. |
| [API verification matrix](audits/api-verification-matrix.md) | Every implemented REST/WebSocket route and its evidence level. |
| [Database integrity report](audits/database-integrity-report.md) | PostgreSQL migration, locking, idempotency, and consistency evidence. |
| [Rider tracking verification](audits/rider-tracking-verification.md) | GPS, backend route playback, Mapbox, and reconnect verification. |
| [Faculty demo checklist](audits/faculty-demo-checklist.md) | Exact multi-session demo sequence and recovery checks. |
| [Shopkeeper survey](survey/shopkeeper-questionnaire.md) | Consent-ready local retailer questionnaire. |
| [Customer survey](survey/customer-questionnaire.md) | Consent-ready potential-customer questionnaire. |
| [Survey methodology](survey/survey-methodology.md) | Collection, privacy, cleaning, and analysis procedure. |
| [Survey results template](survey/survey-results-template.md) | Pending-results and product traceability template. |

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

Last repository validation: backend `122 passed, 1 PostgreSQL-only test
skipped`; that race test passed separately against disposable PostgreSQL 16.
Frontend `23 passed`, and the TypeScript/Vite production build passed. Re-run
these commands after code or dependency changes rather than treating these
recorded counts as permanent.

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Customer | `rahul@example.com` | `DemoPassword123!` |
| Retailer | `satellite.retailer.rahul@example.com` | `DemoPassword123!` |
| Retailer | `satellite.retailer.neha@example.com` | `DemoPassword123!` |
| Retailer | `satellite.retailer.priya@example.com` | `DemoPassword123!` |
| Delivery partner | `satellite.rider.rahul@example.com` | `DemoPassword123!` |
| Delivery partner | `satellite.rider.arjun.3km@example.com` | `DemoPassword123!` |
| Delivery partner | `satellite.rider.meera@example.com` | `DemoPassword123!` |

See the [Complete demo story](demo/dukaan2door-story-testing-guide.md) before
seeding or using remote demo data.
