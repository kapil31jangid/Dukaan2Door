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
import { ActiveDeliveryCard } from '../../components/delivery/ActiveDeliveryCard';
import { DeliveryStatusControls } from '../../components/delivery/DeliveryStatusControls';
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
      // Look for active in-progress order
      const active = orders.find(
        (o) =>
          o.delivery_partner_id === partnerProfile.id &&
          ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'ACCEPTED', 'PREPARING'].includes(o.status)
      ) || orders[0] || null;

      setActiveOrder(active);

      if (active) {
        // If the order has an associated delivery ID
        // The API returns orders; let's fetch the delivery for this order
        try {
          // Deliveries router has GET /api/deliveries/{delivery_id}
          // The order has items and delivery information
          // Let's query delivery via delivery_id if order.delivery is available or by active delivery
          // We can fetch tracking or route
          const targetDeliveryId = active.delivery_id || active.id;
          if (targetDeliveryId) {
            const deliveryData = await deliveryService.getDelivery(targetDeliveryId);
            setActiveDelivery(deliveryData);

            try {
              const routeData = await deliveryService.getRoute(deliveryData.id);
              setRouteInfo(routeData);
            } catch {
              // OSRM route optional fallback
            }
          }
        } catch {
          // If direct ID lookup needed fallback
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
        `[${new Date().toLocaleTimeString()}] ${event.event}: ${JSON.stringify(event.data)}`,
        ...prev.slice(0, 9),
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
      setNotice(`Availability updated: You are now ${updated.is_available ? 'ONLINE (Available for deliveries)' : 'OFFLINE'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle availability');
    } finally {
      setIsTogglingAvail(false);
    }
  };

  const handleUpdateDeliveryStatus = async (status: DeliveryStatus) => {
    if (!activeDelivery) return;
    try {
      const updated = await deliveryService.updateDeliveryStatus(activeDelivery.id, status);
      setActiveDelivery(updated);
      setNotice(`Delivery status updated to: ${status}`);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message || 'Failed to update delivery status');
    }
  };

  const handleLocationUpdated = (lat: number, lng: number) => {
    setCurrentCoords({ lat, lng });
    setNotice(`Broadcasting GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  if (isLoading && !profile) {
    return <Spinner size="lg" label="Connecting to Delivery Partner Network..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Partner Console"
        description={`Partner ID #${profile?.id || ''} • Vehicle: ${profile?.vehicle_info || 'Motorcycle'}`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={loadDashboard}
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

      {/* Profile & Availability Bar */}
      {profile && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div
              className={`w-4 h-4 rounded-full ${
                profile.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <div>
              <p className="text-sm font-extrabold text-slate-900">{profile.name}</p>
              <p className="text-xs text-slate-500">
                Status: <span className={profile.is_available ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>{profile.is_available ? 'ONLINE • Ready to receive orders' : 'OFFLINE'}</span>
              </p>
            </div>
          </div>

          <Button
            variant={profile.is_available ? 'outline' : 'primary'}
            size="sm"
            isLoading={isTogglingAvail}
            onClick={handleToggleAvailability}
            leftIcon={<Power className="w-4 h-4" />}
            className={
              profile.is_available
                ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }
          >
            {profile.is_available ? 'Go Offline' : 'Go Online'}
          </Button>
        </div>
      )}

      {/* Active Delivery Section */}
      {activeDelivery ? (
        <div className="space-y-6">
          {/* Top Route Metrics Card if route is computed */}
          {routeInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Trip Distance
                </span>
                <p className="text-xl font-extrabold text-emerald-900 mt-1">
                  {routeInfo.distance_km.toFixed(2)} km
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                  Est. Travel Time
                </span>
                <p className="text-xl font-extrabold text-blue-900 mt-1">
                  {Math.round(routeInfo.duration_minutes)} mins
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
                    Routing Engine
                  </span>
                  <p className="text-sm font-bold text-purple-900 mt-1">OSRM Navigation</p>
                </div>
                <Route className="w-6 h-6 text-purple-500 shrink-0" />
              </div>
            </div>
          )}

          {/* Interactive Map */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span>Live Route & Navigation Map</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <DeliveryMap
                pickupLat={activeDelivery.pickup_lat}
                pickupLng={activeDelivery.pickup_lng}
                pickupLabel={activeDelivery.pickup_address || 'Merchant Pickup'}
                destinationLat={activeDelivery.destination_lat}
                destinationLng={activeDelivery.destination_lng}
                destinationLabel={activeDelivery.destination_address}
                currentLat={currentCoords?.lat || profile?.current_lat}
                currentLng={currentCoords?.lng || profile?.current_lng}
                routeGeometry={routeInfo?.geometry}
                height="380px"
              />
            </CardContent>
          </Card>

          {/* Delivery Details & Controls Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActiveDeliveryCard delivery={activeDelivery} order={activeOrder} />

            <div className="space-y-6">
              <DeliveryStatusControls
                delivery={activeDelivery}
                onUpdateStatus={handleUpdateDeliveryStatus}
              />

              <PartnerLocationTracker
                deliveryId={activeDelivery.id}
                onLocationUpdated={handleLocationUpdated}
                defaultLat={profile?.current_lat || activeDelivery.pickup_lat}
                defaultLng={profile?.current_lng || activeDelivery.pickup_lng}
              />
            </div>
          </div>

          {/* Real-Time WebSocket Events Terminal Log */}
          {wsEvents.length > 0 && (
            <Card className="border-slate-200 bg-slate-900 text-slate-100">
              <CardHeader className="border-slate-800">
                <CardTitle className="text-xs font-mono text-emerald-400 flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  <span>Real-Time WebSocket Feed (Delivery #{activeDelivery.id})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 font-mono text-[11px] space-y-1.5 max-h-40 overflow-y-auto">
                {wsEvents.map((evt, idx) => (
                  <p key={idx} className="text-slate-300">
                    {evt}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200">
          <Truck className="w-14 h-14 text-slate-300 mx-auto mb-3" />
          <p className="text-lg font-bold text-slate-800">No Active Delivery Assignment</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Keep your status <span className="font-bold text-emerald-600">Online</span>. As soon as a local merchant marks an order ready for pickup within your range, it will appear here.
          </p>
        </Card>
      )}
    </div>
  );
};
