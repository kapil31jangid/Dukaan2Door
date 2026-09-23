import React, { useState, useEffect } from 'react';
import { retailerService } from '../../services/retailerService';
import { Order, OrderStatus } from '../../types/order';
import { PageHeader } from '../../components/layout/PageHeader';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { OrderCard } from '../../components/retailer/OrderCard';
import { OrderDetailModal } from '../../components/retailer/OrderDetailModal';
import { Search, Filter, RefreshCw, ShoppingBag } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const RetailerOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await retailerService.getOrders(undefined, 1, 100);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId: number, targetStatus: OrderStatus) => {
    try {
      const updated = await retailerService.updateOrderStatus(orderId, targetStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setNotice(`Order #${orderId} moved to ${targetStatus}`);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    }
  };

  const handleAssignDelivery = async (orderId: number) => {
    try {
      const res = await retailerService.assignDelivery(orderId);
      if (res.assigned) {
        setNotice(`Delivery partner assigned! Distance: ${res.distance_km?.toFixed(2)} km`);
      } else {
        setNotice(res.reason || 'No available delivery partner found nearby.');
      }
      await fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to assign delivery partner');
    }
  };

  // Tab definitions with dynamic live counts
  const tabs: TabItem[] = [
    { id: 'all', label: 'All Orders', count: orders.length },
    { id: 'RECEIVED', label: 'New', count: orders.filter((o) => o.status === 'RECEIVED').length },
    {
      id: 'PREPARING',
      label: 'Preparing',
      count: orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length,
    },
    {
      id: 'READY_FOR_PICKUP',
      label: 'Ready for Pickup',
      count: orders.filter((o) => o.status === 'READY_FOR_PICKUP').length,
    },
    {
      id: 'OUT_FOR_DELIVERY',
      label: 'Out for Delivery',
      count: orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
    },
    {
      id: 'DELIVERED',
      label: 'Delivered',
      count: orders.filter((o) => o.status === 'DELIVERED').length,
    },
    {
      id: 'TERMINAL',
      label: 'Rejected/Cancelled',
      count: orders.filter((o) => o.status === 'REJECTED' || o.status === 'CANCELLED').length,
    },
  ];

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    // Tab match
    let matchTab = true;
    if (activeTab === 'RECEIVED') matchTab = order.status === 'RECEIVED';
    else if (activeTab === 'PREPARING')
      matchTab = order.status === 'ACCEPTED' || order.status === 'PREPARING';
    else if (activeTab === 'READY_FOR_PICKUP') matchTab = order.status === 'READY_FOR_PICKUP';
    else if (activeTab === 'OUT_FOR_DELIVERY') matchTab = order.status === 'OUT_FOR_DELIVERY';
    else if (activeTab === 'DELIVERED') matchTab = order.status === 'DELIVERED';
    else if (activeTab === 'TERMINAL')
      matchTab = order.status === 'REJECTED' || order.status === 'CANCELLED';

    // Search query match
    let matchSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      matchSearch =
        order.id.toString().includes(q) ||
        order.delivery_address.toLowerCase().includes(q) ||
        order.items.some((it) => it.product_name.toLowerCase().includes(q));
    }

    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Management"
        description="Track and manage the full lifecycle of orders received by your store"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
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

      {notice && (
        <Alert variant="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by order #, address, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Orders Grid */}
      {isLoading ? (
        <Spinner size="lg" label="Loading orders..." />
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">No orders found</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? 'Try changing your search query or clear filters.'
              : 'There are no orders matching the selected tab.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
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
