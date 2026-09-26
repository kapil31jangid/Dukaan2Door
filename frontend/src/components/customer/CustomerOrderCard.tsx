import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import { Order } from '../../types/order';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../types/order';

interface CustomerOrderCardProps {
  order: Order;
}

export const CustomerOrderCard: React.FC<CustomerOrderCardProps> = ({ order }) => {
  const navigate = useNavigate();
  const statusColors = ORDER_STATUS_COLORS[order.status];
  const statusLabel = ORDER_STATUS_LABELS[order.status];
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card
      className="hover:shadow-md transition-all cursor-pointer"
      onClick={() => navigate(`/customer/orders/${order.id}`)}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Order #{order.id}</p>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{date}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{order.delivery_address}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm font-bold text-emerald-700">₹{order.total_amount.toFixed(2)}</p>
            <p className="text-xs text-slate-400">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
      </div>
    </Card>
  );
};
