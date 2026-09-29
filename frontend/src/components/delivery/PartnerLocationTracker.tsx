import React, { useEffect, useRef, useState } from 'react';
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
  autoStartSimulation?: boolean;
  deliveryStatus?: string;
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
  autoStartSimulation = false,
  deliveryStatus,
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
  const startedSimulationPhaseRef = useRef<string | null>(null);
  const deliveryStatusRef = useRef(deliveryStatus);
  const SIMULATION_INTERVAL_MS = 2500;
  const SIMULATION_STEPS = 60; // 60 x 2.5 seconds = 2.5 minutes

  const sendLocation = async (lat: number, lng: number, accuracy?: number, source = 'GPS') => {
    if (deliveryStatusRef.current === 'DELIVERED' || deliveryStatusRef.current === 'CANCELLED') {
      return;
    }
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

  const getSimulationPath = async (): Promise<Array<[number, number]>> => {
    const hasCoordinates = (values: Array<number | undefined>): values is number[] => values.every((value) => Number.isFinite(value));
    const hasPickup = hasCoordinates([pickupLat, pickupLng]);
    const hasPickupAndDestination = hasCoordinates([pickupLat, pickupLng, destinationLat, destinationLng]);
    const routePoints = routeGeometry?.coordinates
      ?.filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([lng, lat]) => [lat, lng] as [number, number]);
    if (!hasPickup || (deliveryStatus !== 'ACCEPTED' && !hasPickupAndDestination)) {
      return [];
    }

    const pickup: [number, number] = [pickupLat!, pickupLng!];
    const destination: [number, number] = [destinationLat!, destinationLng!];
    const start: [number, number] = hasCoordinates([defaultLat, defaultLng])
      ? [defaultLat!, defaultLng!]
      : pickup;
    const isAtPickup = start[0] === pickup[0] && start[1] === pickup[1];
    const approachRoute = isAtPickup
      ? null
      : await deliveryService.getRoute(deliveryId, { lat: start[0], lng: start[1] });
    const approachCoordinates = approachRoute?.geometry?.coordinates as Array<[number, number]> | undefined;
    const approachPoints = approachCoordinates
      ?.filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([lng, lat]) => [lat, lng] as [number, number]);
    if (!isAtPickup && (!approachPoints || approachPoints.length < 2)) {
      throw new Error('OSRM returned no road geometry for the rider-to-store route');
    }
    const roadApproachPoints = isAtPickup ? [pickup] : approachPoints!;
    const approachSteps = deliveryStatus === 'ACCEPTED'
      ? SIMULATION_STEPS
      : roadApproachPoints.length > 1 ? Math.min(20, SIMULATION_STEPS - 1) : 0;
    const points: Array<[number, number]> = [];

    // Keep both legs on OSRM road geometry: rider -> pickup -> customer.
    for (let step = 0; step <= approachSteps; step += 1) {
      const position = (step / Math.max(approachSteps, 1)) * (roadApproachPoints.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(Math.ceil(position), roadApproachPoints.length - 1);
      const fraction = position - lower;
      points.push([
        roadApproachPoints[lower][0] + (roadApproachPoints[upper][0] - roadApproachPoints[lower][0]) * fraction,
        roadApproachPoints[lower][1] + (roadApproachPoints[upper][1] - roadApproachPoints[lower][1]) * fraction,
      ]);
    }
    if (deliveryStatus === 'ACCEPTED') return points;
    if (!routePoints || routePoints.length < 2) {
      throw new Error('OSRM returned no road geometry for the customer route');
    }
    const sourcePoints = routePoints;
    const deliverySteps = SIMULATION_STEPS - approachSteps;
    for (let step = 1; step <= deliverySteps; step += 1) {
      const position = (step / deliverySteps) * (sourcePoints.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(Math.ceil(position), sourcePoints.length - 1);
      const fraction = position - lower;
      points.push([
        sourcePoints[lower][0] + (sourcePoints[upper][0] - sourcePoints[lower][0]) * fraction,
        sourcePoints[lower][1] + (sourcePoints[upper][1] - sourcePoints[lower][1]) * fraction,
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

  useEffect(() => {
    deliveryStatusRef.current = deliveryStatus;
    if (deliveryStatus === 'DELIVERED' || deliveryStatus === 'CANCELLED') {
      stopSimulation();
    }
  }, [deliveryStatus]);

  const handleSimulation = async () => {
    if (isSimulating) {
      stopSimulation();
      setStatusMessage('Demo drive stopped');
      return;
    }
    let path: Array<[number, number]>;
    try {
      path = await getSimulationPath();
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err.message || 'Road route is not available for simulation');
      return;
    }
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

  useEffect(() => {
    const phase = deliveryStatus === 'ACCEPTED' ? 'TO_PICKUP' : deliveryStatus === 'OUT_FOR_DELIVERY' ? 'TO_CUSTOMER' : null;
    if (!autoStartSimulation || !phase || startedSimulationPhaseRef.current === phase) return;
    if (deliveryStatus !== 'ACCEPTED' && !routeGeometry?.coordinates?.length) return;
    startedSimulationPhaseRef.current = phase;
    void handleSimulation();
  }, [autoStartSimulation, deliveryStatus, routeGeometry, defaultLat, defaultLng]);

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

  // The profile is loaded after this component mounts. Keep the demo's starting
  // point aligned with the persisted rider GPS until the rider edits it or
  // starts live/simulated tracking.
  useEffect(() => {
    if (!isLive && !isSimulating && Number.isFinite(defaultLat) && Number.isFinite(defaultLng)) {
      setManualLat(defaultLat);
      setManualLng(defaultLng);
    }
  }, [defaultLat, defaultLng, isLive, isSimulating]);

  return null;
};
