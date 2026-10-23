import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MapPin, Navigation } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { Delivery, DeliveryStatus, DeliveryTrackingPoint, RouteResponse } from '../../types/delivery';
import { Order } from '../../types/order';
import { DeliveryMap } from '../../components/maps/DeliveryMap';
import { PartnerLocationTracker } from '../../components/delivery/PartnerLocationTracker';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { DeliveryWebSocketClient } from '../../services/websocketService';
import {
  bearingDegrees,
  distanceMeters,
  isNewerTrackingPoint,
  routeProgressForCoordinate,
  RouteRefreshSnapshot,
  shouldRefreshRoute,
} from '../../utils/trackingGeometry';

const routePlaybackEnabled = import.meta.env.VITE_ENABLE_ROUTE_PLAYBACK === 'true';
const pickupDwellSeconds = 120;

const steps: Array<{ status: DeliveryStatus; label: string; detail: string }> = [
  { status: 'PICKED_UP', label: 'Picked up', detail: 'Order collected from store' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the way', detail: 'Driving to customer location' },
  { status: 'DELIVERED', label: 'Delivered', detail: 'Order handed to customer' },
];

const statusIndex = (status: DeliveryStatus) => status === 'ASSIGNED' || status === 'ACCEPTED'
  ? -1
  : steps.findIndex((step) => step.status === status);

export const CurrentDeliveryPage: React.FC = () => {
  const mutation = useRef(false);
  const loadInFlight = useRef(false);
  const hasLoadedCurrentDelivery = useRef(false);
  const activeDeliveryId = useRef<number | null>(null);
  const latestLocation = useRef<DeliveryTrackingPoint | null>(null);
  const routeController = useRef<AbortController | null>(null);
  const routeRequestId = useRef(0);
  const lastRouteRequest = useRef<RouteRefreshSnapshot | null>(null);
  const wsRef = useRef<DeliveryWebSocketClient | null>(null);
  const [completedId, setCompletedId] = useState<number | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [currentLocation, setCurrentLocation] = useState<DeliveryTrackingPoint | null>(null);
  const [riderHeading, setRiderHeading] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptLocation = (candidate: DeliveryTrackingPoint) => {
    const previous = latestLocation.current;
    if (!isNewerTrackingPoint(previous, candidate)) return;
    if (previous) {
      const heading = bearingDegrees(
        { lat: previous.latitude, lng: previous.longitude },
        { lat: candidate.latitude, lng: candidate.longitude },
      );
      if (heading != null) setRiderHeading(heading);
    }
    latestLocation.current = candidate;
    setCurrentLocation(candidate);
  };

  const load = async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    try {
      const [orders, profileData] = await Promise.all([
        deliveryService.getAssignedOrders(),
        deliveryService.getProfile(),
      ]);
      const active = orders.find((item) => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(item.status));
      if (!active?.delivery_id) {
        activeDeliveryId.current = null;
        setOrder(active || null);
        setDelivery(null);
        hasLoadedCurrentDelivery.current = true;
        setError(null);
        return;
      }
      const [nextDelivery, tracking] = await Promise.all([
        deliveryService.getDelivery(active.delivery_id),
        deliveryService.getTracking(active.delivery_id),
      ]);
      if (activeDeliveryId.current !== nextDelivery.id) {
        activeDeliveryId.current = nextDelivery.id;
        latestLocation.current = null;
        lastRouteRequest.current = null;
        setRoute(null);
      }
      if (tracking.updates.length > 0) {
        const newest = tracking.updates.reduce((latest, point) => (
          isNewerTrackingPoint(latest, point) ? point : latest
        ));
        acceptLocation(newest);
      } else if (profileData.current_lat != null && profileData.current_lng != null) {
        setCurrentLocation({
          id: 0,
          delivery_id: nextDelivery.id,
          latitude: profileData.current_lat,
          longitude: profileData.current_lng,
          source: 'GPS',
          recorded_at: new Date().toISOString(),
        });
      }
      setOrder(active);
      setDelivery(nextDelivery);
      hasLoadedCurrentDelivery.current = true;
      setError(null);
    } catch (err: any) {
      if (!hasLoadedCurrentDelivery.current) setError(err.message || 'Unable to load current delivery.');
    } finally {
      loadInFlight.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => void load(), 10000);
    const clockTimer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  useEffect(() => {
    if (!delivery?.id || ['DELIVERED', 'CANCELLED'].includes(delivery.status)) return;
    wsRef.current?.disconnect();
    const client = new DeliveryWebSocketClient(delivery.id);
    wsRef.current = client;
    client.subscribe((event) => {
      if (event.event === 'delivery_location_updated' || event.event === 'delivery_location_snapshot') {
        acceptLocation({
          id: event.data.sequence || 0,
          delivery_id: delivery.id,
          latitude: event.data.latitude,
          longitude: event.data.longitude,
          accuracy_m: event.data.accuracy_m,
          source: event.data.source,
          status: event.data.status,
          recorded_at: event.data.recorded_at,
          sequence: event.data.sequence,
          delivery_partner_id: event.data.delivery_partner_id,
        });
      } else if (event.event === 'delivery_status_updated') {
        setDelivery((current) => current ? { ...current, status: event.data.status as DeliveryStatus } : current);
      }
    });
    client.connect();
    return () => {
      client.disconnect();
      if (wsRef.current === client) wsRef.current = null;
    };
  }, [delivery?.id]);

  const isRoutePlayback = currentLocation?.source === 'ROUTE_PLAYBACK';
  useEffect(() => {
    if (!delivery || ['DELIVERED', 'CANCELLED'].includes(delivery.status)) {
      routeController.current?.abort();
      setRoute(null);
      return;
    }
    const canonicalCustomerRoute = isRoutePlayback && delivery.status === 'OUT_FOR_DELIVERY';
    const origin = canonicalCustomerRoute
      ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng }
      : currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined;
    const requestSnapshot: RouteRefreshSnapshot = {
      deliveryId: delivery.id,
      status: delivery.status,
      routeMode: canonicalCustomerRoute ? 'PLAYBACK_CANONICAL' : 'LIVE',
      origin,
      requestedAt: Date.now(),
    };
    const freezeRoute = isRoutePlayback && Boolean(route?.geometry?.coordinates?.length);
    if (!shouldRefreshRoute(lastRouteRequest.current, requestSnapshot, freezeRoute)) return;

    routeController.current?.abort();
    const controller = new AbortController();
    routeController.current = controller;
    const requestId = ++routeRequestId.current;
    lastRouteRequest.current = requestSnapshot;
    setRouteError(null);
    deliveryService.getRoute(delivery.id, origin, controller.signal)
      .then((response) => { if (requestId === routeRequestId.current) setRoute(response); })
      .catch((routeRequestError) => {
        if (routeRequestError?.name !== 'AbortError' && requestId === routeRequestId.current) {
          setRoute(null);
          setRouteError('Road route is temporarily unavailable.');
        }
      });
  }, [currentLocation?.latitude, currentLocation?.longitude, isRoutePlayback, delivery?.id, delivery?.status]);

  useEffect(() => () => {
    routeController.current?.abort();
    wsRef.current?.disconnect();
  }, []);

  const updateStatus = async (status: DeliveryStatus) => {
    if (!delivery || mutation.current) return;
    mutation.current = true;
    setIsUpdating(true);
    setError(null);
    try {
      let updated = await deliveryService.updateDeliveryStatus(delivery.id, status);
      if (status === 'PICKED_UP' && updated.status === 'PICKED_UP') {
        updated = await deliveryService.updateDeliveryStatus(delivery.id, 'OUT_FOR_DELIVERY');
      }
      routeController.current?.abort();
      setRoute(null);
      lastRouteRequest.current = null;
      setDelivery(updated);
      if (status === 'DELIVERED') setCompletedId(order?.id || null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Unable to update delivery status.');
    } finally {
      mutation.current = false;
      setIsUpdating(false);
    }
  };

  const reject = async () => {
    if (!delivery || mutation.current) return;
    mutation.current = true;
    setIsUpdating(true);
    try {
      await deliveryService.rejectDelivery(delivery.id);
      await load();
    } catch {
      setError('Could not reject this request. Refresh and check its current status.');
    } finally {
      mutation.current = false;
      setIsUpdating(false);
    }
  };

  if (isLoading) return <Spinner size="lg" label="Loading current delivery..." />;
  if (!delivery || !order) return <div className="py-14 text-center">
    {error && <Alert variant="error">{error}<button className="ml-2 underline" onClick={() => void load()}>Retry</button></Alert>}
    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
    <h1 className="mt-4 text-xl font-bold">{completedId ? `Order #${completedId} delivered` : 'Ready for your next delivery'}</h1>
    <p className="mt-2 text-sm text-slate-500">{completedId ? 'Delivery completion has been confirmed.' : 'Accept an available request to start a trip.'}</p>
    <Link to="/delivery/orders" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-5 text-sm font-bold text-white">View requests</Link>
  </div>;

  const pickupStage = ['ASSIGNED', 'ACCEPTED'].includes(delivery.status);
  const routeProgress = isRoutePlayback && route?.geometry && currentLocation
    ? routeProgressForCoordinate(route.geometry, {
      lat: currentLocation.latitude,
      lng: currentLocation.longitude,
    }) ?? undefined
    : undefined;
  const distanceToTarget = currentLocation
    ? distanceMeters(
      { lat: currentLocation.latitude, lng: currentLocation.longitude },
      pickupStage
        ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng }
        : { lat: delivery.destination_lat, lng: delivery.destination_lng },
    )
    : Number.POSITIVE_INFINITY;
  const arrivedAtTarget = distanceToTarget <= 20;
  const arrivalAgeSeconds = arrivedAtTarget && currentLocation
    ? Math.max(0, Math.floor((clock - Date.parse(currentLocation.recorded_at)) / 1000))
    : 0;
  const pickupWaitRemaining = delivery.status === 'ACCEPTED'
    ? Math.max(0, pickupDwellSeconds - arrivalAgeSeconds)
    : 0;
  const pickupWindowLabel = `${Math.floor(pickupWaitRemaining / 60)}:${String(pickupWaitRemaining % 60).padStart(2, '0')}`;
  const nextAction = delivery.status === 'ASSIGNED'
    ? { label: 'Accept delivery', status: 'ACCEPTED' as DeliveryStatus }
    : delivery.status === 'ACCEPTED'
      ? { label: arrivedAtTarget && pickupWaitRemaining > 0 ? `Mark picked up · ${pickupWindowLabel}` : 'Mark picked up', status: 'PICKED_UP' as DeliveryStatus }
      : delivery.status === 'OUT_FOR_DELIVERY'
        ? { label: 'Mark delivered', status: 'DELIVERED' as DeliveryStatus }
        : null;
  const nextActionDisabled = isUpdating
    || (routePlaybackEnabled && delivery.status === 'ACCEPTED' && !arrivedAtTarget)
    || (routePlaybackEnabled && delivery.status === 'OUT_FOR_DELIVERY' && !arrivedAtTarget);
  const tripState = delivery.status === 'ACCEPTED'
    ? arrivedAtTarget
      ? pickupWaitRemaining > 0 ? `At pickup · ${pickupWindowLabel} verification window` : 'At pickup · pickup ready'
      : 'Heading to pickup'
    : delivery.status === 'OUT_FOR_DELIVERY'
      ? arrivedAtTarget ? 'Arrived at customer' : 'On the way'
      : delivery.status.replace(/_/g, ' ');
  const activeStep = statusIndex(delivery.status);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-blue-700">ACTIVE DELIVERY</p><h1 className="mt-1 text-2xl font-extrabold">Order #{order.id}</h1></div>
      <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{tripState}</span>
    </div>
    {error && <Alert variant="error">{error}</Alert>}
    {!routePlaybackEnabled && (
      <PartnerLocationTracker deliveryId={delivery.id} deliveryStatus={delivery.status} onLocationUpdated={(lat, lng, accuracyM, recordedAt, heading) => {
        setRiderHeading(heading ?? null);
        setCurrentLocation({ id: 0, delivery_id: delivery.id, latitude: lat, longitude: lng, accuracy_m: accuracyM, recorded_at: recordedAt || new Date().toISOString(), source: 'GPS' });
      }} />
    )}
    {routeError && <Alert variant="error">{routeError}</Alert>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Navigation className="h-4 w-4 text-blue-600" />{pickupStage ? 'Route to pickup store' : 'Route to customer'}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{tripState}</span>
            {route?.distance_km != null && <span>{route.distance_km.toFixed(1)} km · {Math.ceil(route.duration_minutes)} min route estimate</span>}
          </div>
        </div>
        <DeliveryMap pickupLat={delivery.pickup_lat} pickupLng={delivery.pickup_lng} pickupLabel={delivery.pickup_address || 'Pickup store'} destinationLat={delivery.destination_lat} destinationLng={delivery.destination_lng} destinationLabel={delivery.destination_address} currentLat={currentLocation?.latitude} currentLng={currentLocation?.longitude} currentAccuracyM={currentLocation?.accuracy_m} currentHeading={riderHeading} currentSource={currentLocation?.source} currentRouteProgress={routeProgress} animateCurrent={isRoutePlayback} journeyStage={pickupStage ? 'TO_PICKUP' : 'TO_CUSTOMER'} routeGeometry={route?.geometry} height="clamp(320px, 55dvh, 620px)" />
        <div className="space-y-3 border-t border-slate-200 p-4">
          <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{pickupStage ? delivery.pickup_address || order.store_name || 'Pickup store' : order.delivery_address}</p>
          <div className="flex flex-wrap gap-2">
            {delivery.status === 'ASSIGNED' && <Button variant="outline" disabled={isUpdating} onClick={() => void reject()}>Reject request</Button>}
            {nextAction && <Button className="flex-1 bg-blue-700 hover:bg-blue-800" disabled={nextActionDisabled} isLoading={isUpdating} onClick={() => void updateStatus(nextAction.status)} rightIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button>}
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
