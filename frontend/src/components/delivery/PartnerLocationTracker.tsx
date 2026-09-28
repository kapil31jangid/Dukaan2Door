import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Navigation, RefreshCw, CheckCircle2, AlertCircle, Play, Square } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { RouteGeometry } from '../../types/delivery';

interface PartnerLocationTrackerProps {
  deliveryId: number;
  onLocationUpdated?: (lat: number, lng: number, accuracyM?: number) => void;
  defaultLat?: number;
  defaultLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  routeGeometry?: RouteGeometry | null;
}

export const PartnerLocationTracker: React.FC<PartnerLocationTrackerProps> = ({
  deliveryId,
  onLocationUpdated,
  defaultLat = 23.0232,
  defaultLng = 72.5722,
  pickupLat,
  pickupLng,
  destinationLat,
  destinationLng,
  routeGeometry,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [manualLat, setManualLat] = useState<number>(defaultLat);
  const [manualLng, setManualLng] = useState<number>(defaultLng);
  const [isLive, setIsLive] = useState(false);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const simulationIndexRef = useRef(0);
  const SIMULATION_INTERVAL_MS = 2500;
  const SIMULATION_STEPS = 60; // 60 x 2.5 seconds = 2.5 minutes

  const sendLocation = async (lat: number, lng: number, accuracy?: number, source = 'GPS') => {
    setIsUpdating(true);
    setStatusMessage(null);
    setIsError(false);
    try {
      await deliveryService.updateLocation(deliveryId, lat, lng, accuracy);
      setAccuracyM(accuracy ?? null);
      setStatusMessage(`${source} position sent${accuracy ? ` ±${Math.round(accuracy)}m` : ''}`);
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

  const getSimulationPath = (): Array<[number, number]> => {
    const routePoints = routeGeometry?.coordinates
      ?.filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([lng, lat]) => [lat, lng] as [number, number]);
    const sourcePoints = routePoints && routePoints.length >= 2 ? routePoints : [];
    if (sourcePoints.length >= 2) {
      // OSRM may return only a few geometry points. Resample the polyline so
      // the demo always takes the same visible 2.5 minutes.
      return Array.from({ length: SIMULATION_STEPS + 1 }, (_, index) => {
        const position = (index / SIMULATION_STEPS) * (sourcePoints.length - 1);
        const lower = Math.floor(position);
        const upper = Math.min(Math.ceil(position), sourcePoints.length - 1);
        const fraction = position - lower;
        return [
          sourcePoints[lower][0] + (sourcePoints[upper][0] - sourcePoints[lower][0]) * fraction,
          sourcePoints[lower][1] + (sourcePoints[upper][1] - sourcePoints[lower][1]) * fraction,
        ] as [number, number];
      });
    }
    if (![pickupLat, pickupLng, destinationLat, destinationLng].every((value) => Number.isFinite(value))) {
      return [];
    }
    const points: Array<[number, number]> = [];
    for (let step = 0; step <= SIMULATION_STEPS; step += 1) {
      const progress = step / SIMULATION_STEPS;
      points.push([
        pickupLat! + (destinationLat! - pickupLat!) * progress,
        pickupLng! + (destinationLng! - pickupLng!) * progress,
      ]);
    }
    return points;
  };

  const stopSimulation = () => {
    if (simulationTimerRef.current !== null) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setIsSimulating(false);
  };

  const handleSimulation = () => {
    if (isSimulating) {
      stopSimulation();
      setStatusMessage('Demo drive stopped');
      return;
    }
    const path = getSimulationPath();
    if (path.length < 2) {
      setIsError(true);
      setStatusMessage('Route coordinates are not available for simulation');
      return;
    }
    simulationIndexRef.current = 0;
    setIsSimulating(true);
    setStatusMessage('Demo drive started');
    const sendNextPoint = () => {
      const point = path[simulationIndexRef.current];
      if (!point) {
        stopSimulation();
        setStatusMessage('Demo drive completed at the customer');
        return;
      }
      setManualLat(point[0]);
      setManualLng(point[1]);
      void sendLocation(point[0], point[1], undefined, 'Demo drive');
      simulationIndexRef.current += 1;
    };
    sendNextPoint();
    simulationTimerRef.current = window.setInterval(sendNextPoint, SIMULATION_INTERVAL_MS);
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
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (simulationTimerRef.current !== null) window.clearInterval(simulationTimerRef.current);
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSimulation}
            leftIcon={isSimulating ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          >
            {isSimulating ? 'Stop Demo Drive' : 'Simulate Drive'}
          </Button>
        </div>

        <p className="text-[11px] text-slate-500">
          Demo Drive replays the route and writes simulated tracking points. Use Start Live GPS for real device coordinates.
        </p>

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
