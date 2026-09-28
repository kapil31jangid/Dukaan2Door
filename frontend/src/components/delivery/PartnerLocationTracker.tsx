import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Navigation, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';

interface PartnerLocationTrackerProps {
  deliveryId: number;
  onLocationUpdated?: (lat: number, lng: number, accuracyM?: number) => void;
  defaultLat?: number;
  defaultLng?: number;
}

export const PartnerLocationTracker: React.FC<PartnerLocationTrackerProps> = ({
  deliveryId,
  onLocationUpdated,
  defaultLat = 23.0232,
  defaultLng = 72.5722,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [manualLat, setManualLat] = useState<number>(defaultLat);
  const [manualLng, setManualLng] = useState<number>(defaultLng);
  const [isLive, setIsLive] = useState(false);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const sendLocation = async (lat: number, lng: number, accuracy?: number) => {
    setIsUpdating(true);
    setStatusMessage(null);
    setIsError(false);
    try {
      await deliveryService.updateLocation(deliveryId, lat, lng, accuracy);
      setAccuracyM(accuracy ?? null);
      setStatusMessage(`Live GPS sent${accuracy ? ` ±${Math.round(accuracy)}m` : ''}`);
      if (onLocationUpdated) {
        onLocationUpdated(lat, lng, accuracy);
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err.message || 'Failed to update live coordinates');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBrowserGPS = () => {
    if (!navigator.geolocation) {
      setIsError(true);
      setStatusMessage('Geolocation is not supported by your browser');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsLive(false);
      setStatusMessage('Live GPS sharing stopped');
      return;
    }

    setIsLive(true);
    setStatusMessage('Waiting for a high-accuracy GPS fix...');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined;
        setManualLat(latitude);
        setManualLng(longitude);
        void sendLocation(latitude, longitude, accuracy);
      },
      (error) => {
        setIsLive(false);
        watchIdRef.current = null;
        setIsUpdating(false);
        setIsError(true);
        setStatusMessage(`GPS error: ${error.message}. You can use manual coordinates below.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-600" />
          <span>Live GPS Broadcaster</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Transmit your current location to notify the customer and merchant in real-time.
        </p>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            isLoading={isUpdating}
            onClick={handleBrowserGPS}
            leftIcon={<Navigation className="w-4 h-4" />}
          >
            {isLive ? 'Stop Live GPS' : 'Start Live GPS'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            isLoading={isUpdating}
            onClick={() => sendLocation(manualLat, manualLng)}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Transmit
          </Button>
        </div>

        {accuracyM !== null && (
          <p className="text-xs text-slate-600" aria-live="polite">
            Reported GPS accuracy: <span className="font-semibold">±{Math.round(accuracyM)} m</span>
          </p>
        )}

        <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block">Latitude</label>
            <input
              type="number"
              step="0.0001"
              value={manualLat}
              onChange={(e) => setManualLat(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block">Longitude</label>
            <input
              type="number"
              step="0.0001"
              value={manualLng}
              onChange={(e) => setManualLng(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              isError
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
