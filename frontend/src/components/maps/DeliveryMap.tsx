import React from 'react';
import { MapView, MapMarker } from './MapView';
import { RouteGeometry } from '../../types/delivery';

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
  className?: string;
  height?: string;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({ pickupLat, pickupLng, pickupLabel = 'Store Pickup', destinationLat, destinationLng, destinationLabel = 'Customer Destination', currentLat, currentLng, currentAccuracyM, routeGeometry, className = '', height = '360px' }) => {
  const markers: MapMarker[] = [
    { id: 'pickup', lat: pickupLat, lng: pickupLng, label: `Pickup · ${pickupLabel}`, kind: 'pickup' },
    { id: 'destination', lat: destinationLat, lng: destinationLng, label: `Drop-off · ${destinationLabel}`, kind: 'dropoff' },
  ];
  if (currentLat != null && currentLng != null) markers.push({ id: 'rider', lat: currentLat, lng: currentLng, label: 'Rider · Live', kind: 'rider' });
  const circles = currentLat != null && currentLng != null && currentAccuracyM != null && Number.isFinite(currentAccuracyM) && currentAccuracyM >= 0
    ? [{ id: 'rider-accuracy', lat: currentLat, lng: currentLng, radius: currentAccuracyM, color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.16 }]
    : [];
  return <MapView center={{ lat: pickupLat, lng: pickupLng }} markers={markers} circles={circles} routeGeometry={routeGeometry} height={height} className={className} />;
};
