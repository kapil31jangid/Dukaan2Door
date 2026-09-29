# Dukaan2Door Deployment & Operations Guide

Step-by-step instructions for deploying and running Dukaan2Door in production using **Neon PostgreSQL**, **Render / Docker** for the FastAPI backend, and **Vercel / Netlify / Nginx** for the React frontend.

---

## Table of Contents

- [Architecture & Hosting Overview](#architecture--hosting-overview)
- [Database Setup (Neon PostgreSQL)](#database-setup-neon-postgresql)
- [Backend Deployment (Render / Docker)](#backend-deployment-render--docker)
- [Frontend Deployment (Vercel / Static Hosting)](#frontend-deployment-vercel--static-hosting)
- [OSRM Routing Server Setup](#osrm-routing-server-setup)
- [Environment Variables Reference](#environment-variables-reference)
- [Production Health Checks & Monitoring](#production-health-checks--monitoring)
- [Backup & Disaster Recovery](#backup--disaster-recovery)

---

## Architecture & Hosting Overview

```
                      ┌────────────────────────────────────────┐
                      │             User Browsers              │
                      └───────────────────┬────────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼ (HTTPS)                                     ▼ (HTTPS & WSS)
    ┌─────────────────────────────┐               ┌─────────────────────────────┐
    │       Frontend SPA          │               │       FastAPI Backend       │
    │  (Vercel / Netlify / CDN)   │               │       (Render / Docker)     │
    └─────────────────────────────┘               └──────────────┬──────────────┘
                                                                 │
                                          ┌──────────────────────┼──────────────────────┐
                                          │                      │                      │
                                          ▼                      ▼                      ▼
                           ┌─────────────────────────────┐ ┌───────────┐ ┌───────────────────────────┐
                           │   PostgreSQL on Neon Cloud  │ │ OSRM Host │ │ OpenStreetMap Tile Server │
                           │ (Pooled & Direct Connection)│ │  (Docker) │ │     (OpenStreetMap.org)   │
                           └─────────────────────────────┘ └───────────┘ └───────────────────────────┘
```

---

## Database Setup (Neon PostgreSQL)

Dukaan2Door is designed for serverless PostgreSQL on [Neon](https://neon.tech/).

### 1. Create Database Project
1. Log into the Neon Console and create a new project named `dukaan2door`.
2. Select your closest region (e.g. `ap-southeast-1` or `eu-central-1`).
3. Neon will generate connection strings:
   - **Pooled connection string** (for standard queries): `postgresql://neondb_owner:***@ep-***-pooler.neon.tech/neondb?sslmode=require`
   - **Direct connection string** (for Alembic migrations): `postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require`

### 2. Run Database Migrations
Run Alembic migrations against your Neon database from your build pipeline or local machine:

```bash
export DATABASE_URL="postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require"
cd backend
python -m alembic upgrade head
```

### 3. Seed Initial Demo Stores & Catalog
```bash
python scripts/seed_dashboard_accounts.py --allow-remote
python scripts/seed_satellite_catalog.py --allow-remote
```

---

## Backend Deployment (Render / Docker)

### Option A: Render Web Service

1. Create a **New Web Service** on Render connected to your GitHub repository.
2. Set the following build settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt && python -m alembic upgrade head`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Configure Environment Variables in Render:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `JWT_SECRET_KEY`: A cryptographically secure random 64-character secret
   - `ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440` (24 hours)
   - `CORS_ORIGINS`: `https://your-frontend-domain.vercel.app,http://localhost:3000`
   - `OSRM_BASE_URL`: `https://router.project-osrm.org`

---

### Option B: Docker Container Deployment

Create a `Dockerfile` in the `backend/` directory:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["sh", "-c", "python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
```

Build and run:
```bash
docker build -t dukaan2door-backend ./backend
docker run -d -p 8080:8080 --env-file backend/.env dukaan2door-backend
```

---

## Frontend Deployment (Vercel / Static Hosting)

### Deploying to Vercel

1. Import your repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Vite**.
4. Configure Build and Output Settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Configure Environment Variables:
   - `VITE_API_BASE_URL`: `https://your-backend.onrender.com`
   - `VITE_MAPBOX_TOKEN`: *(Optional, for Mapbox rendering)*

### Single Page Application (SPA) Routing Rewrite (`vercel.json`)
Ensure all paths route to `index.html`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## OSRM Routing Server Setup

By default, Dukaan2Door connects to the public OSRM demonstration server (`https://router.project-osrm.org`). For dedicated production workloads with high request throughput, host a private OSRM container:

```bash
# 1. Download OpenStreetMap data for your region (e.g. India or Gujarat)
wget http://download.geofabrik.de/asia/india-latest.osm.pbf

# 2. Extract and process OSM graph
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/india-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/india-latest.osrm

# 3. Run the routing server
docker run -d -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/india-latest.osrm
```

Then update your backend environment variable:
```env
OSRM_BASE_URL=http://your-osrm-host:5000
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | - | PostgreSQL connection URI |
| `JWT_SECRET_KEY` | Yes | - | Secret string for HMAC-SHA256 JWT generation |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | Token lifetime |
| `CORS_ORIGINS` | Yes | `*` | Comma-separated allowed frontend domains |
| `OSRM_BASE_URL` | No | `https://router.project-osrm.org` | Road routing backend URL |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `http://localhost:8080` | Backend API endpoint |
| `VITE_MAPBOX_TOKEN` | No | - | Public Mapbox GL token if using Mapbox layers |

---

## Production Health Checks & Monitoring

- **Health Check Endpoint**: `GET /health` returns `{ "status": "healthy", "database": "connected" }`.
- **Uptime Monitoring**: Configure an uptime pinger (e.g. UptimeRobot, Better Uptime) to probe `https://your-backend.onrender.com/health` every 2 minutes.
- **Log Monitoring**: FastAPI logs format standard HTTP access and application warnings to `stdout`/`stderr`.
