# Faculty Demo Checklist

Use disposable/demo accounts and a reviewed demo database. Do not reset or seed
operational Neon immediately before presenting.

## One day before

- [ ] Back up or branch the database and apply migration `20261017_0009` there.
- [ ] Confirm `python -m alembic current` reports `20261017_0009`.
- [ ] Confirm retailer stores are open, geographically close, and stock the same
  exact product/brand/pack sizes needed for the test cart.
- [ ] Confirm three riders have valid locations; give only the intended rider
  `FROZEN_BOX` for a frozen-item demonstration.
- [ ] Configure valid API, WebSocket, Mapbox, and OSRM URLs.
- [ ] For classroom playback only, enable the demo flag in **both** backend and
  frontend. Keep both flags false for real GPS.
- [ ] Run backend tests, frontend tests, and frontend production build.

## Start services

Terminal 1:

```bash
cd backend
source .venv/bin/activate
python -m alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open separate private browser profiles for one customer, three retailers, and
three riders. Keep developer tools open for console/network inspection.

## Demonstration sequence

1. **Customer:** sign in, add an in-stock product, open checkout, confirm address
   and coordinates, and place the order once.
2. Refresh all three **Retailer** order pages. Verify the same order appears as
   `Shared with 3 stores` on every dashboard.
3. Accept on Retailer A. Attempt acceptance on Retailer B and show the conflict;
   confirm Retailers B and C lose the request and only A's stock decreases.
4. Retailer A marks `Preparing`, then `Ready for pickup`.
5. Refresh all three **Rider** request pages. Verify each sees the same order and
   the `3 eligible` pool count. Decline with Rider C; verify A and B retain it.
6. Rider A claims and accepts. Show that Riders B and C no longer see it.
7. Show the automatic rider-to-store route and switch to the customer tab;
   confirm movement continues while the rider tab is inactive.
8. At the store, wait for the two-minute pickup verification countdown and mark
   the order picked up. Confirm the customer-bound route starts automatically.
9. **Real GPS mode:** allow location permission and move the rider device.
10. **Classroom route mode:** point out that the backend, rather than the active
    browser tab, owns movement on the OSRM road geometry.
11. Keep customer tracking and rider trip side by side. Confirm the same marker
    location and that the covered route recedes.
12. Refresh customer tracking during movement. Confirm the last known point is
    restored and later updates continue.
13. At arrival, press `Mark delivered`. Confirm final status in both
    portals and rider availability for the next job.

## Failure checks

- [ ] Invalid/duplicate checkout does not create a second order.
- [ ] A store missing one cart line receives no opportunity.
- [ ] A non-frozen rider cannot claim a frozen order.
- [ ] A declined rider does not see the same order again.
- [ ] Route/API failures show an error; they do not silently draw a straight line.
- [ ] Customer tracking distinguishes route playback from real GPS internally.
- [ ] No unexpected 4xx/5xx requests or console exceptions remain.

## Recovery

- API timeout: confirm backend `/health`, then use the visible Retry action.
- OSRM failure: restore `OSRM_BASE_URL`; do not continue a route-animation claim.
- WebSocket interruption: tracking history polling should preserve the latest
  point; refresh once backend connectivity returns.
- Offer conflict: refresh; the database winner remains authoritative.
- Demo sync failures: Stop playback, verify both flags and API connectivity, then
  restart from the current controlled test order.

## Sign-off

Record browser/device, viewport, Mapbox/OSRM availability, tested order ID,
three retailer IDs, three rider IDs, and any console/network issue. The audit
does not substitute for this final live visual sign-off.
