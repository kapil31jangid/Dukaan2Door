# End-to-End Demo Story

This story verifies the complete customer, retailer, and delivery-partner flow using the real API contracts.

## Start the services

Terminal 1, backend:

```bash
cd backend
source .venv/bin/activate  # Linux/macOS
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Windows PowerShell:

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in three browser windows or profiles. Use one customer, one retailer, and one delivery-partner account so each screen can stay open while the state changes.

## Automated API story

From the repository root, with the local backend running:

```bash
python scripts/run_story.py
```

The runner creates uniquely named isolated demo accounts and performs this sequence:

1. Customer, retailer, and delivery partner registration.
2. Retailer product creation with real inventory.
3. Customer order creation.
4. Automatic store matching from customer coordinates.
5. Retailer accepts, prepares, and marks the order ready.
6. Retailer assigns an available delivery partner.
7. Partner accepts the assignment.
8. Partner picks up and starts delivery.
9. Partner sends GPS coordinates with reported accuracy.
10. Customer reads tracking history and the final delivered state.

The script only writes to a local backend by default. It refuses non-local URLs unless `--allow-remote` is explicitly supplied. It never deletes, truncates, or resets data.

## Manual three-screen story

Customer screen:

1. Register or log in as a customer.
2. Set a delivery address and GPS location near the demo store.
3. Add a product to the cart and place the order.
4. Open the order status page. It should begin at `RECEIVED` and expose the assigned delivery ID after dispatch.

Retailer screen:

1. Log in as the store retailer.
2. Open incoming orders.
3. Use `Accept Order`, `Start Preparing`, and `Mark Ready for Pickup`.
4. Assign an available partner from the dispatch action.

Delivery-partner screen:

1. Log in as the assigned partner.
2. Confirm the delivery assignment with `Accept Delivery Assignment`.
3. Confirm pickup, start the route, and enable `Start Live GPS`.
4. Keep the screen open so browser GPS updates are sent continuously.

Customer tracking screen:

1. Open `Track Progress` after the order is out for delivery.
2. Open `Live Map Tracking`.
3. Confirm the rider marker moves through WebSocket updates.
4. Confirm the accuracy circle reflects the browser-reported GPS accuracy.
5. After the partner marks delivered, the customer timeline and order state become `DELIVERED`.

## Important runtime notes

- Browser GPS requires permission and normally requires HTTPS or `localhost`.
- GPS accuracy is an estimate reported by the device/browser, not a guarantee of physical accuracy.
- WebSocket broadcasting is in-memory and is intended for a single backend instance. Multi-instance deployment needs shared pub/sub.
- OSRM routing requires the configured `OSRM_BASE_URL` to be reachable; tracking and lifecycle updates do not depend on a successful route request.
