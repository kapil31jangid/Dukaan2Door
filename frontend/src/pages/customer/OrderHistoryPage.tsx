import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Order, OrderStatus } from '../../types/order';
import { CustomerOrderCard } from '../../components/customer/CustomerOrderCard';
import { EmptyState } from '../../components/customer/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Tabs } from '../../components/ui/Tabs';

export const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setError(null);
      let statusParam: OrderStatus | undefined;
      
      // If we wanted to filter by status on the backend, we would pass statusParam.
      // But the endpoint only takes a single status. Since 'active' means multiple states,
      // it's easier to fetch all and filter on the frontend (or do multiple calls, but let's fetch all).
      const data = await customerService.getOrders({ page_size: 100 });
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchOrders();
  }, []);

  // Poll for updates if on active tab
  useEffect(() => {
    if (activeTab !== 'active') return;
    const interval = setInterval(() => {
      fetchOrders();
    }, 30000); // 30s
    return () => clearInterval(interval);
  }, [activeTab]);

  const activeOrders = orders.filter(
    (o) => !['DELIVERED', 'REJECTED', 'CANCELLED'].includes(o.status)
  );
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');
  const cancelledOrders = orders.filter((o) => ['REJECTED', 'CANCELLED'].includes(o.status));

  let displayedOrders: Order[] = [];
  if (activeTab === 'all') displayedOrders = orders;
  else if (activeTab === 'active') displayedOrders = activeOrders;
  else if (activeTab === 'delivered') displayedOrders = deliveredOrders;
  else if (activeTab === 'cancelled') displayedOrders = cancelledOrders;

  const tabs = [
    { id: 'active', label: 'Active', count: activeOrders.length },
    { id: 'delivered', label: 'Delivered', count: deliveredOrders.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelledOrders.length },
    { id: 'all', label: 'All', count: orders.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Your Orders</h1>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="-mx-4 sm:mx-0 px-4 sm:px-0"
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading orders…" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : displayedOrders.length === 0 ? (
        <EmptyState
          icon={activeTab === 'delivered' ? <CheckCircle2 className="w-8 h-8" /> : <ClipboardList className="w-8 h-8" />}
          title={`No ${activeTab !== 'all' ? activeTab : ''} orders found`}
          description={activeTab === 'active' ? "You don't have any ongoing orders right now." : undefined}
          action={activeTab === 'active' ? { label: 'Start Shopping', onClick: () => navigate('/customer/products') } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {displayedOrders.map((order) => (
            <CustomerOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};
