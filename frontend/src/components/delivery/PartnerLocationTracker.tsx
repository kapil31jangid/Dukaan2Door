import React, { useEffect, useRef, useState } from 'react';
import { Navigation, RotateCw } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { ApiError } from '../../services/api';
import { RouteGeometry } from '../../types/delivery';
import { distanceMeters } from '../../utils/trackingGeometry';
import { ACTIVE_TRACKING_STATUSES, geolocationErrorMessage, isValidGpsCoordinate, startLocationWatch } from '../../utils/locationTracking';

interface PartnerLocationTrackerProps {
  deliveryId: number;
  onLocationUpdated?: (lat: number, lng: number, accuracyM: number | undefined, recordedAt: string, heading: number | null) => void;
  defaultLat?: number;
  defaultLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  routeGeometry?: RouteGeometry | null;
  deliveryStatus?: string;
  disabled?: boolean;
}

export const PartnerLocationTracker: React.FC<PartnerLocationTrackerProps> = ({ deliveryId, deliveryStatus, onLocationUpdated, disabled = false }) => {
  const callback = useRef(onLocationUpdated);
  callback.current = onLocationUpdated;
  const [message, setMessage] = useState('Waiting for device location');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const active = !disabled && ACTIVE_TRACKING_STATUSES.includes(deliveryStatus as typeof ACTIVE_TRACKING_STATUSES[number]);
  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) { setFailed(true); setMessage('Location sharing is unavailable in this browser.'); return; }
    let cancelled = false;
    let sending = false;
    let pendingTimer: number | null = null;
    let queuedPosition: GeolocationPosition | null = null;
    let lastAccepted: { lat: number; lng: number; sentAt: number } | null = null;
    setFailed(false);
    setMessage('Waiting for device location permission');

    const sendPosition = async (position: GeolocationPosition) => {
      const { coords, timestamp } = position;
      if (cancelled || !isValidGpsCoordinate(coords.latitude, coords.longitude)) return;
      if (Date.now() - timestamp > 30000) {
        setFailed(true);
        setMessage('GPS reading is stale. Waiting for a fresh device location.');
        return;
      }
      if (lastAccepted) {
        const movedM = distanceMeters(
          { lat: lastAccepted.lat, lng: lastAccepted.lng },
          { lat: coords.latitude, lng: coords.longitude },
        );
        if (movedM < 3 && Date.now() - lastAccepted.sentAt < 15000) return;
        if (Date.now() - lastAccepted.sentAt < 3000) {
          queuedPosition = position;
          return;
        }
      }
      if (sending) {
        queuedPosition = position;
        return;
      }
      sending = true;
      try {
        const accepted = await deliveryService.updateLocation(
          deliveryId,
          coords.latitude,
          coords.longitude,
          coords.accuracy,
          new Date(timestamp).toISOString(),
        );
        if (!cancelled) {
          lastAccepted = { lat: accepted.latitude, lng: accepted.longitude, sentAt: Date.now() };
          const heading = coords.speed != null && coords.speed >= 1 && coords.heading != null && Number.isFinite(coords.heading)
            ? coords.heading : null;
          callback.current?.(accepted.latitude, accepted.longitude, accepted.accuracy_m ?? undefined, accepted.recorded_at, heading);
          const weak = coords.accuracy > 60;
          setFailed(weak);
          setMessage(`${weak ? 'GPS signal weak' : 'Location updating'} · accuracy ±${Math.round(coords.accuracy)} m · just now`);
        }
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          setMessage(error instanceof ApiError && error.status === 409
            ? 'An older GPS reading was ignored. Waiting for a fresh location.'
            : 'Connection interrupted. GPS is available, but the location could not be shared.');
        }
      } finally {
        sending = false;
        const queued = queuedPosition;
        queuedPosition = null;
        if (queued && !cancelled) {
          if (pendingTimer != null) window.clearTimeout(pendingTimer);
          pendingTimer = window.setTimeout(() => {
            pendingTimer = null;
            void sendPosition(queued);
          }, 3000);
        }
      }
    };

    const stopWatching = startLocationWatch(
      navigator.geolocation,
      (position) => void sendPosition(position),
      (error) => {
        if (!cancelled) { setFailed(true); setMessage(geolocationErrorMessage(error)); }
      },
    );
    return () => {
      cancelled = true;
      queuedPosition = null;
      if (pendingTimer != null) window.clearTimeout(pendingTimer);
      stopWatching();
    };
  }, [active, deliveryId, attempt]);
  if (!active) return null;
  return <div role="status" className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-xs ${failed ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><Navigation className="h-4 w-4 shrink-0" /><span className="flex-1">{message}</span>{failed && <button onClick={() => setAttempt(value => value + 1)} className="flex min-h-10 items-center gap-1 font-bold"><RotateCw className="h-4 w-4" />Retry GPS</button>}</div>;
};
