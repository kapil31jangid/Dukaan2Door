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
  origin?: MapCoordinate;
  requestedAt: number;
}

export function shouldRefreshRoute(
  previous: RouteRefreshSnapshot | null,
  next: RouteRefreshSnapshot,
  freezeMovement = false,
): boolean {
  if (!previous || previous.deliveryId !== next.deliveryId || previous.status !== next.status) return true;
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
