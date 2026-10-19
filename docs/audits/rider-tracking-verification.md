# Rider Tracking Verification

## Authoritative pipeline

```text
Assigned rider browser watchPosition
  -> POST /api/deliveries/{id}/location
  -> JWT role/assignment and coordinate validation
  -> delivery_tracking insert + partner location update
  -> delivery_location_updated WebSocket event
  -> customer tracking state
  -> DeliveryMap / Mapbox marker
```

Every accepted event carries delivery and partner identity, latitude, longitude,
capture time, accuracy where supplied, source, and the persisted tracking ID as
its sequence. Only the assigned rider may publish. Customer, owning retailer,
and assigned rider access to tracking is authorized by delivery ownership.

## Refresh and reconnection

On connection the backend reads the latest persisted tracking row and sends a
`delivery_location_snapshot`. Customer pages also fetch tracking history every
2.5 seconds while WebSocket remains the primary live channel. The client uses
sequence before timestamp to reject delayed events, preventing backward jumps
after reconnect. WebSocket retry delays are bounded and cleanup is idempotent.

## Routing behavior

- Before pickup: current/saved rider position to retailer pickup.
- `PICKED_UP` and later: current rider position to customer destination.
- OSRM supplies road GeoJSON, distance, and duration.
- A status change triggers immediate route refresh.
- Real movement triggers bounded refresh after at least 15 seconds and about
  75 metres; small GPS noise does not continuously call OSRM.
- Route failures are shown instead of replaced with a deceptive straight line.
- Controlled playback uses one immutable pickup-to-customer OSRM route on both
  rider and customer screens. Entering demo tracking forces one canonical
  refresh before that geometry is frozen.

Real GPS remains the displayed rider location and is not forced onto a road.
This is intentional: OSRM routing is not map matching. The map can therefore
show a noisy GPS fix slightly off the route while the next route refresh catches
meaningful deviation.

## Mapbox rendering

`MapView` creates the map once, updates GeoJSON sources and marker positions,
and fits route bounds without recreating the map for each point. GeoJSON always
uses `[longitude, latitude]`. Pickup, destination, rider, remaining route, and
covered route are separate sources/layers. Covered-distance trimming is used
for route-bound demo coordinates, not to falsify real GPS.

## Controlled route playback

Backend-owned route movement is disabled by default. It requires:

```env
# backend/.env
ENABLE_ROUTE_PLAYBACK=true
ROUTE_PLAYBACK_SPEED_KMH=40
ROUTE_PLAYBACK_UPDATE_SECONDS=2.5
PICKUP_DWELL_SECONDS=120

# frontend/.env
VITE_ENABLE_ROUTE_PLAYBACK=true
```

Acceptance automatically starts the rider-to-store route. The backend keeps the
trip moving when browser tabs are switched, persists `ROUTE_PLAYBACK` points,
and broadcasts them through authenticated WebSockets. At the store, pickup is
held for two minutes. Confirming pickup automatically starts the fixed
store-to-customer OSRM route. Delivery completion remains manual after arrival.

The allowlisted demo customer is seeded in Prahlad Nagar, separate from the
Satellite pickup stores. Orders whose pickup and drop-off are within the 100 m
arrival radius are treated as no-travel deliveries and do not fabricate route
movement.

## Verified evidence

- GPS authorization, persistence, source, accuracy, and WebSocket event tests.
- Initial reconnect snapshot test.
- Coordinate ordering, stale update, sequence, route sampling, covered/remaining
  route, departure threshold, speed, and route-refresh tests.
- Route playback geometry and pickup dwell tests.
- Frontend test confirms explicit controls and no automatic completion.
- Production TypeScript/Vite build passed.
- Latest repository regression: backend `122 passed, 1 skipped`; frontend
  `23 passed`; production build passed.

## Limitations

- A live two-device or two-browser map comparison was not executed in this
  audit. It remains required before presentation.
- Browser geolocation needs HTTPS outside localhost and can be throttled in a
  background tab or denied by device policy.
- OSRM availability and Mapbox token/network access are external prerequisites.
- WebSocket rooms are in-memory and do not cross multiple backend processes.
- No dedicated retailer tracking map is implemented.
- The demo animation state is browser-local; reloading the rider page restores
  the last persisted point but does not resume a paused animation automatically.
