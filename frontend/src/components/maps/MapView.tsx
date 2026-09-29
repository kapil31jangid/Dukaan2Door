import React, { useEffect, useRef, useState } from 'react';
import mapboxgl, { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import type { RouteGeometry } from '../../types/delivery';

type LineStringGeometry = { type: 'LineString'; coordinates: [number, number][] };
type PolygonFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'Polygon'; coordinates: [number, number][][] } };

import 'mapbox-gl/dist/mapbox-gl.css';

export interface MapCoordinate {
  lat: number;
  lng: number;
}

export interface MapMarker extends MapCoordinate {
  id: string;
  label?: string;
  color?: string;
  kind?: 'pickup' | 'dropoff' | 'rider' | 'store' | 'order' | 'customer';
  draggable?: boolean;
  onClick?: () => void;
  onDragEnd?: (coordinate: MapCoordinate) => void;
}

export interface MapCircle extends MapCoordinate {
  id: string;
  radius: number;
  color: string;
  fillColor?: string;
  fillOpacity?: number;
  lineDasharray?: number[];
}

interface MapViewProps {
  center: MapCoordinate;
  zoom?: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  routeGeometry?: RouteGeometry | null;
  height?: string;
  className?: string;
  interactive?: boolean;
  showControls?: boolean;
  fitToContent?: boolean;
  onMapClick?: (coordinate: MapCoordinate) => void;
  errorMessage?: string;
}

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

function validCoordinate(coordinate: MapCoordinate) {
  return Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng)
    && coordinate.lat >= -90 && coordinate.lat <= 90
    && coordinate.lng >= -180 && coordinate.lng <= 180;
}

function markerColor(marker: MapMarker) {
  if (marker.color) return marker.color;
  if (marker.kind === 'pickup' || marker.kind === 'store') return '#059669';
  if (marker.kind === 'dropoff' || marker.kind === 'customer') return '#ef4444';
  if (marker.kind === 'rider') return '#1677e8';
  return '#334155';
}

function markerElement(marker: MapMarker) {
  const root = document.createElement('div');
  root.className = 'dukaan-map-marker';
  root.style.setProperty('--marker-color', markerColor(marker));

  const dot = document.createElement('span');
  dot.className = 'dukaan-map-marker__dot';
  root.appendChild(dot);

  if (marker.label) {
    const label = document.createElement('span');
    label.className = 'dukaan-map-marker__label';
    label.textContent = marker.label;
    root.appendChild(label);
  }
  return root;
}

export const MapView: React.FC<MapViewProps> = ({
  center,
  zoom = 13,
  markers = [],
  circles = [],
  routeGeometry,
  height = '360px',
  className = '',
  interactive = true,
  showControls = true,
  fitToContent = true,
  onMapClick,
  errorMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, MapboxMarker>>(new Map());
  const circleIdsRef = useRef<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) {
      if (!token) setMapError('Mapbox is not configured. Add VITE_MAPBOX_TOKEN to frontend/.env.');
      return;
    }
    if (!validCoordinate(center)) {
      setMapError('Map coordinates are unavailable.');
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [center.lng, center.lat],
      zoom,
      attributionControl: true,
      cooperativeGestures: false,
      dragPan: interactive,
      scrollZoom: interactive,
    });
    mapRef.current = map;
    if (showControls) map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    map.on('load', () => setIsReady(true));
    map.on('error', (event) => {
      if (event.error?.message) setMapError('The map could not be loaded. Check the Mapbox token and network connection.');
    });
    if (onMapClick) {
      map.on('click', (event) => onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng }));
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    markers.filter(validCoordinate).forEach((markerData) => {
      const marker = new mapboxgl.Marker({ element: markerElement(markerData), draggable: markerData.draggable })
        .setLngLat([markerData.lng, markerData.lat])
        .addTo(map);
      if (markerData.onClick) marker.getElement().addEventListener('click', markerData.onClick);
      if (markerData.onDragEnd) marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        markerData.onDragEnd?.({ lat: lngLat.lat, lng: lngLat.lng });
      });
      markersRef.current.set(markerData.id, marker);
    });

    circleIdsRef.current.forEach((id) => {
      if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
      if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
      if (map.getSource(id)) map.removeSource(id);
    });
    circleIdsRef.current = [];
    circles.filter(validCoordinate).forEach((circle) => {
      const id = `dukaan-circle-${circle.id.replace(/[^a-z0-9-]/gi, '-')}`;
      const sourceData: PolygonFeature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[]] },
      };
      const points = 64;
      const ring = Array.from({ length: points + 1 }, (_, index) => {
        const angle = (index / points) * Math.PI * 2;
        const latOffset = (circle.radius / 111320) * Math.sin(angle);
        const lngOffset = (circle.radius / (111320 * Math.cos(circle.lat * Math.PI / 180))) * Math.cos(angle);
        return [circle.lng + lngOffset, circle.lat + latOffset] as [number, number];
      });
      sourceData.geometry.coordinates = [ring];
      map.addSource(id, { type: 'geojson', data: sourceData });
      map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': circle.fillColor || circle.color, 'fill-opacity': circle.fillOpacity ?? 0.08 } });
      map.addLayer({ id: `${id}-line`, type: 'line', source: id, paint: { 'line-color': circle.color, 'line-width': 2, 'line-dasharray': circle.lineDasharray || [1, 1] } });
      circleIdsRef.current.push(id);
    });
  }, [circles, isReady, markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const sourceId = 'dukaan-route';
    const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (routeGeometry?.coordinates?.length) {
      const data = { type: 'Feature' as const, properties: {}, geometry: routeGeometry as LineStringGeometry };
      if (existing) existing.setData(data);
      else {
        map.addSource(sourceId, { type: 'geojson', data });
        map.addLayer({ id: 'dukaan-route-line', type: 'line', source: sourceId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1677e8', 'line-width': 5, 'line-opacity': 0.85 } });
      }
    } else if (map.getLayer('dukaan-route-line')) {
      map.removeLayer('dukaan-route-line');
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [isReady, routeGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady || !validCoordinate(center)) return;
    if (!fitToContent) {
      map.easeTo({ center: [center.lng, center.lat], duration: 400 });
      return;
    }
    const points = markers.filter(validCoordinate).map((item) => [item.lng, item.lat] as [number, number]);
    if (routeGeometry?.coordinates?.length) points.push(...routeGeometry.coordinates);
    if (!points.length) points.push([center.lng, center.lat]);
    const bounds = points.reduce((result, point) => result.extend(point), new mapboxgl.LngLatBounds(points[0], points[0]));
    map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 450 });
  }, [center, fitToContent, isReady, markers, routeGeometry]);

  const visibleError = errorMessage || mapError;
  return <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner ${className}`} style={{ height }}>
    <div ref={containerRef} className="h-full w-full" />
    {visibleError && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/95 p-6 text-center"><div><p className="font-bold text-slate-800">Map unavailable</p><p className="mt-1 max-w-sm text-sm text-slate-500">{visibleError}</p></div></div>}
  </div>;
};
