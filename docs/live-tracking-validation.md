# Live Tracking Validation Plan

This test verifies real rider GPS appearing on the customer map. It does not use
timer-based movement or fabricated coordinates.

## Setup

- Use an isolated test database/store/order, not operational customer data.
- Use two authenticated sessions: customer on device A and assigned rider on
  device B. A third observer may monitor backend logs.
- Serve the frontend over HTTPS. Mobile browsers generally require a secure
  context and explicit permission for `watchPosition`.
- Confirm Mapbox loads, WebSocket URL uses `wss://`, and OSRM is reachable.
- Keep device B's location services enabled and grant precise-location access.

## Procedure

1. Customer places an isolated test order.
2. Retailer accepts, prepares, and marks it ready for pickup.
3. Eligible rider accepts. Confirm another rider receives a conflict/unavailable
   state rather than the same assignment.
4. On rider device B, keep the app visible and confirm GPS status is active.
5. Move toward the store. Record timestamps and verify rider and customer maps
   update from the same persisted coordinates.
6. At the store, stop moving and verify the marker stabilizes. Mark picked up.
7. Start delivery, move toward the customer using the real road route, and verify
   both maps update in parallel.
8. Briefly disable network access. Restore it and verify bounded WebSocket
   reconnect plus REST polling recovery; no duplicate status transition may occur.
9. Mark delivered from the rider portal. Verify customer status reaches
   `DELIVERED`, tracking stops, and the completed route remains readable.

## Evidence To Record

- Devices/browser versions and whether the page was foreground/backgrounded
- Order/delivery IDs from isolated data
- Timestamped rider and customer screenshots at pickup, route, and delivery
- WebSocket reconnect behavior and REST fallback behavior
- Stored tracking-point count and final order state
- Any accuracy values reported by browser geolocation

Do not record private addresses or tokens in shared evidence.

## Known Mobile Constraints

- Browsers may throttle or suspend geolocation and JavaScript when backgrounded,
  the screen is locked, battery saver is enabled, or the OS revokes permission.
- Indoor GPS can drift. Stationary points should not be interpreted as movement.
- The current web app cannot guarantee OS-level background tracking like a native
  rider app. Keep the rider page foregrounded for the acceptance test.
- WebSocket reconnect is capped at five consecutive attempts with exponential
  delays; customer tracking also polls the authorized REST tracking endpoint.
