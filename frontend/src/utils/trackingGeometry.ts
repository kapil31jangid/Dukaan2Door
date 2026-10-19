import type { DeliveryTrackingPoint, RouteGeometry } from '../types/delivery';
import type { MapCoordinate } from '../components/maps/MapView';

const EARTH_RADIUS_M = 6371000;

export function toGeoJsonCoordinate(coordinate: MapCoordinate): [number, number] {
  return [coordinate.lng, coordinate.lat];
}

export function isValidMapCoordinate(coordinate: MapCoordinate): boolean {
  return Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng)
    && coordinate.lat >= -90 && coordinate.lat <= 90
    && coordinate.lng >= -180 && coordinate.lng <= 180;
}

export function distanceMeters(a: MapCoordinate, b: MapCoordinate): number {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function bearingDegrees(a: MapCoordinate, b: MapCoordinate): number | null {
  if (distanceMeters(a, b) < 3) return null;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function isNewerTrackingPoint(
  current: DeliveryTrackingPoint | null,
  candidate: DeliveryTrackingPoint,
): boolean {
  if (!isValidMapCoordinate({ lat: candidate.latitude, lng: candidate.longitude })) return false;
  const candidateTime = Date.parse(candidate.recorded_at);
  if (!Number.isFinite(candidateTime)) return false;
  if (!current) return true;
  if (candidate.sequence != null && current.sequence != null) {
    return candidate.sequence > current.sequence;
  }
  const currentTime = Date.parse(current.recorded_at);
  return !Number.isFinite(currentTime) || candidateTime > currentTime;
}

export interface AlignedPosition {
  coordinate: MapCoordinate;
  aligned: boolean;
  distanceFromRouteM?: number;
}

export interface RouteRefreshSnapshot {
  deliveryId: number;
  status: string;
  routeMode?: 'LIVE' | 'PLAYBACK_CANONICAL';
  origin?: MapCoordinate;
  requestedAt: number;
}

export function shouldRefreshRoute(
  previous: RouteRefreshSnapshot | null,
  next: RouteRefreshSnapshot,
  freezeMovement = false,
): boolean {
  if (!previous
    || previous.deliveryId !== next.deliveryId
    || previous.status !== next.status
    || previous.routeMode !== next.routeMode) return true;
  if (freezeMovement) return false;
  if (next.requestedAt - previous.requestedAt < 15000) return false;
  if (!previous.origin && !next.origin) return false;
  if (!previous.origin || !next.origin) return true;
  return distanceMeters(previous.origin, next.origin) >= 75;
}

export function sampleRouteAtProgress(
  route: RouteGeometry | null | undefined,
  progress: number,
): MapCoordinate | null {
  const points = route?.coordinates
    ?.map(([lng, lat]) => ({ lat, lng }))
    .filter(isValidMapCoordinate) || [];
  if (!points.length) return null;
  if (points.length === 1) return points[0];

  const segments = points.slice(0, -1).map((point, index) => ({
    start: point,
    end: points[index + 1],
    length: distanceMeters(point, points[index + 1]),
  }));
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength <= 0) return points[0];
  let remaining = Math.max(0, Math.min(1, progress)) * totalLength;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        lat: segment.start.lat + (segment.end.lat - segment.start.lat) * ratio,
        lng: segment.start.lng + (segment.end.lng - segment.start.lng) * ratio,
      };
    }
    remaining -= segment.length;
  }
  return points[points.length - 1];
}

export function routeLengthMeters(route: RouteGeometry | null | undefined): number {
  const points = route?.coordinates
    ?.map(([lng, lat]) => ({ lat, lng }))
    .filter(isValidMapCoordinate) || [];
  return points.slice(0, -1).reduce(
    (total, point, index) => total + distanceMeters(point, points[index + 1]),
    0,
  );
}

export function hasDepartedPickup(
  route: RouteGeometry | null | undefined,
  routeProgress: number | null | undefined,
  minimumDistanceM = 12,
): boolean {
  if (routeProgress == null || !Number.isFinite(routeProgress)) return false;
  const progress = Math.max(0, Math.min(1, routeProgress));
  return routeLengthMeters(route) * progress >= minimumDistanceM;
}

