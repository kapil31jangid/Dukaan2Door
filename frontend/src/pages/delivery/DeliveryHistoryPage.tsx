import React, { useState, useEffect } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { Order } from '../../types/order';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import {
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  PackageCheck,
} from 'lucide-react';

export const DeliveryHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await deliveryService.getAssignedOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
  const activeOrders = orders.filter((o) => o.status !== 'DELIVERED');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery History & Log"
        description="Review all assigned and completed fulfillment runs"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={loadHistory}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
            Completed Trips
          </span>
          <p className="text-3xl font-extrabold text-emerald-900 mt-2">{completedOrders.length}</p>
          <span className="text-[11px] text-emerald-700/80 mt-1 font-medium">Successfully delivered</span>
        </div>

        <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block">
            Total Deliveries Assigned
          </span>
          <p className="text-3xl font-extrabold text-blue-900 mt-2">{orders.length}</p>
          <span className="text-[11px] text-blue-700/80 mt-1 font-medium">Lifetime assignments</span>
        </div>

        <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block">
            Estimated Trip Payouts
          </span>
          <p className="text-3xl font-extrabold text-purple-900 mt-2">
            ₹{(completedOrders.length * 45).toFixed(2)}
          </p>
          <span className="text-[11px] text-purple-700/80 mt-1 font-medium">₹45 base payout / order</span>
        </div>
      </div>

      {/* History Table */}
      {isLoading ? (
        <Spinner size="lg" label="Loading delivery records..." />
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200">
          <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">No deliveries recorded yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Assigned deliveries will automatically appear here.
          </p>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/80 font-bold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5 text-left">Order #</th>
                  <th className="px-5 py-3.5 text-left">Customer Destination</th>
                  <th className="px-5 py-3.5 text-center">Items</th>
                  <th className="px-5 py-3.5 text-right">Order Total</th>
                  <th className="px-5 py-3.5 text-center">Delivery Status</th>
                  <th className="px-5 py-3.5 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-extrabold text-slate-900">#{order.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-1.5 max-w-xs">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-700 truncate">{order.delivery_address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-800">
                      {order.items.length} items
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                      ₹{order.total_amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          order.status === 'DELIVERED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {order.status === 'DELIVERED' ? '✓ Delivered' : order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500 font-medium">
                      {new Date(order.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
