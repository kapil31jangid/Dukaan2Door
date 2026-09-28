# Testing Users and End-to-End Story

This runbook is for local development and controlled demo review. The listed
accounts are test accounts, not real people. Do not delete users from Neon;
they may be referenced by orders, deliveries, and tracking records.

## Credentials

### Dashboard demo accounts

Use these accounts for the browser-based customer, retailer, and delivery
partner screens. The shared password is `DemoPassword123!`.

| Role | Email | Password | Demo location |
| --- | --- | --- | --- |
| Customer | `rahul@example.com` | `DemoPassword123!` | Satellite |
| Customer | `demo.customer@example.com` | `DemoPassword123!` | Navrangpura |
| Retailer | `satellite.retailer.rahul@example.com` | `DemoPassword123!` | Satellite |
| Retailer | `satellite.retailer.neha@example.com` | `DemoPassword123!` | Satellite |
| Delivery partner | `satellite.rider.rahul@example.com` | `DemoPassword123!` | At Satellite store |
| Delivery partner | `satellite.rider.arjun.3km@example.com` | `DemoPassword123!` | About 3 km east of Satellite |

Recommended review accounts:

- Customer: `rahul@example.com`
- Retailer: `satellite.retailer.rahul@example.com`
- Delivery partner: `satellite.rider.arjun.3km@example.com`

### Automated test fixtures

These credentials are used only by the isolated backend test suite:

| Role | Email | Password |
| --- | --- | --- |
| Customer fixture | `customer@example.com` | `Password123` |
| Retailer fixture | `retailer@example.com` | `Password123` |
| Delivery fixture | `delivery@example.com` | `Password123` |

### API story accounts

`scripts/run_story.py` creates fresh accounts on every run. The email suffix
contains a random story ID, so the exact email is printed by the script's
registration flow and cannot be known in advance.

| Role | Email pattern | Password |
| --- | --- | --- |
| Customer | `story.customer.<story_id>@example.com` | `StoryPassword123!` |
| Retailer | `story.retailer.<story_id>@example.com` | `StoryPassword123!` |
| Delivery partner | `story.partner.<story_id>@example.com` | `StoryPassword123!` |

## Prepare the demo database

Run these commands from the repository root against the intended demo
database. They are idempotent and do not delete users, products, orders, or
deliveries.

```bash
python scripts/seed_dashboard_accounts.py --allow-remote
python scripts/seed_satellite_catalog.py --allow-remote
```

The Satellite catalog is shared by both Satellite retailer dashboards and the
customer catalog. Existing orders remain attached to their original store;
create a new order after refreshing the catalog.

## Start the application

Backend, Linux/macOS:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

Backend, Windows PowerShell:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8080
```

Frontend, in a second terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## Browser demonstration story

Use separate browser windows or private windows so each role keeps its own
JWT session.

### 1. Customer places the order

Log in with:

```text
Email: rahul@example.com
Password: DemoPassword123!
```

Then:

1. Select Satellite as the delivery area.
2. Open the local store catalog.
3. Add products to the cart.
4. Open checkout and confirm the Satellite address and coordinates.
5. Place the order.
6. Confirm that the customer opens the real order tracking page.
7. Keep this page open; it will update through WebSocket events and polling.

Expected initial status:

```text
RECEIVED
```

### 2. Retailer accepts and prepares the order

Log in with:

```text
Email: satellite.retailer.rahul@example.com
Password: DemoPassword123!
```

Open the retailer dashboard. New orders refresh automatically, or use the
Refresh button. Find the new order and perform these transitions in order:

```text
RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP
```

After `READY_FOR_PICKUP`, assign a delivery partner. Select Arjun when you
want to demonstrate a rider approximately 3 km from Satellite.

### 3. Delivery partner accepts and drives

Log in with:

```text
Email: satellite.rider.arjun.3km@example.com
Password: DemoPassword123!
```

Open `/delivery` and complete the rider actions:

```text
ASSIGNED -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY
```

Use **Simulate Drive** in the Live GPS Broadcaster. It replays the OSRM route
for approximately 2.5 minutes, sending a tracking point every 2.5 seconds.
It updates the backend tracking table and broadcasts the rider position to the
customer map. This is demo GPS data; use **Start Live GPS** for actual browser
device coordinates.

When the rider reaches the destination, click **Mark Delivered to Customer**.

### 4. Customer verifies live tracking

Return to the customer tracking window and verify:

- the status timeline advances;
- the assigned rider name and vehicle are visible;
- the store and destination markers are present;
- the rider marker moves during simulation;
- the latest tracking timestamp and accuracy are shown when available;
- the final order and delivery status become `DELIVERED`.

## API story

For a complete isolated API flow, start the backend locally and run from the
repository root:

```bash
python scripts/run_story.py
```

The script verifies:

```text
health check
  -> register customer, retailer, delivery partner
  -> create retailer product and inventory
  -> customer creates order
  -> automatic store matching
  -> retailer accepts, prepares, and marks ready
  -> retailer assigns delivery partner
  -> partner accepts delivery
  -> partner picks up order
  -> partner starts delivery
  -> partner sends GPS tracking update
  -> partner completes delivery
  -> customer, retailer, and partner visibility checks
```

The script only writes to local URLs by default. Use `--allow-remote` only
when a controlled demo database is intentionally selected. It never resets or
deletes the database.

## Automated backend tests

```bash
cd backend
python -m pytest -q
```

Tests use an isolated temporary database and do not touch Neon.

## Troubleshooting

- If an old cart shows an out-of-stock error, run
  `localStorage.removeItem('d2d_cart')` in the browser console and reload.
- If a retailer dashboard was already open, wait for its 10-second refresh or
  use Refresh.
- If device GPS fails in Private Browsing, use **Simulate Drive** or manual
  coordinates. Browser GPS permissions are separate from the demo workflow.
- Customers do not edit order statuses. Retailer and delivery partner actions
  update the customer tracking screen automatically.
