import React, { useState, useEffect } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryWebSocketClient } from '../../services/websocketService';
import { DeliveryPartnerProfile } from '../../types/user';
import { Delivery, DeliveryStatus, RouteResponse } from '../../types/delivery';
import { Order } from '../../types/order';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { DeliveryMap } from '../../components/maps/DeliveryMap';
import { PartnerLocationTracker } from '../../components/delivery/PartnerLocationTracker';
import {
  Truck,
  Power,
  Navigation,
  RefreshCw,
  Route,
  CheckCircle2,
  Clock,
  Radio,
  Phone,
  MapPin,
  Store,
  User,
  ArrowRight,
  ShieldCheck,
  Zap,
  DollarSign,
} from 'lucide-react';

export const DeliveryDashboard: React.FC = () => {
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResponse | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [wsEvents, setWsEvents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingAvail, setIsTogglingAvail] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const partnerProfile = await deliveryService.getProfile();
      setProfile(partnerProfile);
      if (partnerProfile.current_lat && partnerProfile.current_lng) {
        setCurrentCoords({ lat: partnerProfile.current_lat, lng: partnerProfile.current_lng });
      }

      // Fetch assigned orders for this delivery partner
      const orders = await deliveryService.getAssignedOrders();
      const active = orders.find(
        (o) =>
          o.delivery_partner_id === partnerProfile.id &&
          ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'ACCEPTED', 'PREPARING'].includes(o.status)
      ) || orders.find(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED') || null;

      setActiveOrder(active);

      if (active) {
        try {
          const targetDeliveryId = active.delivery_id || active.id;
          if (targetDeliveryId) {
            const deliveryData = await deliveryService.getDelivery(targetDeliveryId);
            setActiveDelivery(deliveryData);

            try {
              const routeData = await deliveryService.getRoute(deliveryData.id);
              setRouteInfo(routeData);
            } catch {
              // Route fallback
            }
          }
        } catch {
          // If direct ID lookup fails
        }
      } else {
        setActiveDelivery(null);
        setRouteInfo(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery partner dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // WebSocket Subscription for Active Delivery
  useEffect(() => {
    if (!activeDelivery) return;

    const wsClient = new DeliveryWebSocketClient(activeDelivery.id);
    wsClient.connect();

    const unsubscribe = wsClient.subscribe((event) => {
      setWsEvents((prev) => [
        `[${new Date().toLocaleTimeString()}] ${event.event}`,
        ...prev.slice(0, 5),
      ]);

      if (event.event === 'delivery_location_updated' && event.data) {
        if (event.data.latitude && event.data.longitude) {
          setCurrentCoords({ lat: event.data.latitude, lng: event.data.longitude });
        }
      }

      if (event.event === 'delivery_status_updated' && event.data) {
        if (event.data.status) {
          setActiveDelivery((prev) => (prev ? { ...prev, status: event.data.status } : null));
        }
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [activeDelivery?.id]);

  const handleToggleAvailability = async () => {
    if (!profile) return;
    setIsTogglingAvail(true);
    try {
      const updated = await deliveryService.updateProfile({
        is_available: !profile.is_available,
      });
      setProfile(updated);
      setNotice(`You are now ${updated.is_available ? 'ONLINE • Receiving Trips' : 'OFFLINE'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update availability');
    } finally {
      setIsTogglingAvail(false);
    }
  };

  const handleUpdateDeliveryStatus = async (status: DeliveryStatus) => {
    if (!activeDelivery) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await deliveryService.updateDeliveryStatus(activeDelivery.id, status);
      setActiveDelivery(updated);
      setNotice(`Trip status updated: ${status.replace(/_/g, ' ')}`);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message || 'Failed to update delivery status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleLocationUpdated = (lat: number, lng: number) => {
    setCurrentCoords({ lat, lng });
    setNotice(`Live location broadcasted: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  if (isLoading && !profile) {
    return <Spinner size="lg" label="Connecting to Rider Fleet..." />;
  }

  const isOnline = profile?.is_available;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Rider Cockpit</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
              ID #{profile?.id}
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">Hyperlocal 10-Minute Dispatch & Navigation Terminal</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDashboard}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

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

      {/* Online / Duty Status Card */}
      {profile && (
        <div className={`p-5 rounded-3xl border transition-all shadow-md ${
          isOnline
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-emerald-600/20'
            : 'bg-slate-900 text-white border-slate-800'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                isOnline ? 'bg-white/20 backdrop-blur-xs text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-amber-300 animate-ping' : 'bg-slate-500'}`} />
                  <p className="text-base font-black tracking-tight">{profile.name}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-bold uppercase">
                    {profile.vehicle_info || 'Bike Rider'}
                  </span>
                </div>
                <p className="text-xs opacity-90 mt-0.5">
                  {isOnline ? 'ONLINE • Looking for nearby Kirana store orders (2km radius)' : 'OFFLINE • Switch on duty to receive delivery dispatches'}
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              isLoading={isTogglingAvail}
              onClick={handleToggleAvailability}
              leftIcon={<Power className="w-4 h-4" />}
              className={`font-black shadow-lg ${
                isOnline
                  ? 'bg-rose-500 hover:bg-rose-600 text-white border-0'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-0'
              }`}
            >
              {isOnline ? 'Go Off Duty' : 'Go On Duty (Start Shifts)'}
            </Button>
          </div>
        </div>
      )}

      {/* Active Trip Workflow */}
      {activeDelivery ? (
        <div className="space-y-6">
          
          {/* Trip Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Trip Target</span>
              <p className="text-lg font-black text-slate-900 mt-1">Order #{activeDelivery.order_id}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Route Distance</span>
              <p className="text-lg font-black text-emerald-900 mt-1">
                {routeInfo?.distance_km ? `${routeInfo.distance_km.toFixed(2)} km` : '1.4 km'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Est. Time</span>
              <p className="text-lg font-black text-blue-900 mt-1">
                {routeInfo?.duration_minutes ? `${Math.round(routeInfo.duration_minutes)} mins` : '6 mins'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Payout / Earnings</span>
              <p className="text-lg font-black text-purple-900 mt-1">₹45.00</p>
            </div>
          </div>

          {/* Interactive OpenStreetMap Navigation */}
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Live Route & GPS Turn-by-Turn Map (OpenStreetMap & OSRM)
                  </CardTitle>
                  <p className="text-[11px] text-slate-500 font-medium">Real-time route calculated from Store to Customer doorstep</p>
                </div>
              </div>
              <Badge variant="info">
                {activeDelivery.status.replace(/_/g, ' ')}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <DeliveryMap
                pickupLat={activeDelivery.pickup_lat || 23.0365}
                pickupLng={activeDelivery.pickup_lng || 72.5611}
                pickupLabel={activeDelivery.pickup_address || 'Kirana Store'}
                destinationLat={activeDelivery.destination_lat || 23.0350}
                destinationLng={activeDelivery.destination_lng || 72.5293}
                destinationLabel={activeDelivery.destination_address || 'Customer House'}
                currentLat={currentCoords?.lat || profile?.current_lat || activeDelivery.pickup_lat}
                currentLng={currentCoords?.lng || profile?.current_lng || activeDelivery.pickup_lng}
                routeGeometry={routeInfo?.geometry}
                height="400px"
              />
            </CardContent>
          </Card>

          {/* Step-by-Step Rider Action Center */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Action Steps Card */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <CardTitle className="text-base font-bold text-slate-900">Fulfillment Progress Actions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Step Buttons */}
                <div className="space-y-2.5">
                  <button
                    onClick={() => handleUpdateDeliveryStatus('ACCEPTED')}
                    disabled={isUpdatingStatus || activeDelivery.status !== 'ASSIGNED'}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      activeDelivery.status === 'ASSIGNED'
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                      <span className="text-xs font-bold">Accept Delivery Assignment</span>
                    </div>
                    {activeDelivery.status !== 'ASSIGNED' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>

                  <button
                    onClick={() => handleUpdateDeliveryStatus('OUT_FOR_DELIVERY')}
                    disabled={isUpdatingStatus || activeDelivery.status !== 'ACCEPTED'}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      activeDelivery.status === 'PICKED_UP'
                        ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                      <span className="text-xs font-bold">Start Route to Customer (Out for Delivery)</span>
                    </div>
                    {activeDelivery.status === 'OUT_FOR_DELIVERY' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>

                  <button
                    onClick={() => handleUpdateDeliveryStatus('DELIVERED')}
                    disabled={isUpdatingStatus || activeDelivery.status === 'DELIVERED'}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      activeDelivery.status === 'DELIVERED'
                        ? 'bg-emerald-600 text-white font-black'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-950 text-white text-xs font-bold flex items-center justify-center">3</span>
                      <span className="text-xs font-black">
                        {activeDelivery.status === 'DELIVERED' ? 'Delivery Completed 🎉' : 'Mark Delivered to Customer'}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Pickup & Drop Details */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Store className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Pickup Store</span>
                      <p className="text-xs font-bold text-slate-900">{activeDelivery.pickup_address || 'Kirana Store Central'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/60">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Delivery Drop-off</span>
                      <p className="text-xs font-bold text-slate-900">{activeDelivery.destination_address || 'Customer doorstep'}</p>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* GPS Location Tracker & WebSocket Feed */}
            <div className="space-y-6">
              <PartnerLocationTracker
                deliveryId={activeDelivery.id}
                onLocationUpdated={handleLocationUpdated}
                defaultLat={profile?.current_lat || activeDelivery.pickup_lat}
                defaultLng={profile?.current_lng || activeDelivery.pickup_lng}
              />

              {wsEvents.length > 0 && (
                <Card className="border-slate-800 bg-slate-950 text-slate-200">
                  <CardHeader className="border-slate-800 py-2.5">
                    <CardTitle className="text-xs font-mono text-emerald-400 flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>Live WebSocket Stream</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 font-mono text-[10px] space-y-1">
                    {wsEvents.map((evt, idx) => (
                      <p key={idx} className="text-slate-400 truncate">{evt}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

          </div>

        </div>
      ) : (
        <Card className="p-14 text-center border-dashed border-2 border-slate-200">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Truck className="w-8 h-8" />
          </div>
          <p className="text-lg font-black text-slate-900">Waiting for New Delivery Trips</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Keep your status <span className="font-black text-emerald-600">Online</span>. As soon as a Kirana merchant prepares an order within your 2km radius, you will be dispatched instantly.
          </p>
        </Card>
      )}

    </div>
  );
};
