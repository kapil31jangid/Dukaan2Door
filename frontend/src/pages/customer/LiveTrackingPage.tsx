import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { getToken } from '../../services/api';
import { DeliveryWebSocketClient } from '../../services/websocketService';
import { Order } from '../../types/order';
import { Delivery, DeliveryStatus, RouteGeometry, DeliveryTrackingPoint } from '../../types/delivery';
import { DeliveryMap } from '../../components/maps/DeliveryMap';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const LiveTrackingPage: React.FC = () => {
  const { id: orderIdStr } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | undefined>();
  const [currentLocation, setCurrentLocation] = useState<DeliveryTrackingPoint | undefined>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Connecting to rider...');
  
  const wsRef = useRef<DeliveryWebSocketClient | null>(null);

  useEffect(() => {
    if (!orderIdStr) return;
    const orderId = parseInt(orderIdStr, 10);

    const initTracking = async () => {
      try {
        // 1. Fetch order to check if delivery is assigned
        const orderData = await customerService.getOrder(orderId);
        setOrder(orderData);

        if (!orderData.delivery_partner_id) {
          setError('A delivery partner has not been assigned yet.');
          setIsLoading(false);
          return;
        }

        const storedDeliveryId = localStorage.getItem(`d2d_delivery_${orderId}`);
        const deliveryId = orderData.delivery_id || (storedDeliveryId ? parseInt(storedDeliveryId, 10) : undefined);
        
        if (!deliveryId) {
          setError('Delivery assignment details are missing. Please check status page.');
          setIsLoading(false);
          return;
        }

        // 2. Fetch delivery, route, and tracking history
        const [deliveryData, routeData, trackingData] = await Promise.all([
          customerService.getDelivery(deliveryId),
          customerService.getDeliveryRoute(deliveryId),
          customerService.getDeliveryTracking(deliveryId)
        ]);

        setDelivery(deliveryData);
        setRouteGeometry(routeData.geometry);
        if (trackingData.updates.length > 0) {
          setCurrentLocation(trackingData.updates[trackingData.updates.length - 1]);
        }
        
        setStatusText(
          deliveryData.status === 'DELIVERED' 
            ? 'Delivered Successfully!' 
            : 'Live Tracking Active'
        );

        // 3. Connect WebSocket
        if (deliveryData.status !== 'DELIVERED') {
          wsRef.current = new DeliveryWebSocketClient(deliveryId);
          
          wsRef.current.subscribe((evt) => {
            if (evt.event === 'delivery_location_updated') {
              setCurrentLocation({
                id: 0,
                delivery_id: deliveryId,
                latitude: evt.data.latitude,
                longitude: evt.data.longitude,
                recorded_at: evt.data.recorded_at,
                status: evt.data.status,
              });
            } else if (evt.event === 'delivery_status_updated') {
              setDelivery(prev => prev ? { ...prev, status: evt.data.status as DeliveryStatus } : prev);
              if (evt.data.status === 'DELIVERED') {
                setStatusText('Delivered Successfully!');
                wsRef.current?.disconnect();
              }
            } else if (evt.event === 'delivery_completed') {
              setStatusText('Delivered Successfully!');
              setDelivery(prev => prev ? { ...prev, status: 'DELIVERED' as DeliveryStatus } : prev);
              wsRef.current?.disconnect();
            }
          });

          wsRef.current.connect();
        }

        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize live tracking.');
        setIsLoading(false);
      }
    };

    initTracking();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [orderIdStr]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Connecting to live map…" />
      </div>
    );
  }

  if (error || !delivery || !order) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Alert variant="error">{error || 'Live tracking unavailable.'}</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)] -mx-4 sm:mx-0 sm:rounded-2xl overflow-hidden relative border border-slate-200">
      
      {/* Overlay Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(`/customer/orders/${order.id}/status`)}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-sm font-extrabold text-slate-900 leading-tight">
              Order #{order.id}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${delivery.status === 'DELIVERED' ? 'bg-emerald-500' : 'bg-emerald-500 animate-pulse'}`} />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                {statusText}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative z-0">
        <DeliveryMap
          pickupLat={delivery.pickup_lat}
          pickupLng={delivery.pickup_lng}
          destinationLat={delivery.destination_lat}
          destinationLng={delivery.destination_lng}
          currentLat={currentLocation?.latitude}
          currentLng={currentLocation?.longitude}
          routeGeometry={routeGeometry}
        />
      </div>
    </div>
  );
};
