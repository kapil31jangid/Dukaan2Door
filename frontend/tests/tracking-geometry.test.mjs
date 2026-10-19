import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let server;
let geometry;
let locationTracking;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  geometry = await server.ssrLoadModule('/src/utils/trackingGeometry.ts');
  locationTracking = await server.ssrLoadModule('/src/utils/locationTracking.ts');
});

after(async () => { await server?.close(); });

test('GeoJSON conversion always emits longitude before latitude', () => {
  assert.deepEqual(geometry.toGeoJsonCoordinate({ lat: 23.0276, lng: 72.5076 }), [72.5076, 23.0276]);
});

test('newer valid tracking points win and stale or invalid points do not', () => {
  const current = { latitude: 23.02, longitude: 72.5, recorded_at: '2026-10-10T10:00:10Z' };
  assert.equal(geometry.isNewerTrackingPoint(current, { latitude: 23.03, longitude: 72.51, recorded_at: '2026-10-10T10:00:11Z' }), true);
  assert.equal(geometry.isNewerTrackingPoint(current, { latitude: 23.01, longitude: 72.49, recorded_at: '2026-10-10T10:00:09Z' }), false);
  assert.equal(geometry.isNewerTrackingPoint(current, { latitude: 123, longitude: 72.49, recorded_at: '2026-10-10T10:00:12Z' }), false);
  const sequenced = { ...current, sequence: 20 };
  assert.equal(geometry.isNewerTrackingPoint(sequenced, { ...current, sequence: 21 }), true);
  assert.equal(geometry.isNewerTrackingPoint(sequenced, { ...current, recorded_at: '2026-10-10T10:00:20Z', sequence: 19 }), false);
});

test('display alignment uses a nearby verified route but preserves uncertain raw GPS', () => {
  const route = { type: 'LineString', coordinates: [[72.5, 23], [72.51, 23]] };
  const nearby = { lat: 23.0001, lng: 72.505 };
  const aligned = geometry.alignPositionToRoute(nearby, 10, route);
  assert.equal(aligned.aligned, true);
  assert.ok(Math.abs(aligned.coordinate.lat - 23) < 0.00001);

  const weak = geometry.alignPositionToRoute(nearby, 100, route);
  assert.equal(weak.aligned, false);
  assert.deepEqual(weak.coordinate, nearby);
  const far = { lat: 23.01, lng: 72.505 };
  assert.equal(geometry.alignPositionToRoute(far, 8, route).aligned, false);
});

test('rerouting is immediate for stage changes and bounded for movement updates', () => {
  const previous = { deliveryId: 4, status: 'ACCEPTED', origin: { lat: 23, lng: 72.5 }, requestedAt: 1000 };
  assert.equal(geometry.shouldRefreshRoute(previous, { ...previous, requestedAt: 17000, origin: { lat: 23.0001, lng: 72.5 } }), false);
  assert.equal(geometry.shouldRefreshRoute(previous, { ...previous, requestedAt: 10000, origin: { lat: 23.001, lng: 72.5 } }), false);
  assert.equal(geometry.shouldRefreshRoute(previous, { ...previous, requestedAt: 17000, origin: { lat: 23.001, lng: 72.5 } }), true);
  assert.equal(geometry.shouldRefreshRoute(previous, { ...previous, status: 'PICKED_UP', requestedAt: 1001 }), true);
});

test('route playback keeps one route so its marker remains on the displayed line', () => {
  const previous = {
    deliveryId: 25,
    status: 'OUT_FOR_DELIVERY',
    origin: { lat: 23.03, lng: 72.52 },
    requestedAt: 1_000,
  };
  const moved = {
    ...previous,
    origin: { lat: 23.02, lng: 72.51 },
    requestedAt: 31_000,
  };
  assert.equal(geometry.shouldRefreshRoute(previous, moved, true), false);
  assert.equal(geometry.shouldRefreshRoute(previous, moved, false), true);
});

test('switching to canonical playback routing replaces a previously fetched live route immediately', () => {
  const previous = {
    deliveryId: 25,
    status: 'OUT_FOR_DELIVERY',
    routeMode: 'LIVE',
    origin: { lat: 23.03, lng: 72.52 },
    requestedAt: 30_000,
  };
  const canonical = {
    ...previous,
    routeMode: 'PLAYBACK_CANONICAL',
    origin: { lat: 23.04, lng: 72.53 },
    requestedAt: 30_100,
  };
  assert.equal(geometry.shouldRefreshRoute(previous, canonical, true), true);
  assert.equal(geometry.shouldRefreshRoute(canonical, { ...canonical, requestedAt: 60_000 }, true), false);
});