export function advanceRouteProgress(
  route: RouteGeometry | null | undefined,
  progress: number,
  elapsedMs: number,
  speedKmh: number,
): number {
  const lengthM = routeLengthMeters(route);
  if (lengthM <= 0 || elapsedMs <= 0 || speedKmh <= 0) {
    return Math.max(0, Math.min(1, progress));
  }
  const distanceTravelledM = (speedKmh * 1000 / 3600) * (elapsedMs / 1000);
  return Math.min(1, Math.max(0, progress) + distanceTravelledM / lengthM);
}

export function randomizedDemoSpeed(
  baselineKmh: number,
  routeProgress: number,
  randomValue: number,
): number {
  const baseline = Math.max(10, Math.min(80, baselineKmh));
  const variation = 0.55 + Math.max(0, Math.min(1, randomValue)) * 0.65;
  let target = baseline * variation;
  const progress = Math.max(0, Math.min(1, routeProgress));
  if (progress > 0.88) {
    const arrivalRatio = Math.max(0.18, (1 - progress) / 0.12);
    target = Math.min(target, baseline * arrivalRatio);
  }
  return Math.max(6, Math.min(80, target));
}

export function approachDemoSpeed(
  currentKmh: number,
  targetKmh: number,
  elapsedMs: number,
  accelerationKmhPerSecond = 12,
): number {
  if (elapsedMs <= 0) return currentKmh;
  const maximumChange = Math.max(0, accelerationKmhPerSecond) * elapsedMs / 1000;
  const difference = targetKmh - currentKmh;
  if (Math.abs(difference) <= maximumChange) return targetKmh;
  return currentKmh + Math.sign(difference) * maximumChange;
}

export function headingAtRouteProgress(
  route: RouteGeometry | null | undefined,
  progress: number,
): number | null {
  const lengthM = routeLengthMeters(route);
  if (lengthM <= 0) return null;
  const current = sampleRouteAtProgress(route, progress);
  const ahead = sampleRouteAtProgress(route, Math.min(1, progress + Math.max(0.0001, 5 / lengthM)));
  return current && ahead ? bearingDegrees(current, ahead) : null;
}

export function coveredRouteFromProgress(
  route: RouteGeometry | null | undefined,
  progress: number,
): RouteGeometry | null {
  const points = route?.coordinates
    ?.filter(([lng, lat]) => isValidMapCoordinate({ lat, lng })) || [];
  if (points.length < 2) return null;
  const clamped = Math.max(0, Math.min(1, progress));
  const firstPoint = points[0];
  if (clamped <= 0) return { type: 'LineString', coordinates: [firstPoint, firstPoint] };
  if (clamped >= 1) return { type: 'LineString', coordinates: [...points] };

  const current = sampleRouteAtProgress(route, clamped);
  if (!current) return null;
  const lengths = points.slice(0, -1).map(([lng, lat], index) => (
    distanceMeters({ lat, lng }, { lat: points[index + 1][1], lng: points[index + 1][0] })
  ));
  let coveredLength = clamped * lengths.reduce((sum, length) => sum + length, 0);
  for (let index = 0; index < lengths.length; index += 1) {
    if (coveredLength <= lengths[index]) {
      return {
        type: 'LineString',
        coordinates: [...points.slice(0, index + 1), [current.lng, current.lat]],
      };
    }
    coveredLength -= lengths[index];
  }
  return { type: 'LineString', coordinates: [...points] };
}

