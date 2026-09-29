import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, MapPin, Navigation, Package, Phone, Store, Truck } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { DeliveryWebSocketClient } from '../../services/websocketService';
import { DeliveryTrackingPoint, RouteGeometry } from '../../types/delivery';
import { OrderStatus, OrderStatusTracking } from '../../types/order';
import { OrderStatusTimeline } from '../../components/customer/OrderStatusTimeline';
import { DeliveryMap } from '../../components/maps/DeliveryMap';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const OrderStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tracking, setTracking] = useState<OrderStatusTracking | null>(null);
  const [latestLocation, setLatestLocation] = useState<DeliveryTrackingPoint | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const orderId = parseInt(id, 10);

    const fetchStatus = async () => {
      try {
        const data = await customerService.getOrderStatus(orderId);
        if (!active) return;
        setTracking(data);
        setError(null);
      } catch (err: any) {
        if (active && !tracking) setError(err.message || 'Failed to load order status.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
    // Polling must not restart every time the response changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const deliveryId = tracking?.delivery_id;
    if (!deliveryId) {
      setLatestLocation(null);
      setRouteGeometry(undefined);
      return;
    }

    let active = true;
    const refreshLocation = async () => {
      try {
        const data = await customerService.getDeliveryTracking(deliveryId);
        if (active && data.updates.length > 0) {
          setLatestLocation(data.updates[data.updates.length - 1]);
        }
      } catch {
        // Location may not exist until the partner accepts the delivery.
      }
    };

    customerService.getDeliveryRoute(deliveryId)
      .then((data) => {
        if (active) setRouteGeometry(data.geometry);
      })
      .catch(() => {
        // Pins remain useful when OSRM is temporarily unavailable.
      });
    refreshLocation();
    const locationInterval = window.setInterval(refreshLocation, 2500);

    const socket = new DeliveryWebSocketClient(deliveryId);
    const unsubscribe = socket.subscribe((event) => {
      if (!active) return;
      if (event.event === 'delivery_location_updated') {
        setLatestLocation({
          id: 0,
          delivery_id: deliveryId,
          latitude: event.data.latitude,
          longitude: event.data.longitude,
          accuracy_m: event.data.accuracy_m,
          status: event.data.status,
          recorded_at: event.data.recorded_at,
        });
      }
      if (event.event === 'delivery_status_updated' && event.data.order_status) {
        setTracking((current) => current ? {
          ...current,
          current_status: event.data.order_status as OrderStatus,
          updated_at: event.data.updated_at || current.updated_at,
        } : current);
      }
      if (event.event === 'delivery_completed') {
        setTracking((current) => current ? {
          ...current,
          current_status: 'DELIVERED',
        } : current);
      }
    });
    socket.connect();

    return () => {
      active = false;
      window.clearInterval(locationInterval);
      unsubscribe();
      socket.disconnect();
    };
  }, [tracking?.delivery_id]);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" label="Loading order tracking…" /></div>;
  }

  if (error || !tracking) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/customer/orders')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </button>
        <Alert variant="error">{error || 'Order tracking not found.'}</Alert>
      </div>
    );
  }

  const isOutForDelivery = tracking.current_status === 'OUT_FOR_DELIVERY';
  const isDelivered = tracking.current_status === 'DELIVERED';
  const hasMapCoordinates = [tracking.store_lat, tracking.store_lng, tracking.delivery_lat, tracking.delivery_lng]
    .every((value) => value != null && Number.isFinite(value));
  // Only persisted delivery updates are shown as the rider's live position.
  // The partner profile coordinate may be stale and must not be presented as live GPS.
  const currentLat = latestLocation?.latitude;
  const currentLng = latestLocation?.longitude;
  const hasDriver = tracking.delivery_partner_id != null;
  const storeStageComplete = !['RECEIVED'].includes(tracking.current_status);
  const partnerStageComplete = hasDriver || ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(tracking.current_status);
  const deliveryStageActive = ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(tracking.current_status);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(`/customer/orders/${id}`)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Order #{id}
      </button>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Track Order #{id}</h1>
        <p className="mt-1 text-sm font-medium text-emerald-700">
          {isDelivered ? 'Delivered successfully.' : isOutForDelivery ? 'Your order is on the way.' : 'We are preparing your local delivery.'}
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            { label: 'Store fulfillment', detail: storeStageComplete ? 'Store is processing your order' : 'Waiting for store acceptance', complete: storeStageComplete, icon: Store },
            { label: 'Delivery partner', detail: partnerStageComplete ? (tracking.delivery_partner_name || 'Partner assigned') : 'Partner assigned after pickup is ready', complete: partnerStageComplete, icon: Truck },
            { label: 'Live delivery', detail: deliveryStageActive ? (latestLocation ? 'Latest GPS position received' : 'Route started; awaiting GPS') : 'Live map appears when the order is on the way', complete: deliveryStageActive, icon: Navigation },
          ].map(({ label, detail, complete, icon: Icon }) => (
            <div key={label} className={`rounded-xl border p-3 ${complete ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${complete ? 'text-emerald-600' : 'text-slate-400'}`} />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">{detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="flex items-start gap-3"><Store className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</p><p className="font-bold text-slate-900">{tracking.store_name || 'Dukaan2Door Local Store'}</p></div></div>
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-blue-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivering to</p><p className="font-semibold text-slate-800">{tracking.delivery_address || 'Saved delivery location'}</p></div></div>
          <div className="flex items-start gap-3"><Package className="mt-0.5 h-5 w-5 text-violet-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order total</p><p className="font-bold text-slate-900">₹{(tracking.total_amount || 0).toFixed(2)}</p></div></div>
        </CardContent>
      </Card>

      {tracking.items && tracking.items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">Order details</h2>
              <p className="mt-1 text-sm text-slate-500">Items confirmed by the store</p>
            </div>
            <div className="divide-y divide-slate-100">
              {tracking.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.product_name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.quantity} × ₹{item.unit_price.toFixed(2)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-900">₹{item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-4">
              <span className="text-sm font-bold text-slate-700">Total</span>
              <span className="text-lg font-black text-emerald-700">₹{(tracking.total_amount || 0).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-6"><OrderStatusTimeline currentStatus={tracking.current_status} history={tracking.history} /></CardContent></Card>

      {hasDriver ? (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white"><Truck className="h-5 w-5" /></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Delivery partner</p><p className="font-bold text-slate-950">{tracking.delivery_partner_name || 'Assigned partner'}</p><p className="text-sm text-slate-600">{tracking.delivery_partner_vehicle || 'Vehicle details unavailable'}</p></div>
            </div>
            {tracking.delivery_partner_phone && <a className="inline-flex items-center gap-2 font-bold text-emerald-700" href={`tel:${tracking.delivery_partner_phone}`}><Phone className="h-4 w-4" /> Call partner</a>}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex items-start gap-3 p-5"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-bold text-slate-900">Waiting for store acceptance and driver assignment</p><p className="mt-1 text-sm text-slate-600">This page refreshes automatically. Driver details and live GPS will appear here once a partner accepts the delivery.</p></div></CardContent>
        </Card>
      )}

      {hasMapCoordinates && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Delivery map</h2><p className="text-sm text-slate-500">{latestLocation ? 'Latest partner GPS position' : 'Store to your delivery location'}</p></div>{tracking.delivery_id && <Button variant="outline" size="sm" leftIcon={<Navigation className="h-4 w-4" />} onClick={() => navigate(`/customer/orders/${id}/tracking`)}>Open live map</Button>}</div>
            <DeliveryMap
              pickupLat={tracking.store_lat as number}
              pickupLng={tracking.store_lng as number}
              pickupLabel={tracking.store_name || 'Dukaan2Door Local Store'}
              destinationLat={tracking.delivery_lat as number}
              destinationLng={tracking.delivery_lng as number}
              destinationLabel="Your delivery location"
              currentLat={currentLat}
              currentLng={currentLng}
              currentAccuracyM={latestLocation?.accuracy_m}
              routeGeometry={routeGeometry}
              height="400px"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
