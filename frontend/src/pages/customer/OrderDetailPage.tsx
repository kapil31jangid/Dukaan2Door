import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, XCircle, Navigation } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../types/order';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrder = async () => {
    if (!id) return;
    try {
      const data = await customerService.getOrder(parseInt(id, 10));
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchOrder();
  }, [id]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setIsCancelling(true);
    try {
      await customerService.cancelOrder(order.id);
      setIsCancelModalOpen(false);
      fetchOrder(); // Refresh to show CANCELLED status
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading order details…" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/customer/orders')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </button>
        <Alert variant="error">{error || 'Order not found.'}</Alert>
      </div>
    );
  }

  const statusColors = ORDER_STATUS_COLORS[order.status];
  const date = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });

  const isActive = !['DELIVERED', 'REJECTED', 'CANCELLED'].includes(order.status);
  const isOutForDelivery = order.status === 'OUT_FOR_DELIVERY';
  const canCancel = order.status === 'RECEIVED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/customer/orders')} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Orders
        </button>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Order #{order.id}</h1>
        <p className="text-sm text-slate-500 mt-1">Placed on {date}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button
          variant={isActive ? "primary" : "outline"}
          size="lg"
          className="w-full"
          onClick={() => navigate(`/customer/orders/${order.id}/status`)}
        >
          {isActive ? 'Track Progress' : 'View Timeline'}
        </Button>
        
        {isOutForDelivery && (
          <Button
            variant="outline"
            size="lg"
            className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            leftIcon={<Navigation className="w-4 h-4" />}
            onClick={() => navigate(`/customer/orders/${order.id}/tracking`)}
          >
            Live Map Tracking
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" /> Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {order.items.map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                  <p className="text-xs text-slate-500">{item.quantity} × ₹{item.unit_price.toFixed(2)}</p>
                </div>
                <p className="text-sm font-bold text-slate-900">₹{item.subtotal.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-2xl">
            <span className="text-sm font-bold text-slate-700">Total</span>
            <span className="text-lg font-black text-emerald-700">₹{order.total_amount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Address</p>
            <p className="text-sm font-medium text-slate-800">{order.delivery_address}</p>
          </div>
          {order.notes && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Instructions</p>
              <p className="text-sm text-slate-700">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canCancel && (
        <div className="pt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCancelModalOpen(true)}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            leftIcon={<XCircle className="w-4 h-4" />}
          >
            Cancel Order
          </Button>
        </div>
      )}

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isCancelling && setIsCancelModalOpen(false)}
        title="Cancel Order"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to cancel this order? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={() => setIsCancelModalOpen(false)}
            disabled={isCancelling}
          >
            Keep Order
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelOrder}
            isLoading={isCancelling}
          >
            Yes, Cancel Order
          </Button>
        </div>
      </Modal>
    </div>
  );
};
