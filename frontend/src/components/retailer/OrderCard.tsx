import React, { useState } from 'react';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../types/order';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  ChefHat,
  PackageCheck,
  Truck,
  Eye,
  ShoppingBag,
} from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: number, status: any) => Promise<void>;
  onAssignDelivery: (orderId: number) => Promise<void>;
  onViewDetails: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onUpdateStatus,
  onAssignDelivery,
  onViewDetails,
}) => {
  const [isActing, setIsActing] = useState(false);
  const statusColor = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.RECEIVED;

  const handleAction = async (actionFn: () => Promise<void>) => {
    setIsActing(true);
    try {
      await actionFn();
    } finally {
      setIsActing(false);
    }
  };

  const formattedDate = new Date(order.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="hover:shadow-md transition-all border-slate-200">
      <CardContent className="p-5">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900">Order #{order.id}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Total</span>
            <span className="text-base font-bold text-slate-900">₹{order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Address */}
        <div className="py-2.5 flex items-start gap-2 text-xs text-slate-600 border-b border-slate-100">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span className="truncate">{order.delivery_address}</span>
        </div>

        {/* Order Items Snippet */}
        <div className="py-3 space-y-1.5 border-b border-slate-100">
          {order.items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-700 font-medium">
                <span className="font-bold text-slate-900">{item.quantity}x</span> {item.product_name}
              </span>
              <span className="text-slate-500 font-semibold">₹{item.subtotal.toFixed(2)}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-[11px] text-slate-400 italic font-medium">
              +{order.items.length - 3} more items
            </p>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="py-2 text-[11px] text-amber-700 bg-amber-50/70 rounded-lg px-2.5 my-2 border border-amber-100">
            <span className="font-semibold">Note:</span> {order.notes}
          </div>
        )}

        {/* Action Buttons based on lifecycle */}
        <div className="pt-4 flex items-center justify-between gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(order)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            Details
          </Button>

          <div className="flex items-center gap-2">
            {order.status === 'RECEIVED' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isActing}
                  onClick={() => handleAction(() => onUpdateStatus(order.id, 'REJECTED'))}
                  leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
                  className="text-rose-600 hover:bg-rose-50 border-rose-200"
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isActing}
                  onClick={() => handleAction(() => onUpdateStatus(order.id, 'ACCEPTED'))}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Accept Order
                </Button>
              </>
            )}

            {order.status === 'ACCEPTED' && (
              <Button
                variant="primary"
                size="sm"
                isLoading={isActing}
                onClick={() => handleAction(() => onUpdateStatus(order.id, 'PREPARING'))}
                leftIcon={<ChefHat className="w-3.5 h-3.5" />}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Start Preparing
              </Button>
            )}

            {order.status === 'PREPARING' && (
              <Button
                variant="primary"
                size="sm"
                isLoading={isActing}
                onClick={() => handleAction(() => onUpdateStatus(order.id, 'READY_FOR_PICKUP'))}
                leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Ready for Pickup
              </Button>
            )}

            {order.status === 'READY_FOR_PICKUP' && (
              <Button
                variant="primary"
                size="sm"
                isLoading={isActing}
                onClick={() => handleAction(() => onAssignDelivery(order.id))}
                leftIcon={<Truck className="w-3.5 h-3.5" />}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Assign Delivery Partner
              </Button>
            )}

            {order.status === 'OUT_FOR_DELIVERY' && (
              <Badge variant="warning" size="md">
                🛵 Out for Delivery
              </Badge>
            )}

            {order.status === 'DELIVERED' && (
              <Badge variant="success" size="md">
                ✓ Delivered
              </Badge>
            )}

            {(order.status === 'REJECTED' || order.status === 'CANCELLED') && (
              <Badge variant="danger" size="md">
                {order.status}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
