# Rider GPS and Live Routing Fix

## Scope and status

This change repairs the existing Browser GPS -> FastAPI -> PostgreSQL -> WebSocket -> Mapbox pipeline. A later demo-only extension can replay the verified OSRM route after `OUT_FOR_DELIVERY`; those points are explicitly stored and displayed as `DEMO_SIMULATION`, never as measured GPS.

- Automated validation: PASS
- Frontend production build: PASS
- Automated browser responsive smoke: NOT RUN (`playwright` is not installed)
- Physical phone movement test: BLOCKED in this coding environment
- Database migration: `20261011_0007` adds the tracking source needed to distinguish real GPS, lifecycle records, and labelled demo playback

## Root causes and fixes

| Issue | Previous behavior and root cause | Implemented fix | Verification evidence |
|---|---|---|---|
| Rider marker reset or appeared stuck | `CurrentDeliveryPage` reloaded the rider profile every 10 seconds and reapplied that coordinate over newer component state. | Profile coordinates initialize a new delivery once. Accepted GPS callbacks own the active marker afterward. | TypeScript build and frontend tracking tests pass. |
| Marker movement jumped | `MapView` removed and recreated every marker whenever marker or accuracy-circle props changed. | Markers are retained by ID and updated in place. Rider changes animate for 900 ms only between received positions. Reduced-motion users get immediate updates. | Production build passes; source inspection confirms one animation per marker with cancellation. |
| Older points could replace newer points | The client accepted every REST/WebSocket point, and the API did not carry or compare device capture time. | The rider sends `captured_at`. The backend locks the delivery row, compares the newest GPS capture, and rejects stale, future, and out-of-order points. Customer views also compare `recorded_at` before updating state. | Backend out-of-order regression passes. Frontend stale-point regression passes. |
| Fresh points could appear stale outside UTC | Database timestamps were serialized without a timezone, so browsers could interpret UTC values as local wall time. | Tracking responses and WebSocket events now identify recorded timestamps explicitly as UTC. | Backend response regression checks the UTC suffix. |
| Route target was inferred incorrectly | Supplying an origin always routed to the store, while omitting it always routed store-to-customer. Delivery stage was ignored. | `ASSIGNED`/`ACCEPTED` route from rider to store. `PICKED_UP`/`OUT_FOR_DELIVERY` route from rider to customer. Completed routes are removed. | Backend stage-routing regression passes. |
| Routes became stale while the rider moved | Customer routes loaded only once and rider routes were tied to 10-second page polling. | Both portals recalculate immediately after a stage change, or after at least 75 m of movement and 15 seconds. Previous requests are cancelled and request IDs prevent old responses from winning. | Build passes; route logic uses the same thresholds in both active views. |
| Customer marker could regress | REST polling selected the last array item and WebSocket messages were applied without ordering checks. | REST selects the newest timestamp; REST and WebSocket use the same monotonic acceptance function. REST polling remains recovery for an interrupted socket. | Frontend ordering tests and existing WebSocket backend tests pass. |
| Raw GPS appeared off-road | The marker used raw coordinates only. | Raw GPS remains the stored source of truth. For display only, a good-accuracy reading can be projected onto the current verified OSRM route. Weak or distant readings stay raw and show an accuracy circle. | Route-alignment and fallback regressions pass. |
| Tracking state was ambiguous | Stale coordinates could still be described as live; GPS and network failures used similar messaging. | UI distinguishes waiting, permission required, unavailable GPS, weak accuracy, stale data, live updates, and interrupted network state. | Production build passes; messages are driven by measured accuracy, timestamp, and WebSocket state. |

## GPS acquisition

`PartnerLocationTracker` uses one `watchPosition()` subscription only while delivery status is `ACCEPTED`, `PICKED_UP`, or `OUT_FOR_DELIVERY`.

Options:

```text
enableHighAccuracy: true
maximumAge: 5000 ms
timeout: 20000 ms
```

Behavior:

- Invalid coordinates are rejected before transmission.
- Browser readings older than 30 seconds are not sent.
- Movement under 3 m is deduplicated for up to 15 seconds.
- Requests are limited to one every 3 seconds.
- A newer point is queued while a request is in flight instead of being silently discarded.
- The watcher and pending timer are stopped on unmount or when delivery leaves an active tracking state.
- Device heading is used only when supplied while speed is at least 1 m/s.

## Backend and WebSocket pipeline

The existing role and delivery ownership checks remain authoritative. In addition:

1. The assigned rider must have accepted the delivery.
2. Latitude and longitude are validated.
3. Capture time must be recent and cannot be more than one minute in the future.
4. A delivery row lock serializes competing location writes.
5. Older captures return HTTP 409 and do not alter partner coordinates.
6. Accepted raw coordinates and accuracy are stored in `delivery_tracking`.
7. The persisted point and timestamp are broadcast using the existing authorized delivery WebSocket channel.

No snapped coordinate is persisted or broadcast as measured GPS.

