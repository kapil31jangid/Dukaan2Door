import React, { useEffect, useState } from 'react';
import { ArrowRight, Bike, MapPin, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryService } from '../../services/deliveryService';
import { Order } from '../../types/order';
import { RouteResponse } from '../../types/delivery';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { DeliveryMap } from '../../components/maps/DeliveryMap';

export const AvailableOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [claimingOrderId, setClaimingOrderId] = useState<number | null>(null);

  const load = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [nextOrders, nextAvailableOrders] = await Promise.all([
        deliveryService.getAssignedOrders(),
        deliveryService.getAvailableOrders(),
      ]);
      setOrders(nextOrders);
      setAvailableOrders(nextAvailableOrders);
      const first = nextOrders.find((order) => order.delivery_id);
      if (first?.delivery_id) {
        try { setRoute(await deliveryService.getRoute(first.delivery_id)); } catch { setRoute(null); }
      } else setRoute(null);
      setError(null);
    }
    catch (err: any) { setError(err.message || 'Unable to load assigned deliveries.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(false), 10000); return () => window.clearInterval(timer); }, []);

  const claimOrder = async (orderId: number) => {
    setClaimingOrderId(orderId);
    setError(null);
    try {
      await deliveryService.claimAvailableOrder(orderId);
      navigate('/delivery/current');
    } catch (err: any) {
      setError(err.message || 'This order could not be claimed. Refresh and try again.');
    } finally {
      setClaimingOrderId(null);
    }
  };

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-extrabold tracking-tight">Available Orders</h1><p className="mt-1 text-sm text-slate-500">Choose an assigned delivery and start your trip.</p></div><Button variant="outline" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button></div>
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-slate-500" />Ready orders near you</span><span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{availableOrders.length} available · {orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length} active</span></div>
    {error && <Alert variant="error">{error}</Alert>}
    {isLoading ? <Spinner size="lg" label="Loading available deliveries..." /> : orders.length === 0 && availableOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center"><ShoppingBag className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 font-bold">No delivery orders nearby</h2><p className="mt-1 text-sm text-slate-500">Ready orders will appear here for you to claim.</p></div> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]"><div className="space-y-3">{availableOrders.map((order) => <div key={`available-${order.id}`} className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold text-rose-500">READY FOR PICKUP</span><h2 className="mt-2 text-lg font-extrabold">Order #{order.id}</h2><p className="mt-1 text-sm text-slate-500">{order.items.length} item{order.items.length === 1 ? '' : 's'} · pickup at {order.store_name || 'local store'}</p></div><span className="text-base font-extrabold">₹{order.total_amount.toFixed(0)}</span></div><div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600"><p className="flex items-center gap-2"><Package className="h-4 w-4 text-slate-400" />{order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')}</p><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{order.delivery_address}</p></div><Button className="mt-4 w-full" onClick={() => void claimOrder(order.id)} isLoading={claimingOrderId === order.id} rightIcon={<ArrowRight className="h-4 w-4" />}>Accept Order</Button></div>)}{orders.map((order) => <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold text-blue-600">ASSIGNED TO YOU</span><h2 className="mt-2 text-lg font-extrabold">Order #{order.id}</h2><p className="mt-1 text-sm text-slate-500">{order.items.length} item{order.items.length === 1 ? '' : 's'} · pickup at {order.store_name || 'local store'}</p></div><span className="text-base font-extrabold">₹{order.total_amount.toFixed(0)}</span></div><Button className="mt-4 w-full" onClick={() => navigate('/delivery/current')} rightIcon={<ArrowRight className="h-4 w-4" />}>Open Delivery</Button></div>)}</div><div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white xl:block"><div className="border-b border-slate-100 px-4 py-3"><p className="text-sm font-extrabold">Nearby delivery map</p><p className="text-xs text-slate-500">Pickup and drop-off for your assigned order</p></div>{(() => { const order = orders.find((item) => item.delivery_id) || availableOrders[0] || orders[0]; if (!order) return null; const pickupLat = route?.pickup_lat ?? order.store_lat; const pickupLng = route?.pickup_lng ?? order.store_lng; if (pickupLat == null || pickupLng == null) return <div className="flex min-h-[420px] items-center justify-center text-center text-sm text-slate-500"><div><Bike className="mx-auto h-12 w-12 text-blue-500" /><p className="mt-3 font-bold">Map coordinates unavailable</p></div></div>; return <DeliveryMap pickupLat={pickupLat} pickupLng={pickupLng} pickupLabel={order.store_name || 'Pickup'} destinationLat={route?.destination_lat ?? order.delivery_lat} destinationLng={route?.destination_lng ?? order.delivery_lng} destinationLabel={order.delivery_address} routeGeometry={route?.geometry} height="420px" />; })()}</div></div>}
  </div>;
};
