import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bike, CheckCircle2, RefreshCw } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryPartnerProfile } from '../../types/user';
import { Order } from '../../types/order';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';

export const DeliveryHomePage: React.FC = () => {
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const [person, list] = await Promise.all([deliveryService.getProfile(), deliveryService.getAssignedOrders()]);
      setProfile(person); setOrders(list); setError('');
    } catch { setError('Your delivery overview could not be loaded. Please retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, []);
  const toggle = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try { setProfile(await deliveryService.updateProfile({ is_available: !profile.is_available })); setError(''); }
    catch { setError('Availability could not be changed. Please try again.'); }
    finally { setSaving(false); }
  };
  if (loading) return <Spinner label="Loading delivery overview..." />;
  const active = orders.filter(order => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(order.status));
  const completed = orders.filter(order => order.status === 'DELIVERED');
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-blue-700">YOUR DELIVERY WORKSPACE</p><h1 className="mt-2 text-2xl font-extrabold">Hello, {profile?.name?.split(' ')[0] || 'partner'}</h1></div><Button variant="outline" aria-label="Refresh overview" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
    {error && <Alert variant="error">{error}</Alert>}
    <section className="flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 bg-white px-4 py-6">
      <div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${profile?.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`} /><div><h2 className="font-bold">{profile ? profile.is_available ? 'You are available' : 'You are unavailable' : 'Availability unknown'}</h2><p className="mt-1 text-sm text-slate-500">{active.length ? 'You have a delivery in progress.' : 'Check nearby requests when you are ready.'}</p></div></div>
      <button role="switch" aria-checked={profile?.is_available || false} aria-label="Available for deliveries" disabled={!profile || saving} onClick={() => void toggle()} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${profile?.is_available ? 'bg-emerald-600' : 'bg-slate-400'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${profile?.is_available ? 'left-7' : 'left-1'}`} /></button>
    </section>
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-5"><Bike className="h-5 w-5 text-blue-600" /><p className="mt-4 text-3xl font-bold">{active.length}</p><p className="mt-1 text-sm text-slate-500">Active deliveries</p></div><div className="rounded-lg border border-slate-200 bg-white p-5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-3xl font-bold">{completed.length}</p><p className="mt-1 text-sm text-slate-500">Completed in recent history</p></div></div>
    <section><h2 className="text-lg font-bold">{active.length ? 'Continue your trip' : 'Ready for a pickup?'}</h2><p className="mt-2 text-sm text-slate-500">{active.length ? `Order #${active[0].id} · ${active[0].status.replace(/_/g, ' ')}` : 'Available requests include pickup and delivery details.'}</p><Link to={active.length ? '/delivery/current' : '/delivery/orders'} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-bold text-white">{active.length ? 'Open active delivery' : 'View delivery requests'}<ArrowRight className="h-4 w-4" /></Link></section>
    <section className="border-t border-slate-200 pt-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent deliveries</h2><Link to="/delivery/history" className="text-sm font-semibold text-blue-700">View history</Link></div>{orders.length ? <ul className="mt-4 divide-y divide-slate-200">{orders.slice(0, 5).map(order => <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm"><span className="font-semibold">Order #{order.id}</span><span className="text-slate-500">{order.status.replace(/_/g, ' ')}</span><span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</span></li>)}</ul> : <p className="py-8 text-sm text-slate-500">Your delivery activity will appear here.</p>}</section>
  </div>;
};
