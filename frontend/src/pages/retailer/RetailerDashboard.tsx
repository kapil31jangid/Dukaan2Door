import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { retailerService } from '../../services/retailerService';
import { StoreProfile } from '../../types/user';
import { Order, OrderStatus } from '../../types/order';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { OrderCard } from '../../components/retailer/OrderCard';
import { OrderDetailModal } from '../../components/retailer/OrderDetailModal';
import { StoreStatusToggle } from '../../components/retailer/StoreStatusToggle';
import {
  ShoppingBag,
  Clock,
  PackageCheck,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Store,
} from 'lucide-react';

export const RetailerDashboard: React.FC = () => {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [storeData, ordersData] = await Promise.all([
        retailerService.getStore(),
        retailerService.getOrders(undefined, 1, 50),
      ]);
      setStore(storeData);
      setOrders(ordersData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch store dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (orderId: number, targetStatus: OrderStatus) => {
    try {
      const updated = await retailerService.updateOrderStatus(orderId, targetStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setActionNotice(`Order #${orderId} moved to ${targetStatus}`);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    }
  };

  const handleAssignDelivery = async (orderId: number) => {
    try {
      const result = await retailerService.assignDelivery(orderId);
      if (result.assigned) {
        setActionNotice(`Delivery partner successfully assigned! Distance: ${result.distance_km?.toFixed(2)} km`);
      } else {
        setActionNotice(result.reason || 'No available delivery partner found nearby.');
      }
      // Refresh order list to reflect updated delivery status
      const refreshedOrders = await retailerService.getOrders(undefined, 1, 50);
      setOrders(refreshedOrders);
    } catch (err: any) {
      setError(err.message || 'Failed to assign delivery partner');
    }
  };

  // Metrics calculated directly from live DB orders
  const newOrdersCount = orders.filter((o) => o.status === 'RECEIVED').length;
  const preparingCount = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length;
  const readyCount = orders.filter((o) => o.status === 'READY_FOR_PICKUP').length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + o.total_amount, 0);

  // Filter urgent / actionable orders
  const actionableOrders = orders.filter((o) =>
    ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status)
  );

  if (isLoading && !store) {
    return <Spinner size="lg" label="Loading merchant dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={store ? store.store_name : 'Merchant Dashboard'}
        description={`Store ID #${store?.id || ''} • Operating hours: ${store?.operating_hours || '08:00 - 22:00'}`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Data
        </Button>
      </PageHeader>

      {/* Notifications / Alerts */}
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {actionNotice && (
        <Alert variant="success" onDismiss={() => setActionNotice(null)}>
          {actionNotice}
        </Alert>
      )}

      {/* Top Banner: Store status toggle card */}
      {store && (
        <StoreStatusToggle
          store={store}
          onUpdated={(updated) => {
            setStore(updated);
            setActionNotice(`Store status updated: ${updated.is_open ? 'Open' : 'Closed'}`);
          }}
        />
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">New Incoming</span>
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-3xl font-extrabold text-amber-900 mt-2">{newOrdersCount}</p>
          <span className="text-[11px] text-amber-700/80 mt-1 font-medium">Requires approval</span>
        </div>

        <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-bold uppercase tracking-wider">In Preparation</span>
            <ShoppingBag className="w-5 h-5" />
          </div>
          <p className="text-3xl font-extrabold text-indigo-900 mt-2">{preparingCount}</p>
          <span className="text-[11px] text-indigo-700/80 mt-1 font-medium">Packing & Kitchen</span>
        </div>

        <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-bold uppercase tracking-wider">Ready for Pickup</span>
            <PackageCheck className="w-5 h-5" />
          </div>
          <p className="text-3xl font-extrabold text-purple-900 mt-2">{readyCount}</p>
          <span className="text-[11px] text-purple-700/80 mt-1 font-medium">Assign delivery</span>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Completed Orders</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-900 mt-2">{deliveredCount}</p>
          <span className="text-[11px] text-emerald-700/80 mt-1 font-semibold">
            ₹{totalRevenue.toFixed(2)} Revenue
          </span>
        </div>
      </div>

      {/* Actionable Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Active & Incoming Orders</h2>
            <p className="text-xs text-slate-500">Orders currently requiring action or fulfillment</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/retailer/orders')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            View All Orders
          </Button>
        </div>

        {actionableOrders.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-2 border-slate-200">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No active pending orders</p>
            <p className="text-xs text-slate-400 mt-0.5">
              New customer orders assigned to your store will show up here automatically.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actionableOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onAssignDelivery={handleAssignDelivery}
                onViewDetails={(ord) => setSelectedOrder(ord)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateStatus}
        onAssignDelivery={handleAssignDelivery}
      />
    </div>
  );
};
