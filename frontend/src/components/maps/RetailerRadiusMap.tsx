import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Order } from '../../types/order';

interface RetailerRadiusMapProps {
  storeLat: number;
  storeLng: number;
  storeName: string;
  orders: Order[];
  onSelectOrder?: (order: Order) => void;
  height?: string;
  className?: string;
}

export const RetailerRadiusMap: React.FC<RetailerRadiusMapProps> = ({
  storeLat,
  storeLng,
  storeName,
  orders,
  onSelectOrder,
  height = '360px',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const orderMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const validLat = storeLat || 23.0365;
      const validLng = storeLng || 72.5611;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([validLat, validLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // 1. Store Marker
      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: white;
            padding: 5px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
            border: 2px solid white;
            white-space: nowrap;
          ">
            <span>🏪</span>
            <span>${storeName || 'My Store'}</span>
          </div>
        `,
        iconSize: [120, 32],
        iconAnchor: [60, 16],
      });

      L.marker([validLat, validLng], { icon: storeIcon })
        .addTo(map)
        .bindPopup(`<b>${storeName}</b><br/>Hyperlocal Merchant Hub`);

      // 2. 2km Hyperlocal Express Circle (10 Mins)
      L.circle([validLat, validLng], {
        radius: 2000,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '4, 4',
      }).addTo(map).bindPopup('<b>2 km Express Zone</b><br/>Guaranteed 10-minute delivery radius');

      // 3. 5km Extended Delivery Zone
      L.circle([validLat, validLng], {
        radius: 5000,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.04,
        weight: 1.5,
      }).addTo(map).bindPopup('<b>5 km Maximum Radius</b><br/>Extended hyperlocal delivery zone');

      orderMarkersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {};
  }, [storeLat, storeLng, storeName]);

  // Update order markers dynamically
  useEffect(() => {
    if (!mapInstanceRef.current || !orderMarkersLayerRef.current) return;

    orderMarkersLayerRef.current.clearLayers();
    const bounds = L.latLngBounds([[storeLat || 23.0365, storeLng || 72.5611]]);

    orders.forEach((order) => {
      const lat = order.delivery_lat || (storeLat + (Math.random() - 0.5) * 0.02);
      const lng = order.delivery_lng || (storeLng + (Math.random() - 0.5) * 0.02);

      const statusColors: Record<string, string> = {
        RECEIVED: '#f59e0b',
        ACCEPTED: '#3b82f6',
        PREPARING: '#8b5cf6',
        READY_FOR_PICKUP: '#ec4899',
        OUT_FOR_DELIVERY: '#10b981',
        DELIVERED: '#64748b',
      };

      const color = statusColors[order.status] || '#10b981';

      const orderIcon = L.divIcon({
        className: 'custom-order-pin',
        html: `
          <div style="
            background: ${color};
            color: white;
            padding: 3px 7px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 3px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            border: 1.5px solid white;
            white-space: nowrap;
            cursor: pointer;
          ">
            <span>📦</span>
            <span>#${order.id} • ₹${Math.round(order.total_amount)}</span>
          </div>
        `,
        iconSize: [80, 26],
        iconAnchor: [40, 13],
      });

      const marker = L.marker([lat, lng], { icon: orderIcon }).addTo(orderMarkersLayerRef.current!);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 2px;">
          <b style="font-size: 13px;">Order #${order.id}</b>
          <p style="margin: 3px 0; color: #475569; font-size: 11px;">Status: <b>${order.status}</b></p>
          <p style="margin: 3px 0; color: #16a34a; font-weight: bold; font-size: 12px;">₹${order.total_amount.toFixed(2)}</p>
          <p style="margin: 3px 0; color: #64748b; font-size: 10px;">${order.delivery_address || 'Customer doorstep'}</p>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectOrder) onSelectOrder(order);
      });

      bounds.extend([lat, lng]);
    });

    if (orders.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [orders, storeLat, storeLng, onSelectOrder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`} style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Legend Pill */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl text-[11px] font-bold shadow-md border border-slate-200/80 flex items-center gap-3">
        <div className="flex items-center gap-1 text-emerald-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          <span>2km Express (10m)</span>
        </div>
        <div className="flex items-center gap-1 text-indigo-700">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
          <span>5km Radius</span>
        </div>
      </div>
    </div>
  );
};
