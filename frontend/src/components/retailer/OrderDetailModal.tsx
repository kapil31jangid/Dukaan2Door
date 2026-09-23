import React from 'react';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../types/order';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  MapPin,
  Clock,
  User,
  ShoppingBag,
  FileText,
  Truck,
  CheckCircle2,
  XCircle,
  ChefHat,
  PackageCheck,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: number, status: any) => Promise<void>;
  onAssignDelivery: (orderId: number) => Promise<void>;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onAssignDelivery,
}) => {
  if (!order) return null;

  const statusColor = ORDER_STATUS_COLORS[order.status] || ORDER_STATUS_COLORS.RECEIVED;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Order #${order.id} Details`} maxWidth="lg">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Current Status</span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mt-1 ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium block">Order Placed</span>
            <span className="text-xs font-semibold text-slate-700 mt-1 block">
              {new Date(order.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Delivery Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Delivery Information
          </h4>
          <div className="p-4 rounded-xl border border-slate-100 bg-white space-y-2">
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Delivery Address:</span>
                <span>{order.delivery_address}</span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Coordinates: {order.delivery_lat.toFixed(4)}, {order.delivery_lng.toFixed(4)}
                </p>
              </div>
            </div>

            {order.notes && (
              <div className="flex items-start gap-2.5 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-100 mt-2">
                <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Customer Notes:</span>
                  <span>{order.notes}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ordered Items Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Order Items ({order.items.length})
          </h4>
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 text-left">Item</th>
                  <th className="px-4 py-2.5 text-center">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{item.product_name}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-800">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">₹{item.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-100">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right">
                    Total Amount:
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-700">
                    ₹{order.total_amount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Workflow Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {order.status === 'RECEIVED' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await onUpdateStatus(order.id, 'REJECTED');
                  onClose();
                }}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  await onUpdateStatus(order.id, 'ACCEPTED');
                  onClose();
                }}
              >
                Accept Order
              </Button>
            </>
          )}

          {order.status === 'ACCEPTED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await onUpdateStatus(order.id, 'PREPARING');
                onClose();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Start Preparing
            </Button>
          )}

          {order.status === 'PREPARING' && (
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await onUpdateStatus(order.id, 'READY_FOR_PICKUP');
                onClose();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Mark Ready for Pickup
            </Button>
          )}

          {order.status === 'READY_FOR_PICKUP' && (
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await onAssignDelivery(order.id);
                onClose();
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Assign Delivery Partner
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
