import React from 'react';
import { Order } from '../../types/order';
import { MapView, MapMarker } from './MapView';

interface RetailerRadiusMapProps {
  storeLat: number;
  storeLng: number;
  storeName: string;
  orders: Order[];
  onSelectOrder?: (order: Order) => void;
  height?: string;
  className?: string;
}

export const RetailerRadiusMap: React.FC<RetailerRadiusMapProps> = ({ storeLat, storeLng, storeName, orders, onSelectOrder, height = '360px', className = '' }) => {
  const markers: MapMarker[] = [{ id: 'store', lat: storeLat, lng: storeLng, label: storeName || 'My Store', kind: 'store' }];
  const statusColors: Record<string, string> = { RECEIVED: '#f59e0b', ACCEPTED: '#3b82f6', PREPARING: '#8b5cf6', READY_FOR_PICKUP: '#ec4899', OUT_FOR_DELIVERY: '#10b981', DELIVERED: '#64748b' };
  orders.forEach((order) => {
    if (order.delivery_lat == null || order.delivery_lng == null) return;
    markers.push({ id: `order-${order.id}`, lat: order.delivery_lat, lng: order.delivery_lng, label: `#${order.id} · ₹${Math.round(order.total_amount)}`, color: statusColors[order.status] || '#10b981', kind: 'order', onClick: () => onSelectOrder?.(order) });
  });
  return <div className={`relative ${className}`}>
    <MapView center={{ lat: storeLat, lng: storeLng }} markers={markers} circles={[{ id: 'express-zone', lat: storeLat, lng: storeLng, radius: 2000, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08 }, { id: 'extended-zone', lat: storeLat, lng: storeLng, radius: 5000, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.04, lineDasharray: [2, 2] }]} height={height} />
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-[11px] font-bold shadow-md backdrop-blur-md"><span className="flex items-center gap-1 text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />2 km</span><span className="flex items-center gap-1 text-indigo-700"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />5 km</span></div>
  </div>;
};