## Coordinate order

- Application objects: `{ lat, lng }` or named `latitude`/`longitude`
- GeoJSON/Mapbox: `[longitude, latitude]`
- OSRM URL: `longitude,latitude;longitude,latitude`

Automated tests cover the conversion and inspect OSRM request ordering.

## Road-alignment strategy

The display layer projects a raw point onto the nearest segment of the active OSRM route only when:

- an active route has at least two valid coordinates;
- reported GPS accuracy is 60 m or better; and
- route distance is within `max(15 m, min(60 m, accuracy * 1.5))`.

This is route-context projection, not blind nearest-road snapping. When confidence is insufficient, the UI displays raw GPS with its accuracy circle. The circle is always centered on the raw point, making the distinction visible.

OSRM remains the source of road-network geometry. If routing fails, the route line is omitted while the raw rider, store, and destination markers remain available.

## Marker animation and heading

- The rider marker is stable and updated with `setLngLat`.
- Animation ends at the latest received point and never extrapolates.
- A replacement point cancels the prior animation.
- No animation continues after tracking cleanup.
- `prefers-reduced-motion` disables movement and heading transitions.
- Rider-side heading uses reliable device heading; customer-side heading is derived only after movement of at least 3 m.

## Files changed for this fix

Backend:

- `backend/app/api/v1/endpoints/deliveries.py`
- `backend/app/schemas/delivery.py`
- `backend/app/services/delivery_service.py`
- `backend/tests/test_backend_integration.py`

Frontend:

- `frontend/src/components/delivery/PartnerLocationTracker.tsx`
- `frontend/src/components/maps/DeliveryMap.tsx`
- `frontend/src/components/maps/MapView.tsx`
- `frontend/src/pages/delivery/CurrentDeliveryPage.tsx`
- `frontend/src/pages/customer/OrderStatusPage.tsx`
- `frontend/src/pages/customer/LiveTrackingPage.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/customerService.ts`
- `frontend/src/services/deliveryService.ts`
- `frontend/src/services/websocketService.ts`
- `frontend/src/utils/locationTracking.ts`
- `frontend/src/utils/trackingGeometry.ts`
- `frontend/src/index.css`
- `frontend/tests/tracking-geometry.test.mjs`
- `frontend/package.json`

## Automated validation

Executed on 2026-10-10:

```text
backend/.venv/bin/python -m pytest -q
104 passed

cd frontend && npm test
11 passed

cd frontend && npm run build
TypeScript and Vite production build passed
```

The build reports the existing Mapbox bundle-size advisory; it is not a build failure.

The optional `node tests/responsive-smoke.cjs` command was attempted, but the repository does not install `playwright`; it stopped before opening a browser. No browser-smoke pass is claimed. Temporary local servers used for that attempt were stopped afterward.

## Real-device test instructions

Use two authenticated browser sessions: rider on a GPS-capable phone and customer on a second device. Use a safe test route and do not operate the UI while driving.

1. Serve the frontend over HTTPS or localhost; browser geolocation may be blocked on insecure remote origins.
2. Accept a ready delivery as the assigned rider and allow precise location permission.
3. Confirm the rider page says `Location updating` and shows current accuracy.
4. Before pickup, verify the route ends at the store and movement appears on both rider and customer maps.
5. Remain stationary and confirm the marker does not fabricate movement.
6. Disable data briefly and confirm the customer shows an interrupted/stale state instead of `live`.
7. Restore data and confirm WebSocket/REST recovery advances to the newest persisted point.
8. Mark picked up and verify the route switches from the rider's current position to the customer.
9. Check weak GPS indoors: the marker should remain raw with a larger accuracy circle rather than snap misleadingly.
10. Mark delivered and confirm tracking and active route stop.

Record device/browser, permission mode, observed accuracy, and timestamps. Physical GPS and real-world road alignment remain **BLOCKED** until this procedure is completed on an actual phone.

## Remaining limitations

- Browser background throttling is platform-controlled; REST recovery prevents missed WebSocket rendering but cannot force mobile browsers to sample GPS in a suspended tab.
- Route projection is intentionally conservative and is not full multi-point map matching.
- Client device clocks outside the accepted server window are rejected and require clock correction.
- Multi-instance WebSocket fan-out still depends on the repository's existing in-memory connection manager.

## Labelled demo playback

Local Vite development automatically uses demo playback instead of requesting device GPS. After the rider selects **Start delivery**, the rider page samples the real OSRM route from the saved rider position to the customer for 45 seconds by default. These authorized updates are persisted and broadcast with `source = DEMO_SIMULATION`, and both portals label the marker as a demo route.

For a deployed demo, set `VITE_ENABLE_DEMO_ROUTE_PLAYBACK=true`. Adjust `VITE_DEMO_ROUTE_DURATION_SECONDS` if needed; values are limited to 15–180 seconds. Leave playback disabled for production GPS tracking. The simulation never changes order status or marks an order delivered automatically.
