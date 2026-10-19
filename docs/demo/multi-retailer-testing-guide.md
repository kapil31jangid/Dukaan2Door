# Multi-Retailer Pool Testing Guide

## Objective

Prove that one customer order is offered to every nearby store that can fulfil
the complete cart, while only the first valid retailer acceptance assigns the
order and changes inventory.

An offer is a durable backend record, not a browser push notification. Each
eligible retailer receives its own offer immediately during checkout, and the
retailer dashboard discovers new offers through its 10-second poll or a manual
refresh. Eligibility requires an open store in the active distance tier with
enough stock for every cart item.

## Personas

| Label | Store | Login | Primary test action |
|---|---|---|---|
| R-A | Rahul Satellite Kirana | `satellite.retailer.rahul@example.com` | Accept and fulfil |
| R-B | Neha Satellite Daily Needs | `satellite.retailer.neha@example.com` | Attempt stale acceptance |
| R-C | Priya Satellite Fresh Mart | `satellite.retailer.priya@example.com` | Decline independently |

Password: `DemoPassword123!`

The labels describe one repeatable scenario, not hard-coded priority. Any
eligible store may win. If Neha accepts first, Neha becomes the only retailer
allowed to prepare the order and Rahul/Priya must wait for the next request.

## Preconditions

1. Apply Alembic head `20261017_0009` to a reviewed demo database.
2. Run:

   ```bash
   python scripts/seed_dashboard_accounts.py --allow-remote
   python scripts/seed_satellite_catalog.py --allow-remote --restock
   ```

3. Confirm all three stores are open and show matching catalog items.
4. Open `/retailer/orders` in three tabs and log in separately. Authentication
   uses per-tab session storage, so each tab retains its own retailer identity.
   Private windows or independent browser profiles remain useful for a visually
   obvious demonstration.
5. Place a new normal-product order from `rahul@example.com`.
6. Confirm checkout shows the seeded Prahlad Nagar customer location rather
   than the Satellite store coordinates.

## Primary Pool Story

### Test R-01: Fan-out to three stores

Steps:

1. Refresh R-A, R-B, and R-C.
2. Find the customer order number in each session.
3. Confirm each card says `Shared with 3 stores`.
4. Open each order and compare line items.

Expected:

- All dashboards show one shared order ID.
- Status remains `RECEIVED`.
- Customer confirmation reports three eligible stores.
- No inventory has changed.

API evidence:

```text
POST /api/orders -> retailer_pool_size: 3
GET /api/orders as each retailer -> same pending order
```

### Test R-02: One store declines

Steps:

1. Select Reject on R-C.
2. Refresh all retailer sessions.

Expected:

- R-C no longer sees the opportunity.
- R-A and R-B retain it.
- Customer order is not rejected.
- Stock remains unchanged at all stores.

API evidence:

```text
POST /api/orders/{id}/retailer-reject -> 200
GET /api/orders as R-C -> offer absent
GET /api/orders as R-A/R-B -> offer present
```

### Test R-03: First acceptance wins

Steps:

1. Record stock for the selected product on R-A and R-B.
2. Select Accept on the chosen winner (R-A in this example).
3. Without refreshing R-B, select Accept there too.
4. Refresh all retailer dashboards.

Expected:

- R-A acceptance succeeds.
- R-B receives conflict behavior and loses the stale card.
- Order `store_id` belongs to R-A.
- R-A quantity decreases by ordered quantity once.
- R-B and R-C quantities do not change.
- R-B and R-C cannot start preparation or update the winner's order, even if a
  stale modal was already open.

API evidence:

```text
POST /api/orders/{id}/retailer-accept as R-A -> 200
POST /api/orders/{id}/retailer-accept as R-B -> 409
```

### Test R-04: Fulfilment gate

Steps:

1. On R-A select Start Preparing.
2. Verify riders still have no request while status is `PREPARING`.
3. Select Mark Ready for Pickup.
4. Refresh rider request pages.

Expected:

- Only the winning store controls preparation.
- Rider pooling starts only at `READY_FOR_PICKUP`.

## Negative and Isolation Matrix

| Test | Action | Expected result |
|---|---|---|
| R-N01 | Store lacks one cart item | Store receives no offer |
| R-N02 | Store has insufficient quantity | Store receives no offer |
| R-N03 | Store is closed | Store receives no offer |
| R-N04 | Store outside active radius | Store receives no offer |
| R-N05 | Losing retailer uses a stale order modal | Update rejected; winner alone can prepare |
| R-N06 | Repeat winner acceptance | No second inventory decrement |
| R-N07 | Repeat checkout token | Existing order returned |
| R-N08 | All stores reject | Order becomes rejected; no stock changes |

## Inventory Evidence Sheet

Complete this during testing:

| Store | Product | Before | Ordered | After | Expected |
|---|---|---:|---:|---:|---|
| R-A winner | | | | | Before minus ordered |
| R-B loser | | | | | Unchanged |
| R-C declined | | | | | Unchanged |

## Reset Between Attempts

Retailer offers are intentionally terminal. To repeat the story:

1. Finish or abandon the old test order without deleting it.
2. Rerun the allowlisted demo restock command if quantities changed.
3. Place a new customer order with a new checkout action.
4. Record the new order ID.

Do not edit offer rows manually and do not reset operational Neon.
