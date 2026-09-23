import React from 'react';
import { Delivery, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '../../types/delivery';
import { Order } from '../../types/order';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Store, MapPin, Clock, Phone, Navigation } from 'lucide-react';

interface ActiveDeliveryCardProps {
  delivery: Delivery;
  order?: Order | null;
}

export const ActiveDeliveryCard: React.FC<ActiveDeliveryCardProps> = ({ delivery, order }) => {
  const statusColor = DELIVERY_STATUS_COLORS[delivery.status] || DELIVERY_STATUS_COLORS.ASSIGNED;

  return (
    <Card className="border-slate-200">
      <CardHeader className="bg-slate-50/50">
        <div className="flex items-center justify-between w-full">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
              Delivery #{delivery.id}
            </span>
            <CardTitle className="text-base font-extrabold text-slate-900 mt-0.5">
              Order #{delivery.order_id}
            </CardTitle>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
          >
            {DELIVERY_STATUS_LABELS[delivery.status]}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pickup and Destination timeline */}
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {/* Pickup */}
          <div className="relative">
            <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center text-[10px]">
              🏪
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Store Pickup
              </p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">
                {delivery.pickup_address || 'Merchant Store'}
              </p>
              <p className="text-[10px] text-slate-400">
                Lat: {delivery.pickup_lat.toFixed(4)}, Lng: {delivery.pickup_lng.toFixed(4)}
              </p>
            </div>
          </div>

          {/* Destination */}
          <div className="relative">
            <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-[10px]">
              📍
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Customer Destination
              </p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">
                {delivery.destination_address}
              </p>
              <p className="text-[10px] text-slate-400">
                Lat: {delivery.destination_lat.toFixed(4)}, Lng: {delivery.destination_lng.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Assigned at</span>
            <span className="font-semibold text-slate-700">
              {new Date(delivery.assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {delivery.picked_up_at && (
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Picked up at</span>
              <span className="font-semibold text-slate-700">
                {new Date(delivery.picked_up_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Items List if order is loaded */}
        {order && order.items && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2">Package Contents ({order.items.length} items)</p>
            <div className="space-y-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-slate-600">
                  <span>
                    <span className="font-bold text-slate-800">{item.quantity}x</span> {item.product_name}
                  </span>
                  <span className="font-semibold">₹{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-900">
                <span>Total Value</span>
                <span className="text-emerald-700">₹{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