export function remainingRouteFromProgress(
  route: RouteGeometry | null | undefined,
  progress: number,
): RouteGeometry | null {
  const points = route?.coordinates
    ?.filter(([lng, lat]) => isValidMapCoordinate({ lat, lng })) || [];
  if (points.length < 2) return null;

  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0) return { type: 'LineString', coordinates: [...points] };
  const finalPoint = points[points.length - 1];
  if (clamped >= 1) return { type: 'LineString', coordinates: [finalPoint, finalPoint] };

  const lengths = points.slice(0, -1).map(([lng, lat], index) => (
    distanceMeters({ lat, lng }, { lat: points[index + 1][1], lng: points[index + 1][0] })
  ));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return { type: 'LineString', coordinates: [finalPoint, finalPoint] };

  let coveredLength = clamped * totalLength;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (coveredLength <= segmentLength) {
      const ratio = segmentLength === 0 ? 0 : coveredLength / segmentLength;
      const [startLng, startLat] = points[index];
      const [endLng, endLat] = points[index + 1];
      const currentPoint: [number, number] = [
        startLng + (endLng - startLng) * ratio,
        startLat + (endLat - startLat) * ratio,
      ];
      return { type: 'LineString', coordinates: [currentPoint, ...points.slice(index + 1)] };
    }
    coveredLength -= segmentLength;
  }
  return { type: 'LineString', coordinates: [finalPoint, finalPoint] };
}

export function routeProgressForCoordinate(
  route: RouteGeometry | null | undefined,
  coordinate: MapCoordinate,
): number | null {
  const points = route?.coordinates
    ?.map(([lng, lat]) => ({ lat, lng }))
    .filter(isValidMapCoordinate) || [];
  if (points.length < 2 || !isValidMapCoordinate(coordinate)) return null;

  const segmentLengths = points.slice(0, -1).map((point, index) => distanceMeters(point, points[index + 1]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return 0;

  const cosLat = Math.max(0.01, Math.cos(coordinate.lat * Math.PI / 180));
  let traversed = 0;
  let nearest: { distance: number; progress: number } | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = {
      x: (points[index].lng - coordinate.lng) * 111320 * cosLat,
      y: (points[index].lat - coordinate.lat) * 111320,
    };
    const end = {
      x: (points[index + 1].lng - coordinate.lng) * 111320 * cosLat,
      y: (points[index + 1].lat - coordinate.lat) * 111320,
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(start.x * dx + start.y * dy) / lengthSquared));
    const distance = Math.hypot(start.x + ratio * dx, start.y + ratio * dy);
    const progress = (traversed + ratio * segmentLengths[index]) / totalLength;
    if (!nearest || distance < nearest.distance) nearest = { distance, progress };
    traversed += segmentLengths[index];
  }
  return nearest?.progress ?? null;
}

export function alignPositionToRoute(
  raw: MapCoordinate,
  accuracyM: number | null | undefined,
  route: RouteGeometry | null | undefined,
): AlignedPosition {
  if (!isValidMapCoordinate(raw) || accuracyM == null || !Number.isFinite(accuracyM) || accuracyM > 60) {
    return { coordinate: raw, aligned: false };
  }
  const points = route?.coordinates?.filter(([lng, lat]) => isValidMapCoordinate({ lat, lng })) || [];
  if (points.length < 2) return { coordinate: raw, aligned: false };

  const cosLat = Math.max(0.01, Math.cos(raw.lat * Math.PI / 180));
  const toLocal = ([lng, lat]: [number, number]) => ({
    x: (lng - raw.lng) * 111320 * cosLat,
    y: (lat - raw.lat) * 111320,
  });
  let nearest: { coordinate: MapCoordinate; distance: number } | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = toLocal(points[index]);
    const end = toLocal(points[index + 1]);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(start.x * dx + start.y * dy) / lengthSquared));
    const x = start.x + projection * dx;
    const y = start.y + projection * dy;
    const distance = Math.hypot(x, y);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        distance,
        coordinate: { lat: raw.lat + y / 111320, lng: raw.lng + x / (111320 * cosLat) },
      };
    }
  }

  const thresholdM = Math.max(15, Math.min(60, accuracyM * 1.5));
  if (!nearest || nearest.distance > thresholdM) {
    return { coordinate: raw, aligned: false, distanceFromRouteM: nearest?.distance };
  }
  return { coordinate: nearest.coordinate, aligned: true, distanceFromRouteM: nearest.distance };
}
