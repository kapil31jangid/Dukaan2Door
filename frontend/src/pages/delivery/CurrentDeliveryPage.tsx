import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, MapPin, Navigation, Package, Phone, Store, Truck } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { Delivery, DeliveryStatus, RouteResponse } from '../../types/delivery';
import { Order } from '../../types/order';
import { DeliveryMap } from '../../components/maps/DeliveryMap';
import { PartnerLocationTracker } from '../../components/delivery/PartnerLocationTracker';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

const steps: Array<{ status: DeliveryStatus; label: string; detail: string }> = [
  { status: 'PICKED_UP', label: 'Picked up', detail: 'Order collected from store' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the way', detail: 'Driving to customer location' },
  { status: 'DELIVERED', label: 'Delivered', detail: 'Order handed to customer' },
];

const statusIndex = (status: DeliveryStatus) => status === 'ASSIGNED' ? -1 : status === 'ACCEPTED' ? -1 : steps.findIndex((step) => step.status === status);

export const CurrentDeliveryPage: React.FC = () => {
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const orders = await deliveryService.getAssignedOrders();
      const active = orders.find((item) => !['DELIVERED', 'CANCELLED'].includes(item.status));
      if (!active?.delivery_id) { setOrder(active || null); setDelivery(null); return; }
      const nextDelivery = await deliveryService.getDelivery(active.delivery_id);
      setOrder(active); setDelivery(nextDelivery);
      try { setRoute(await deliveryService.getRoute(nextDelivery.id)); } catch { setRoute(null); }
    } catch (err: any) { setError(err.message || 'Unable to load current delivery.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, []);

  const updateStatus = async (status: DeliveryStatus) => {
    if (!delivery) return;
    setIsUpdating(true); setError(null);
    try { setDelivery(await deliveryService.updateDeliveryStatus(delivery.id, status)); await load(); }
    catch (err: any) { setError(err.message || 'Unable to update delivery status.'); }
    finally { setIsUpdating(false); }
  };

  if (isLoading) return <Spinner size="lg" label="Loading current delivery..." />;
  if (!delivery || !order) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center"><Truck className="mx-auto h-12 w-12 text-slate-300" /><h1 className="mt-4 text-lg font-extrabold">No current delivery</h1><p className="mt-1 text-sm text-slate-500">Assigned deliveries will appear here when a retailer dispatches one.</p></div>;

  const activeStep = statusIndex(delivery.status);
  const nextAction = delivery.status === 'ASSIGNED' ? { label: 'Accept delivery', status: 'ACCEPTED' as DeliveryStatus } : delivery.status === 'ACCEPTED' ? { label: 'Confirm pickup', status: 'PICKED_UP' as DeliveryStatus } : delivery.status === 'PICKED_UP' ? { label: 'Start route', status: 'OUT_FOR_DELIVERY' as DeliveryStatus } : { label: 'Mark delivered', status: 'DELIVERED' as DeliveryStatus };

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h1 className="text-2xl font-extrabold tracking-tight">Order #{order.id}</h1><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{delivery.status === 'OUT_FOR_DELIVERY' ? 'On the way' : delivery.status.replace(/_/g, ' ')}</span></div><p className="mt-1 text-sm text-slate-500">Keep going! You&apos;re almost there.</p></div><div className="text-right"><p className="text-xs text-slate-500">Estimated arrival</p><p className="mt-1 flex items-center gap-1 text-lg font-black"><Clock3 className="h-4 w-4" />{route?.duration_minutes ? `${Math.max(1, Math.round(route.duration_minutes))} min` : 'Route ready'}</p></div></div>
    {error && <Alert variant="error">{error}</Alert>}

    <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="space-y-6">{steps.map((step, index) => { const complete = activeStep >= index; const current = activeStep === index; return <div key={step.status} className="relative flex gap-3">{index < steps.length - 1 && <span className={`absolute left-[11px] top-7 h-12 w-px ${complete ? 'bg-blue-500' : 'bg-slate-200'}`} />}{complete ? <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckCircle2 className="h-4 w-4" /></span> : <span className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${current ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}><span className={`h-2 w-2 rounded-full ${current ? 'bg-blue-500' : 'bg-slate-200'}`} /></span>}<div><p className={`text-sm font-bold ${complete || current ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p><p className="mt-0.5 text-xs text-slate-500">{step.detail}</p></div></div>; })}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-extrabold">Customer Details</p><div className="mt-4 space-y-3 text-sm"><p className="flex items-start gap-3"><span className="rounded-full bg-slate-100 p-2"><Package className="h-4 w-4 text-slate-600" /></span><span><strong className="block">Customer order</strong><span className="text-slate-500">{order.items.length} item{order.items.length === 1 ? '' : 's'} · ₹{order.total_amount.toFixed(0)}</span></span></p><p className="flex items-start gap-3"><span className="rounded-full bg-slate-100 p-2"><MapPin className="h-4 w-4 text-slate-600" /></span><span className="text-slate-600">{order.delivery_address}</span></p></div><button type="button" disabled className="mt-5 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-600 disabled:opacity-60"><Phone className="h-3.5 w-3.5" />Customer contact unavailable</button></div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="flex items-center gap-2 text-sm font-extrabold"><Navigation className="h-4 w-4 text-blue-600" />Route to customer</p><p className="mt-1 text-xs text-slate-500">Live pickup and drop-off map</p></div><span className="text-xs font-bold text-slate-500">{route?.distance_km ? `${route.distance_km.toFixed(1)} km` : 'Local route'}</span></div><DeliveryMap pickupLat={delivery.pickup_lat} pickupLng={delivery.pickup_lng} pickupLabel={delivery.pickup_address || 'Pickup store'} destinationLat={delivery.destination_lat} destinationLng={delivery.destination_lng} destinationLabel={delivery.destination_address} currentLat={currentCoords?.lat} currentLng={currentCoords?.lng} routeGeometry={route?.geometry} height="460px" /><div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4"><span className="flex items-center gap-2 text-xs text-slate-500"><Store className="h-4 w-4 text-emerald-600" />Order #{order.id} · ₹{order.total_amount.toFixed(0)}</span><Button size="sm" onClick={() => void updateStatus(nextAction.status)} isLoading={isUpdating} rightIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button></div></div>
    </div>

    <PartnerLocationTracker deliveryId={delivery.id} onLocationUpdated={(lat, lng) => setCurrentCoords({ lat, lng })} defaultLat={delivery.pickup_lat} defaultLng={delivery.pickup_lng} pickupLat={delivery.pickup_lat} pickupLng={delivery.pickup_lng} destinationLat={delivery.destination_lat} destinationLng={delivery.destination_lng} routeGeometry={route?.geometry} />
  </div>;
};
