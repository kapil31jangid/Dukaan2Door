import React from 'react';
import { MapView, MapMarker } from './MapView';
import { DeliveryLocationSource, RouteGeometry } from '../../types/delivery';
import { alignPositionToRoute } from '../../utils/trackingGeometry';

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
  className?: string;
  height?: string;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({ pickupLat, pickupLng, pickupLabel = 'Store Pickup', destinationLat, destinationLng, destinationLabel = 'Customer Destination', currentLat, currentLng, currentAccuracyM, currentHeading, currentSource, routeGeometry, className = '', height = '360px' }) => {
  const markers: MapMarker[] = [
    { id: 'pickup', lat: pickupLat, lng: pickupLng, label: `Pickup · ${pickupLabel}`, kind: 'pickup' },
    { id: 'destination', lat: destinationLat, lng: destinationLng, label: `Drop-off · ${destinationLabel}`, kind: 'dropoff' },
  ];
  if (currentLat != null && currentLng != null) {
    const display = alignPositionToRoute({ lat: currentLat, lng: currentLng }, currentAccuracyM, routeGeometry);
    markers.push({
      id: 'rider',
      ...display.coordinate,
      label: currentSource === 'DEMO_SIMULATION'
        ? 'Rider · Demo route'
        : display.aligned ? 'Rider · Route aligned' : currentAccuracyM != null ? 'Rider · GPS' : 'Rider · Last known',
      kind: 'rider',
      heading: currentHeading,
      animate: true,
      followRoute: currentSource === 'DEMO_SIMULATION',
    });
  }
  const circles = currentLat != null && currentLng != null && currentAccuracyM != null && Number.isFinite(currentAccuracyM) && currentAccuracyM >= 0
    ? [{ id: 'rider-accuracy', lat: currentLat, lng: currentLng, radius: currentAccuracyM, color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.16 }]
    : [];
  return <MapView center={{ lat: pickupLat, lng: pickupLng }} markers={markers} circles={circles} routeGeometry={routeGeometry} height={height} className={className} />;
};
