import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { OrderStatusTracking } from '../../types/order';
import { OrderStatusTimeline } from '../../components/customer/OrderStatusTimeline';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const OrderStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [tracking, setTracking] = useState<OrderStatusTracking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchStatus = async () => {
      try {
        const data = await customerService.getOrderStatus(parseInt(id, 10));
        setTracking(data);
        setError(null);
      } catch (err: any) {
        if (!tracking) setError(err.message || 'Failed to load order status.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [id, tracking]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading timeline…" />
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/customer/orders')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </button>
        <Alert variant="error">{error || 'Order tracking not found.'}</Alert>
      </div>
    );
  }

  const isOutForDelivery = tracking.current_status === 'OUT_FOR_DELIVERY';
  const isDelivered = tracking.current_status === 'DELIVERED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(`/customer/orders/${id}`)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Order #{id}
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Track Order</h1>
        {isOutForDelivery && (
          <p className="text-sm font-medium text-emerald-700 mt-1">
            Your order is on the way!
          </p>
        )}
        {isDelivered && (
          <p className="text-sm font-medium text-emerald-700 mt-1">
            Delivered successfully. Enjoy!
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <OrderStatusTimeline currentStatus={tracking.current_status} history={tracking.history} />
        </CardContent>
      </Card>

      {isOutForDelivery && (
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-lg shadow-emerald-600/20"
          leftIcon={<Navigation className="w-5 h-5" />}
          onClick={() => navigate(`/customer/orders/${id}/tracking`)}
        >
          Live Track on Map
        </Button>
      )}
    </div>
  );
};
