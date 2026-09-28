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
import { AssignDeliveryPartnerModal } from '../../components/retailer/AssignDeliveryPartnerModal';
import { StoreStatusToggle } from '../../components/retailer/StoreStatusToggle';
import { RetailerRadiusMap } from '../../components/maps/RetailerRadiusMap';
import {
  ShoppingBag,
  Clock,
  PackageCheck,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Store,
  MapPin,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

export const RetailerDashboard: React.FC = () => {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
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
      setActionNotice(`Order #${orderId} marked as ${targetStatus}`);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    }
  };

  const handleAssignDelivery = async (orderId: number) => {
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      setDispatchOrder(target);
    }
  };

  const handleDispatched = async (orderId: number, partnerName?: string) => {
    setActionNotice(`Rider dispatched for Order #${orderId} (${partnerName || 'Assigned Rider'})!`);
    await loadData();
  };

  // Metrics
  const newOrdersCount = orders.filter((o) => o.status === 'RECEIVED').length;
  const preparingCount = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length;
  const readyCount = orders.filter((o) => o.status === 'READY_FOR_PICKUP').length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const actionableOrders = orders.filter((o) =>
    ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(o.status)
  );

  if (isLoading && !store) {
    return <Spinner size="lg" label="Loading merchant console..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={store ? store.store_name : 'Merchant Dashboard'}
        description={`Store ID #${store?.id || ''} • ${store?.address || 'Ahmedabad Hub'}`}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/retailer/inventory')}
            leftIcon={<Layers className="w-3.5 h-3.5" />}
          >
            Manage Catalog
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </PageHeader>

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
            setActionNotice(`Store status updated: ${updated.is_open ? 'Open for Orders' : 'Closed'}`);
          }}
        />
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-black uppercase tracking-wider">New Incoming</span>
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-amber-950 mt-2">{newOrdersCount}</p>
          <span className="text-[11px] text-amber-700 font-medium">Requires instant acceptance</span>
        </div>

        <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col justify-between shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-black uppercase tracking-wider">In Packing</span>
            <ShoppingBag className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-indigo-950 mt-2">{preparingCount}</p>
          <span className="text-[11px] text-indigo-700 font-medium">Preparing in store</span>
        </div>

        <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col justify-between shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-black uppercase tracking-wider">Ready for Pickup</span>
            <PackageCheck className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-purple-950 mt-2">{readyCount}</p>
          <span className="text-[11px] text-purple-700 font-medium">Assign delivery rider</span>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-black uppercase tracking-wider">Completed Orders</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-emerald-950 mt-2">{deliveredCount}</p>
          <span className="text-[11px] text-emerald-700 font-black">
            ₹{Math.round(totalRevenue)} GMV
          </span>
        </div>
      </div>

      {/* Hyperlocal Live Radius Map Section */}
      {store && (
        <Card className="border-slate-200 overflow-hidden shadow-xs">
          <CardHeader className="bg-slate-50/60 border-b border-slate-100 flex flex-row items-center justify-between py-3.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Hyperlocal Delivery Zone & Live Order Pins (OpenStreetMap)
                </CardTitle>
                <p className="text-[11px] text-slate-500 font-medium">
                  Green circle: 2km (10-minute guarantee) • Indigo circle: 5km max range
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {actionableOrders.length} Active Orders
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <RetailerRadiusMap
              storeLat={store.lat || 23.0365}
              storeLng={store.lng || 72.5611}
              storeName={store.store_name}
              orders={actionableOrders}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              height="340px"
            />
          </CardContent>
        </Card>
      )}

      {/* Actionable Orders Pipeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Live Order Fulfillment Queue</h2>
            <p className="text-xs text-slate-500 font-medium">Orders requiring immediate packing, pickup, or dispatch</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/retailer/orders')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            All Order History ({orders.length})
          </Button>
        </div>

        {actionableOrders.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-2 border-slate-200">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-800">All caught up! No active pending orders</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              When nearby customers place an order from your Kirana catalog, it will appear here in real time.
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

      {/* Dispatch Modal */}
      <AssignDeliveryPartnerModal
        order={dispatchOrder}
        isOpen={!!dispatchOrder}
        onClose={() => setDispatchOrder(null)}
        onAssigned={handleDispatched}
      />
    </div>
  );
};
