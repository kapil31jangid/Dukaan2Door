import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Search } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setError(null);
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
  const filteredOrders = displayedOrders.filter((order) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${order.id} ${order.store_name || ''} ${order.delivery_address} ${order.items.map((item) => item.product_name).join(' ')}`.toLowerCase().includes(query);
  });

  const tabs = [
    { id: 'active', label: 'Active', count: activeOrders.length },
    { id: 'delivered', label: 'Delivered', count: deliveredOrders.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelledOrders.length },
    { id: 'all', label: 'All', count: orders.length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Your account</p>
        <div className="mt-1 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-slate-800" />
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Your orders</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Follow current deliveries and revisit your local-store orders.</p>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="-mx-4 sm:mx-0 px-4 sm:px-0"
      />

      <label className="relative block max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by order number, item, or store" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
      </label>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading orders…" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={activeTab === 'delivered' ? <CheckCircle2 className="w-8 h-8" /> : <ClipboardList className="w-8 h-8" />}
          title={`No ${activeTab !== 'all' ? activeTab : ''} orders found`}
          description={activeTab === 'active' ? "You don't have any ongoing orders right now." : undefined}
          action={activeTab === 'active' ? { label: 'Start Shopping', onClick: () => navigate('/customer/products') } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <CustomerOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};
