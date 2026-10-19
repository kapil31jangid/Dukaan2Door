import React from 'react';
import { MapView, MapMarker } from './MapView';
import { DeliveryLocationSource, RouteGeometry } from '../../types/delivery';
import { alignPositionToRoute, hasDepartedPickup } from '../../utils/trackingGeometry';

interface DeliveryMapProps {
  pickupLat: number;
  pickupLng: number;
  pickupLabel?: string;
  destinationLat: number;
  destinationLng: number;
  destinationLabel?: string;
  currentLat?: number | null;
  currentLng?: number | null;
  currentAccuracyM?: number | null;
  routeGeometry?: RouteGeometry | null;
  currentHeading?: number | null;
  currentSource?: DeliveryLocationSource;
  currentRouteProgress?: number;
  animateCurrent?: boolean;
  followCurrent?: boolean;
  journeyStage?: 'TO_PICKUP' | 'TO_CUSTOMER';
  className?: string;
  height?: string;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({ pickupLat, pickupLng, pickupLabel = 'Store Pickup', destinationLat, destinationLng, destinationLabel = 'Customer Destination', currentLat, currentLng, currentAccuracyM, currentHeading, currentSource, currentRouteProgress, animateCurrent = false, followCurrent = false, journeyStage = 'TO_CUSTOMER', routeGeometry, className = '', height = '360px' }) => {
  const followsPlannedRoute = currentSource === 'ROUTE_PLAYBACK' || currentSource === 'DEMO_SIMULATION';
  const markers: MapMarker[] = [
    { id: 'pickup', lat: pickupLat, lng: pickupLng, label: `Pickup · ${pickupLabel}`, kind: 'pickup' },
  ];
  if (journeyStage === 'TO_CUSTOMER') {
    markers.push({ id: 'destination', lat: destinationLat, lng: destinationLng, label: `Drop-off · ${destinationLabel}`, kind: 'dropoff' });
  }
  if (currentLat != null && currentLng != null) {
    const rawCoordinate = { lat: currentLat, lng: currentLng };
    const display = followsPlannedRoute
      ? alignPositionToRoute(rawCoordinate, currentAccuracyM, routeGeometry)
      : { coordinate: rawCoordinate, aligned: false };
    const departedPickup = hasDepartedPickup(routeGeometry, currentRouteProgress);
    markers.push({
      id: 'rider',
      ...display.coordinate,
      label: followsPlannedRoute
        ? journeyStage === 'TO_PICKUP'
          ? currentRouteProgress != null && currentRouteProgress >= 1 ? 'Rider · At pickup' : 'Rider · To pickup'
          : departedPickup ? 'Rider · On the way' : 'Rider · At pickup'
        : currentAccuracyM != null ? 'Rider · GPS' : 'Rider · Last known',
      kind: 'rider',
      heading: currentHeading,
      // Route telemetry is persisted less frequently than map frames, so the
      // marker interpolates between confirmed points on the OSRM geometry.
      animate: followsPlannedRoute
        ? animateCurrent && currentRouteProgress != null
        : true,
      followRoute: followsPlannedRoute,
      routeProgress: currentRouteProgress,
    });
  }
  const circles = !followsPlannedRoute && currentLat != null && currentLng != null && currentAccuracyM != null && Number.isFinite(currentAccuracyM) && currentAccuracyM >= 0
    ? [{ id: 'rider-accuracy', lat: currentLat, lng: currentLng, radius: currentAccuracyM, color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.16 }]
    : [];
  return <MapView center={{ lat: pickupLat, lng: pickupLng }} markers={markers} circles={circles} routeGeometry={routeGeometry} followMarkerId={followCurrent ? 'rider' : undefined} height={height} className={className} />;
};
