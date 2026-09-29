# Dukaan2Door Testing Guide

This guide is the repeatable manual test for the local Dukaan2Door demo. It
uses one customer, one retailer, and one delivery partner in separate browser
sessions so the complete order lifecycle can be observed in parallel.

## Test Accounts

| Role | Email | Password | Area |
| --- | --- | --- | --- |
| Customer | `rahul@example.com` | `DemoPassword123!` | Satellite |
| Retailer | `satellite.retailer.rahul@example.com` | `DemoPassword123!` | Satellite |
| Delivery partner | `satellite.rider.arjun.3km@example.com` | `DemoPassword123!` | About 3 km from Satellite |

Use three separate browser windows or private profiles. Do not use the same
browser session for multiple roles because each role has its own JWT session.

## Start Services

Terminal 1, backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. Confirm these endpoints before testing:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8080/health`
- API documentation: `http://localhost:8080/docs`
- Mapbox token: `frontend/.env` contains a public `VITE_MAPBOX_TOKEN`

### Reset the 3 km simulation start position

Run this before a new driver-map demonstration if Arjun previously used live
GPS, manual transmit, or completed a simulated drive:

```bash
python scripts/seed_dashboard_accounts.py --allow-remote
```

This updates only the controlled dashboard test accounts. It restores Arjun to
the seeded position approximately 3 km east of the Satellite store. The
dispatch screen should then show roughly `3 km away` for Arjun. After a drive
reaches the customer, the database correctly shows his latest position near
the destination, so a later dispatch list may show `0 km away` until the seed
command is run again.

## Parallel Test Story

### 1. Customer: browse and place order

Log in at `/login` with the customer account.

1. Confirm the customer home screen loads real products from the local store.
2. Set or confirm the Satellite delivery location using the location control.
3. Open the store and verify categories and product availability.
4. Search for a real catalog product.
5. Open the product detail page and test quantity controls.
6. Add one or more available products to the cart.
7. Change a quantity, remove an item, and add it again.
8. Open checkout and verify delivery address, coordinates, COD, items, and total.
9. Place the order.
10. Confirm the real order ID appears on the confirmation screen.
11. Select **Track order** and leave this screen open.

Expected initial order status:

```text
RECEIVED
```

The customer must not manually change order status.

### 2. Retailer: accept and prepare

Log in at `/login` with the retailer account and open `/retailer/orders`.

1. Refresh the order list if the new order is not visible immediately.
2. Open the order created in the customer window.
3. Verify the items, quantities, total, customer address, and store match.
4. Move the order through these actions in order:

```text
RECEIVED -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP
```

5. Stop after `READY_FOR_PICKUP`. Do not assign a delivery partner from the
   retailer dashboard.

Expected result: the customer timeline updates as the retailer progresses the
order. The customer should not show a driver before assignment.

### 3. Delivery partner: accept and drive

Log in with the delivery partner account and open `/delivery/orders`.

1. Open `/delivery/orders` and find the ready order under **Ready orders near
   you**.
2. Confirm the pickup store, destination, and item summary.
3. Select **Accept Order**. This is the action that claims the delivery.
4. Open the delivery.
5. Mark the order as picked up.
6. Start the route to the customer.

For the visual movement test, make sure Arjun is online and his seeded `~3 km
away` position is visible, then claim the ready order from the delivery
dashboard. On the current delivery screen, move the delivery to **Out for
Delivery**. After the rider first accepts the delivery, the road-based drive
starts at Arjun's persisted position and travels to the pickup store. After
pickup and **Out for Delivery**, it follows the road route to the customer.
Keep the customer tracking page open to verify both maps receive the same
updates.

Expected delivery lifecycle:

```text
ASSIGNED -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY
```

There is no manual GPS broadcaster in the rider workflow. Location publishing
is automatic: after acceptance the rider follows the road route to pickup, and
after `OUT_FOR_DELIVERY` the rider follows the route to the customer.

Keep the customer tracking page open while the drive runs. The rider marker,
latest GPS timestamp, and accuracy should update without a page reload.

When the route is complete, select **Mark Delivered to Customer**.
This action is available only to the delivery partner. The retailer cannot
mark an order delivered.

### 4. Customer: verify delivery

Return to the customer tracking screen and confirm:

- Timeline reaches `DELIVERED`.
- Store and customer markers are visible.
- Delivery partner name and vehicle are shown only after assignment.
- Live partner marker updates while the route is active.
- OSRM route is rendered on the Mapbox map when available.
- Final total and item list match the placed order.
- The delivered order appears in `/customer/orders` under Delivered.
- Order detail remains accessible from order history.

## Screen Checklist

### Customer

- `/customer/home`: location, search, categories, store, products.
- `/customer/search`: real search results, category filters, empty state.
- `/customer/store`: single-store catalog and category browsing.
- `/customer/products/:id`: product detail, availability, quantity, add.
- `/customer/cart`: quantities, removal, subtotal, checkout CTA.
- `/customer/checkout`: delivery, payment, review, place order.
- `/customer/orders/:id/confirmation`: real order confirmation.
- `/customer/orders/:id/status`: lifecycle timeline, driver, map, order items.
- `/customer/orders/:id/tracking`: live Mapbox tracking when assigned.
- `/customer/orders`: active, delivered, cancelled, and all orders.
- `/customer/profile`: customer data and saved location.
- `/customer/help`: supported help topics and limitations.
- `/customer/notifications`: live update information.

### Retailer and delivery partner

- `/retailer/orders`: order visibility and fulfillment status changes; retailer
  stops at Ready for Pickup.
- `/retailer/menu`: shared catalog and inventory visibility.
- `/retailer/settings`: store status and store configuration.
- `/delivery/orders`: assigned delivery visibility.
- `/delivery/current`: pickup, route, GPS, and completion actions.
- `/delivery/history`: completed deliveries.

## Expected Data Checks

Verify that:

- Customer and retailer see the same product names, prices, and availability.
- The backend selects the eligible operational store.
- Inventory validation happens at order creation.
- The order ID comes from the backend, not the frontend.
- Retailers stop at `READY_FOR_PICKUP`; only a delivery partner can claim the
  ready order.
- Tracking coordinates come from persisted GPS or the explicit demo simulator.
- Customer, retailer, and delivery partner see only authorized records.

## Automated Checks

Frontend build:

```bash
cd frontend
npm run build
```

Backend tests:

```bash
cd backend
python -m pytest -q
```

API story using isolated generated accounts:

```bash
python scripts/run_story.py
```

Do not run the story script against a shared or production database. Use
`--allow-remote` only when the remote demo database is intentionally selected.

## Troubleshooting

- **Order is missing in retailer:** refresh `/retailer/orders` and confirm the
  retailer account owns the matched Satellite store.
- **Products are unavailable:** refresh the catalog and confirm inventory was
  seeded for the operational store; do not edit browser prices.
- **Customer map is blank:** check `VITE_MAPBOX_TOKEN`, browser console errors,
  and the Mapbox network request.
- **GPS permission fails:** the demo flow does not require browser GPS; it
  publishes the seeded road-based rider route automatically.
- **Customer status is stale:** keep the tracking page open and verify the
  WebSocket connection; the page also polls backend status periodically.
- **Old cart causes stock errors:** clear only the local cart with
  `localStorage.removeItem('d2d_cart')`, then reload.

## Pass Criteria

The test passes when one real order completes this chain without manual
database edits:

```text
Customer places order
-> Retailer accepts and prepares
-> Partner accepts and picks up
-> Partner sends GPS / simulated route
-> Customer sees live tracking
-> Partner marks delivered
-> Customer sees DELIVERED in tracking and order history
```
