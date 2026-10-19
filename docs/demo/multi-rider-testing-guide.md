# Multi-Rider Pool and Delivery Testing Guide

## Objective

Prove that a ready order is visible to every nearby, available, capable rider;
that decline is rider-specific; and that only one rider can claim and complete
the delivery.

## Personas

| Label | Rider | Login | Capability | Primary test action |
|---|---|---|---|---|
| D-A | Rider Rahul | `satellite.rider.rahul@example.com` | Normal | Claim and deliver |
| D-B | Rider Arjun | `satellite.rider.arjun.3km@example.com` | Normal | Attempt stale claim |
| D-C | Rider Meera | `satellite.rider.meera@example.com` | Normal, frozen box | Decline and capability test |

Password: `DemoPassword123!`

The labels describe one repeatable scenario, not rider priority. Whichever
eligible rider claims first becomes the sole assigned rider; the others must
wait for the next ready order.

## Preconditions

1. All three rider profiles are available and have valid coordinates.
2. A retailer has accepted and prepared a normal-product order.
3. The order is exactly `READY_FOR_PICKUP`.
4. Open `/delivery/orders` in three independent browser profiles.
5. Confirm pickup and customer coordinates differ. The seeded Rahul customer
   uses Prahlad Nagar while the stores remain in Satellite.

## Primary Pool Story

### Test D-01: Fan-out to three riders

Steps:

1. Refresh D-A, D-B, and D-C.
2. Find the same order number in each request page.
3. Confirm the card says `Shared rider pool · 3 eligible`.
4. Compare pickup, destination, items, and handling requirements.

Expected:

- All three riders see the same order.
- No rider is assigned yet.
- The customer order remains `READY_FOR_PICKUP`.

API evidence:

```text
GET /api/deliveries/available-orders
  -> same order for D-A, D-B, D-C
  -> eligible_rider_pool_size: 3
```

### Test D-02: Rider-specific decline

Steps:

1. Select Decline on D-C and confirm.
2. Refresh all rider sessions.

Expected:

- D-C no longer sees this order.
- D-A and D-B still see it.
- No rider is assigned.
- Customer order is not cancelled.

API evidence:

```text
POST /api/deliveries/available-orders/{order_id}/decline -> 200
available_to_other_riders -> true
```

### Test D-03: First rider claim wins

Steps:

1. Select Accept on D-A.
2. Without refreshing D-B, attempt Accept there.
3. Refresh all request pages.

Expected:

- D-A receives one assignment.
- D-B receives `409` or the stale card disappears after refresh.
- D-C remains declined.
- One delivery row has one partner ID.

### Test D-04: Controlled state progression

On D-A:

1. Open Active Trip.
2. Select Accept delivery.
3. Select Mark picked up.
4. Confirm the route now targets the customer.
5. Select Start delivery.
6. Send real GPS or use visibly labelled controlled playback.
7. Mark delivered only after arrival.

Expected state sequence:

```text
ASSIGNED -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
```

The customer order follows the related order states and the customer tracking
page receives the same persisted location updates.

## Eligibility Tests

| Test | Setup/action | Expected result |
|---|---|---|
| D-E01 | Rider location beyond 5 km | Not listed; direct claim returns `409` |
| D-E02 | Rider unavailable | Not listed and cannot claim |
| D-E03 | Frozen item, normal rider | D-A and D-B do not see it |
| D-E04 | Frozen item, Meera | D-C sees it because of `FROZEN_BOX` |
| D-E05 | Rider already has active delivery | Cannot claim another job |
| D-E06 | Declined rider retries direct claim | Conflict; decline remains effective |
| D-E07 | Claim before ready state | Conflict |

Only run the frozen tests when a reviewed frozen catalog item exists with
`handling_type=FROZEN` and `requires_special_equipment=true`.

## Tracking Tests

### Real GPS

1. Use a secure context or localhost.
2. Allow browser location permission.
3. Start delivery only after pickup.
4. Compare rider and customer coordinates and timestamps.
5. Refresh customer tracking and verify snapshot recovery.

Expected:

- Source is `GPS`.
- Stale sequence numbers do not replace newer locations.
- Before movement, customer text does not claim the rider is on the way.
- Weak or stale GPS is labelled honestly.

### Controlled classroom route

1. Enable `ENABLE_ROUTE_PLAYBACK=true` on the backend.
2. Enable `VITE_ENABLE_ROUTE_PLAYBACK=true` on the frontend.
3. Accept a request. The rider automatically travels to the store on the OSRM route.
4. Switch to the customer tab and verify movement continues.
5. At the store, wait for the two-minute pickup verification countdown.
6. Mark picked up; the customer-bound leg starts automatically.

Expected:

- Backend persists source `ROUTE_PLAYBACK`.
- Rider and customer use the same immutable OSRM geometry for each leg.
- Every route coordinate is sampled from that geometry; no straight-line
  or stale rider-profile fallback is used.
- Covered distance turns gray, remaining distance stays blue, and customer
  interpolation remains on the road line between throttled updates.
- Browser tab switching does not stop movement.
- Arrival never completes the delivery automatically.

## Failure and Recovery Matrix

| Symptom | Check | Recovery |
|---|---|---|
| No rider sees order | Order status, store coordinates | Mark ready; verify coordinates |
| Pool count below three | Availability, distance, capabilities | Rerun account seed; refresh |
| Claim conflict | Another rider won | Refresh; use persisted winner |
| Route missing | OSRM URL/network | Restore OSRM; retry route |
| Route is `0.0 km` | Pickup equals drop-off on an old order | Complete it, reseed the allowlisted customer, create a new order |
| Customer marker stale | WebSocket/API connectivity | Refresh customer tracking |
| Route points absent | Backend route flag | Enable both route flags or use GPS |

## Evidence Sheet

| Item | Recorded value |
|---|---|
| Order ID | |
| Delivery ID | |
| Eligible pool before decline | |
| Declining rider | |
| Winning rider | |
| Losing claim response | |
| Tracking source | |
| Final order status | |
| Console/network errors | |
