import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RouteGeometry } from '../../types/delivery';

// Fix Leaflet default icon paths in bundler environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DeliveryMapProps {
  pickupLat: number;
  pickupLng: number;
  pickupLabel?: string;
  destinationLat: number;
  destinationLng: number;
  destinationLabel?: string;
  currentLat?: number | null;
  currentLng?: number | null;
  routeGeometry?: RouteGeometry | null;
  className?: string;
  height?: string;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  pickupLat,
  pickupLng,
  pickupLabel = 'Store Pickup',
  destinationLat,
  destinationLng,
  destinationLabel = 'Customer Destination',
  currentLat,
  currentLng,
  routeGeometry,
  className = '',
  height = '360px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([pickupLat, pickupLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Custom Icon Creators
    const createCustomIcon = (bgColor: string, text: string) => {
      return L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background-color: ${bgColor};
            color: white;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -2px rgba(0,0,0,0.2);
            border: 2px solid white;
          ">
            ${text}
          </div>
        `,
        iconSize: [80, 30],
        iconAnchor: [40, 15],
      });
    };

    // Store Pickup Marker
    const pickupMarker = L.marker([pickupLat, pickupLng], {
      icon: createCustomIcon('#10b981', '🏪 Pickup'),
    }).addTo(map);
    pickupMarker.bindPopup(`<b>${pickupLabel}</b><br/>Lat: ${pickupLat.toFixed(4)}, Lng: ${pickupLng.toFixed(4)}`);

    // Customer Destination Marker
    const destMarker = L.marker([destinationLat, destinationLng], {
      icon: createCustomIcon('#3b82f6', '📍 Destination'),
    }).addTo(map);
    destMarker.bindPopup(`<b>${destinationLabel}</b><br/>Lat: ${destinationLat.toFixed(4)}, Lng: ${destinationLng.toFixed(4)}`);

    const bounds = L.latLngBounds([
      [pickupLat, pickupLng],
      [destinationLat, destinationLng],
    ]);

    // Rider Marker
    if (currentLat !== undefined && currentLat !== null && currentLng !== undefined && currentLng !== null) {
      if (!riderMarkerRef.current) {
        riderMarkerRef.current = L.marker([currentLat, currentLng], {
          icon: createCustomIcon('#f97316', '🛵 Rider (Live)'),
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        riderMarkerRef.current.setLatLng([currentLat, currentLng]);
      }
      bounds.extend([currentLat, currentLng]);
    }

    // Add Route Geometry if present
    if (routeGeometry) {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
      }
      try {
        const geoLayer = L.geoJSON(routeGeometry as any, {
          style: {
            color: '#10b981',
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
          },
        }).addTo(map);
        routeLayerRef.current = geoLayer;
      } catch (err) {
        console.error('Failed to render route geometry', err);
      }
    }

    // Fit map bounds with padding
    map.fitBounds(bounds, { padding: [40, 40] });

    return () => {
      // Map instance kept or cleaned on unmount
    };
  }, [pickupLat, pickupLng, destinationLat, destinationLng, currentLat, currentLng, routeGeometry]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner ${className}`}
      style={{ height }}
    >
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