test('demo route sampling follows GeoJSON road geometry from start to destination', () => {
  const route = { type: 'LineString', coordinates: [[72.5, 23], [72.51, 23], [72.51, 23.01]] };
  assert.deepEqual(geometry.sampleRouteAtProgress(route, 0), { lat: 23, lng: 72.5 });
  const midpoint = geometry.sampleRouteAtProgress(route, 0.5);
  assert.ok(midpoint.lng >= 72.509 && midpoint.lng <= 72.51);
  assert.deepEqual(geometry.sampleRouteAtProgress(route, 1), { lat: 23.01, lng: 72.51 });
  assert.ok(Math.abs(geometry.routeProgressForCoordinate(route, { lat: 23, lng: 72.505 }) - 0.24) < 0.01);
  assert.ok(Math.abs(geometry.routeProgressForCoordinate(route, { lat: 23.005, lng: 72.51 }) - 0.74) < 0.01);

  const remaining = geometry.remainingRouteFromProgress(route, 0.5);
  assert.ok(remaining.coordinates[0][0] >= 72.509 && remaining.coordinates[0][0] <= 72.51);
  assert.deepEqual(remaining.coordinates.at(-1), [72.51, 23.01]);
  assert.ok(remaining.coordinates.length < route.coordinates.length + 1);
  assert.deepEqual(geometry.remainingRouteFromProgress(route, 1).coordinates, [[72.51, 23.01], [72.51, 23.01]]);

  const covered = geometry.coveredRouteFromProgress(route, 0.5);
  assert.deepEqual(covered.coordinates[0], route.coordinates[0]);
  assert.ok(covered.coordinates.at(-1)[0] >= 72.509 && covered.coordinates.at(-1)[0] <= 72.51);
  assert.deepEqual(geometry.coveredRouteFromProgress(route, 1).coordinates, route.coordinates);
});

test('demo movement advances by elapsed distance and configurable speed', () => {
  const route = { type: 'LineString', coordinates: [[72.5, 23], [72.51, 23], [72.51, 23.01]] };
  const length = geometry.routeLengthMeters(route);
  assert.ok(length > 2000 && length < 2300);
  assert.equal(geometry.hasDepartedPickup(route, 0), false);
  assert.equal(geometry.hasDepartedPickup(route, 5 / length), false);
  assert.equal(geometry.hasDepartedPickup(route, 12 / length), true);
  assert.equal(geometry.hasDepartedPickup(route, undefined), false);
  const progress = geometry.advanceRouteProgress(route, 0, 60_000, 36);
  assert.ok(Math.abs(progress - 600 / length) < 0.0001);
  assert.equal(geometry.advanceRouteProgress(route, 0.99, 60_000, 80), 1);
  assert.equal(geometry.advanceRouteProgress(route, 0.4, 0, 40), 0.4);
  assert.ok(geometry.headingAtRouteProgress(route, 0.1) > 80 && geometry.headingAtRouteProgress(route, 0.1) < 100);
});

test('demo speed varies smoothly and slows near the destination', () => {
  assert.equal(geometry.randomizedDemoSpeed(40, 0.5, 0), 22);
  assert.ok(Math.abs(geometry.randomizedDemoSpeed(40, 0.5, 1) - 48) < 0.0001);
  assert.ok(geometry.randomizedDemoSpeed(40, 0.98, 1) < 10);
  assert.equal(geometry.approachDemoSpeed(20, 40, 500), 26);
  assert.equal(geometry.approachDemoSpeed(40, 20, 500), 34);
  assert.equal(geometry.approachDemoSpeed(20, 21, 500), 21);
});

test('GPS watcher starts once, forwards readings, and cleanup is idempotent', () => {
  let success;
  let watchCalls = 0;
  let clearCalls = 0;
  const geolocation = {
    watchPosition(onSuccess, _onError, options) {
      success = onSuccess;
      watchCalls += 1;
      assert.equal(options.enableHighAccuracy, true);
      return 42;
    },
    clearWatch(id) {
      assert.equal(id, 42);
      clearCalls += 1;
    },
  };
  let updates = 0;
  const stop = locationTracking.startLocationWatch(geolocation, () => { updates += 1; }, () => {});
  success({ coords: {}, timestamp: Date.now() });
  stop();
  stop();
  success({ coords: {}, timestamp: Date.now() });
  assert.equal(watchCalls, 1);
  assert.equal(clearCalls, 1);
  assert.equal(updates, 1);
});
