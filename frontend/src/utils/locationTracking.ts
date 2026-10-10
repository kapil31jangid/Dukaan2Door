export const ACTIVE_TRACKING_STATUSES = ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] as const;

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 5000,
};

export function isValidGpsCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export function startLocationWatch(
  geolocation: Geolocation,
  onPosition: PositionCallback,
  onError: PositionErrorCallback,
): () => void {
  let stopped = false;
  const watchId = geolocation.watchPosition(
    (position) => { if (!stopped) onPosition(position); },
    (error) => { if (!stopped) onError(error); },
    GEOLOCATION_OPTIONS,
  );
  return () => {
    if (stopped) return;
    stopped = true;
    geolocation.clearWatch(watchId);
  };
}

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission is required. Allow location access in browser settings.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'GPS position is unavailable. Move to an open area and try again.';
  if (error.code === error.TIMEOUT) return 'GPS is taking too long to respond. Retrying automatically.';
  return 'Location is unavailable. Check device location and browser permission.';
}
