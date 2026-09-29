import React, { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Package, ShoppingBag, Store } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { Order } from '../../types/order';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

export const OrderConfirmationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    customerService.getOrder(Number(id))
      .then(setOrder)
      .catch((err: any) => setError(err.message || 'Unable to load the order confirmation.'));
  }, [id]);

  if (error) return <div className="mx-auto max-w-2xl py-10"><Alert variant="error">{error}</Alert></div>;
  if (!order) return <div className="flex justify-center py-20"><Spinner size="lg" label="Loading order confirmation…" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex flex-col items-center px-6 py-10 text-center sm:px-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-9 w-9" aria-hidden="true" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Order received</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Your order is on its way to the store</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">The local store has received order #{order.id}. Follow the live status as the retailer accepts, prepares, and hands it to a delivery partner.</p>
          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" onClick={() => navigate(`/customer/orders/${order.id}/status`)}>Track order</Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/customer/store')}>Continue shopping</Button>
          </div>
        </div>
      </section>

      <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-3">
        <div className="flex items-start gap-3"><Package className="mt-0.5 h-5 w-5 text-violet-600" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order</p><p className="font-bold text-slate-900">#{order.id}</p><p className="text-sm text-slate-500">{order.items.length} item{order.items.length === 1 ? '' : 's'} · ₹{order.total_amount.toFixed(2)}</p></div></div>
        <div className="flex items-start gap-3"><Store className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Store</p><p className="font-bold text-slate-900">{order.store_name || 'Dukaan2Door Local Store'}</p><p className="text-sm text-slate-500">Order status: {order.status.replace(/_/g, ' ')}</p></div></div>
        <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-blue-600" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Delivering to</p><p className="font-semibold text-slate-800">{order.delivery_address}</p></div></div>
      </CardContent></Card>

      <button type="button" onClick={() => navigate('/customer/orders')} className="mx-auto flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"><ShoppingBag className="h-4 w-4" aria-hidden="true" /> View all orders</button>
    </div>
  );
};