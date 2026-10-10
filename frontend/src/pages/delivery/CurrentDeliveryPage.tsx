import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, MapPin, Navigation, Package, Phone, Store, Truck } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { Delivery, DeliveryStatus, RouteResponse } from '../../types/delivery';
import { Order } from '../../types/order';
import { DeliveryPartnerProfile } from '../../types/user';
import { DeliveryMap } from '../../components/maps/DeliveryMap';
import { PartnerLocationTracker } from '../../components/delivery/PartnerLocationTracker';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { RouteRefreshSnapshot, sampleRouteAtProgress, shouldRefreshRoute } from '../../utils/trackingGeometry';

const demoPlaybackEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ROUTE_PLAYBACK === 'true';
const configuredDemoSeconds = Number(import.meta.env.VITE_DEMO_ROUTE_DURATION_SECONDS || 45);
const demoDurationMs = Math.max(15000, Math.min(180000, configuredDemoSeconds * 1000));

const steps: Array<{ status: DeliveryStatus; label: string; detail: string }> = [
  { status: 'PICKED_UP', label: 'Picked up', detail: 'Order collected from store' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the way', detail: 'Driving to customer location' },
  { status: 'DELIVERED', label: 'Delivered', detail: 'Order handed to customer' },
];

const statusIndex = (status: DeliveryStatus) => status === 'ASSIGNED' ? -1 : status === 'ACCEPTED' ? -1 : steps.findIndex((step) => step.status === status);

export const CurrentDeliveryPage: React.FC = () => {
  const mutation = useRef(false);
  const activeDeliveryId = useRef<number | null>(null);
  const routeController = useRef<AbortController | null>(null);
  const routeRequestId = useRef(0);
  const demoStartedDeliveryId = useRef<number | null>(null);
  const demoProgress = useRef(0);
  const lastRouteRequest = useRef<RouteRefreshSnapshot | null>(null);
  const [completedId, setCompletedId] = useState<number | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracyM?: number; recordedAt?: string; heading?: number | null; source?: 'GPS' | 'DEMO_SIMULATION' | 'LIFECYCLE' } | null>(null);
  const [demoState, setDemoState] = useState<'waiting' | 'playing' | 'arrived' | 'error'>('waiting');
  const [demoRetryKey, setDemoRetryKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [orders, profileData] = await Promise.all([deliveryService.getAssignedOrders(), deliveryService.getProfile()]);
      setProfile(profileData);
      const profileLat = profileData.current_lat;
      const profileLng = profileData.current_lng;
      const active = orders.find((item) => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(item.status));
      if (!active?.delivery_id) { activeDeliveryId.current = null; setOrder(active || null); setDelivery(null); return; }
      const nextDelivery = await deliveryService.getDelivery(active.delivery_id);
      if (activeDeliveryId.current !== nextDelivery.id) {
        activeDeliveryId.current = nextDelivery.id;
        demoStartedDeliveryId.current = null;
        demoProgress.current = 0;
        setDemoState('waiting');
        setCurrentCoords(typeof profileLat === 'number' && Number.isFinite(profileLat) && typeof profileLng === 'number' && Number.isFinite(profileLng)
          ? { lat: profileLat, lng: profileLng }
          : null);
        lastRouteRequest.current = null;
      }
      setOrder(active); setDelivery(nextDelivery);
    } catch (err: any) { setError(err.message || 'Unable to load current delivery.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!delivery || ['DELIVERED', 'CANCELLED'].includes(delivery.status)) {
      routeController.current?.abort();
      setRoute(null);
      return;
    }
    const origin = currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng } : undefined;
    const requestSnapshot = { deliveryId: delivery.id, status: delivery.status, origin, requestedAt: Date.now() };
    const freezeDemoRoute = currentCoords?.source === 'DEMO_SIMULATION' && Boolean(route?.geometry?.coordinates?.length);
    if (!shouldRefreshRoute(lastRouteRequest.current, requestSnapshot, freezeDemoRoute)) return;

    routeController.current?.abort();
    const controller = new AbortController();
    routeController.current = controller;
    const requestId = ++routeRequestId.current;
    lastRouteRequest.current = requestSnapshot;
    deliveryService.getRoute(delivery.id, origin, controller.signal)
      .then((response) => { if (requestId === routeRequestId.current) setRoute(response); })
      .catch((routeError) => {
        if (routeError?.status !== 408 && routeError?.name !== 'AbortError' && requestId === routeRequestId.current) setRoute(null);
      });
  }, [currentCoords?.lat, currentCoords?.lng, delivery?.id, delivery?.status]);

  useEffect(() => () => routeController.current?.abort(), []);

  const demoRouteReady = Boolean(route?.geometry?.coordinates?.length && route.geometry.coordinates.length > 1);
  useEffect(() => {
    if (!demoPlaybackEnabled || !delivery || delivery.status !== 'OUT_FOR_DELIVERY' || !demoRouteReady) return;
    if (demoStartedDeliveryId.current === delivery.id) return;
    demoStartedDeliveryId.current = delivery.id;
    const geometry = route?.geometry;
    if (!geometry) return;
    let cancelled = false;
    let timer: number | null = null;
    const startedAt = Date.now() - demoProgress.current * demoDurationMs;
    let consecutiveFailures = 0;
    setDemoState('playing');

    const sendNextPoint = async () => {
      if (cancelled) return;
      const progress = Math.min(1, (Date.now() - startedAt) / demoDurationMs);
      const point = sampleRouteAtProgress(geometry, progress);
      if (!point) {
        setDemoState('error');
        return;
      }
      try {
        const accepted = await deliveryService.updateLocation(
          delivery.id,
          point.lat,
          point.lng,
          undefined,
          new Date().toISOString(),
          'DEMO_SIMULATION',
        );
        if (cancelled) return;
        if (!Number.isFinite(accepted.latitude) || !Number.isFinite(accepted.longitude)) {
          throw new Error('Tracking response did not include valid coordinates');
        }
        consecutiveFailures = 0;
        demoProgress.current = progress;
        setCurrentCoords({
          lat: accepted.latitude,
          lng: accepted.longitude,
          recordedAt: accepted.recorded_at,
          source: 'DEMO_SIMULATION',
        });
        if (progress >= 1) {
          demoProgress.current = 1;
          setDemoState('arrived');
          return;
        }
        timer = window.setTimeout(() => void sendNextPoint(), 1500);
      } catch {
        if (cancelled) return;
        consecutiveFailures += 1;
        if (consecutiveFailures <= 3) {
          timer = window.setTimeout(() => void sendNextPoint(), consecutiveFailures * 1500);
        } else {
          demoStartedDeliveryId.current = null;
          setDemoState('error');
        }
      }
    };
    void sendNextPoint();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [delivery?.id, delivery?.status, demoRouteReady, demoRetryKey]);

  const retryDemoPlayback = () => {
    demoStartedDeliveryId.current = null;
    demoProgress.current = 0;
    setDemoState('waiting');
    setDemoRetryKey((value) => value + 1);
  };

  const updateStatus = async (status: DeliveryStatus) => {
    if (!delivery || mutation.current) return;
    mutation.current = true;
    setIsUpdating(true); setError(null);
    try { setDelivery(await deliveryService.updateDeliveryStatus(delivery.id, status)); if (status === 'DELIVERED') setCompletedId(order?.id || null); await load(); }
    catch (err: any) { setError(err.message || 'Unable to update delivery status.'); }
    finally { mutation.current = false; setIsUpdating(false); }
  };

  const reject = async () => {
    if (!delivery || mutation.current) return;
    mutation.current = true; setIsUpdating(true);
    try { await deliveryService.rejectDelivery(delivery.id); await load(); }
    catch { setError('Could not reject this request. Refresh and check its current status.'); }
    finally { mutation.current = false; setIsUpdating(false); }
  };

  if (isLoading) return <Spinner size="lg" label="Loading current delivery..." />;
  if (!delivery || !order) return <div className="py-14 text-center">
    {error && <Alert variant="error">{error}<button className="ml-2 underline" onClick={() => void load()}>Retry</button></Alert>}
    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
    <h1 className="mt-4 text-xl font-bold">{completedId ? `Order #${completedId} delivered` : 'Ready for your next delivery'}</h1>
    <p className="mt-2 text-sm text-slate-500">{completedId ? 'Delivery completion has been confirmed.' : 'Accept an available request to start a trip.'}</p>
    <Link to="/delivery/orders" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-5 text-sm font-bold text-white">View requests</Link>
  </div>;
  const pickup = ['ASSIGNED', 'ACCEPTED'].includes(delivery.status);
  const nextAction = delivery.status === 'ASSIGNED' ? { label: 'Accept delivery', status: 'ACCEPTED' as DeliveryStatus } : delivery.status === 'ACCEPTED' ? { label: 'Mark picked up', status: 'PICKED_UP' as DeliveryStatus } : delivery.status === 'PICKED_UP' ? { label: 'Start delivery', status: 'OUT_FOR_DELIVERY' as DeliveryStatus } : delivery.status === 'OUT_FOR_DELIVERY' ? { label: 'Mark delivered', status: 'DELIVERED' as DeliveryStatus } : null;
  const activeStep = statusIndex(delivery.status);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-blue-700">ACTIVE DELIVERY</p><h1 className="mt-1 text-2xl font-extrabold">Order #{order.id}</h1></div>
      <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{delivery.status.replace(/_/g, ' ')}</span>
    </div>
    {error && <Alert variant="error">{error}</Alert>}
    {demoPlaybackEnabled ? (
      <Alert variant={demoState === 'error' ? 'error' : 'info'}>
        {delivery.status !== 'OUT_FOR_DELIVERY'
          ? 'Demo route playback will begin after Start delivery. Device GPS is not required in demo mode.'
          : demoState === 'playing'
            ? 'Demo route playback is active. The customer map receives the same simulated road-route points.'
            : demoState === 'arrived'
              ? 'Demo rider has reached the customer. Mark the delivery as delivered when ready.'
              : demoState === 'error'
                ? <span className="flex flex-wrap items-center gap-2">Demo route playback was interrupted. The last confirmed rider position is preserved.<button type="button" className="font-bold underline" onClick={retryDemoPlayback}>Resume demo route</button></span>
                : 'Preparing demo route playback…'}
      </Alert>
    ) : (
      <PartnerLocationTracker deliveryId={delivery.id} deliveryStatus={delivery.status} onLocationUpdated={(lat, lng, accuracyM, recordedAt, heading) => setCurrentCoords({ lat, lng, accuracyM, recordedAt, heading, source: 'GPS' })} />
    )}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Navigation className="h-4 w-4 text-blue-600" />{pickup ? 'Pickup at store' : 'Deliver to customer'}</h2>
          {route?.distance_km != null && <span className="text-xs text-slate-500">{route.distance_km.toFixed(1)} km · {Math.ceil(route.duration_minutes)} min route estimate</span>}
        </div>
        <DeliveryMap pickupLat={delivery.pickup_lat} pickupLng={delivery.pickup_lng} pickupLabel={delivery.pickup_address || 'Pickup store'} destinationLat={delivery.destination_lat} destinationLng={delivery.destination_lng} destinationLabel={delivery.destination_address} currentLat={currentCoords?.lat} currentLng={currentCoords?.lng} currentAccuracyM={currentCoords?.accuracyM} currentHeading={currentCoords?.heading} currentSource={currentCoords?.source} routeGeometry={route?.geometry} height="clamp(320px, 55dvh, 620px)" />
        <div className="space-y-3 border-t border-slate-200 p-4">
          <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{pickup ? delivery.pickup_address || order.store_name || 'Pickup store' : order.delivery_address}</p>
          <div className="flex flex-wrap gap-2">
            {delivery.status === 'ASSIGNED' && <Button variant="outline" disabled={isUpdating} onClick={() => void reject()}>Reject request</Button>}
            {nextAction && <Button className="flex-1 bg-blue-700 hover:bg-blue-800" isLoading={isUpdating} onClick={() => void updateStatus(nextAction.status)} rightIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button>}
          </div>
        </div>
      </section>
      <aside className="space-y-5">
        <section className="border-b border-slate-200 pb-5">
          <h2 className="text-sm font-bold">Trip progress</h2>
          <ol className="mt-4 space-y-4">{steps.map((step, index) => <li key={step.status} className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${activeStep >= index ? 'text-emerald-600' : 'text-slate-300'}`} /><div><p className="text-sm font-semibold">{step.label}</p><p className="text-xs text-slate-500">{step.detail}</p></div></li>)}</ol>
        </section>
        <section><h2 className="text-sm font-bold">Pickup & drop-off</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-xs text-slate-500">Store</dt><dd className="mt-1 font-semibold">{order.store_name || 'Pickup store'}</dd><dd className="mt-1 text-slate-600">{delivery.pickup_address}</dd></div><div><dt className="text-xs text-slate-500">Customer address</dt><dd className="mt-1 text-slate-600">{order.delivery_address}</dd></div></dl></section>
        <section className="border-t border-slate-200 pt-4"><h2 className="text-sm font-bold">Order contents</h2><ul className="mt-3 space-y-2">{order.items.map(item => <li key={item.id} className="flex gap-2 text-sm"><span className="font-bold">{item.quantity} ×</span>{item.product_name}</li>)}</ul><p className="mt-4 text-xs text-slate-500">Order value: ₹{order.total_amount.toFixed(2)}</p></section>
      </aside>
    </div>
  </div>;
};
