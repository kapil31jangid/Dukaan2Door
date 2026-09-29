import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bike, CheckCircle2, ChevronRight, Clock3, MapPin, RefreshCw, ShoppingBag, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryPartnerProfile } from '../../types/user';
import { Order } from '../../types/order';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

export const DeliveryHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const [profileData, orderData] = await Promise.all([deliveryService.getProfile(), deliveryService.getAssignedOrders()]);
      setProfile(profileData); setOrders(orderData);
    } finally { setIsLoading(false); }
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, []);

  const completed = orders.filter((order) => order.status === 'DELIVERED');
  const active = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status));
  const todayEarnings = completed.length * 45;
  const recent = useMemo(() => orders.slice(0, 4), [orders]);

  if (isLoading && !profile) return <Spinner size="lg" label="Loading delivery dashboard..." />;

  return <div className="space-y-7">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">Good morning, {profile?.name?.split(' ')[0] || 'Rider'}! <span aria-hidden="true">👋</span></h1><p className="mt-1 text-sm text-slate-500">Ready to make deliveries today?</p></div><Button variant="outline" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Today's Earnings", value: `₹${todayEarnings}`, note: '+12% vs. yesterday', icon: Wallet, iconClass: 'bg-emerald-50 text-emerald-600' },
        { label: 'Completed Deliveries', value: completed.length, note: '+2 vs. yesterday', icon: CheckCircle2, iconClass: 'bg-cyan-50 text-cyan-600' },
        { label: 'Active Orders', value: active.length, note: active.length ? 'On the way' : 'No active orders', icon: ShoppingBag, iconClass: 'bg-blue-50 text-blue-600' },
        { label: 'Total Online Time', value: profile?.is_available ? 'Online' : 'Offline', note: 'Availability status', icon: Clock3, iconClass: 'bg-amber-50 text-amber-600' },
      ].map(({ label, value, note, icon: Icon, iconClass }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}><Icon className="h-4 w-4" /></span></div><p className="mt-2 text-[11px] font-semibold text-emerald-600">{note}</p></div>)}
    </div>

    <section className="relative overflow-hidden rounded-xl bg-[#dceeff] px-6 py-6 sm:px-9"><div className="max-w-xl"><p className="text-xl font-extrabold text-slate-900">More deliveries. More earnings.</p><p className="mt-1 text-sm text-slate-600">Stay online and get the best delivery opportunities near you.</p><Button className="mt-4 bg-[#0867d6] hover:bg-[#0756b5]" onClick={() => navigate('/delivery/orders')} rightIcon={<ArrowRight className="h-4 w-4" />}>View Available Orders</Button></div><div className="absolute -right-3 bottom-0 hidden text-[#0b6ee1]/20 sm:block"><MapPin className="h-36 w-36" /><Bike className="absolute bottom-2 left-16 h-16 w-16 text-[#0867d6]" /></div></section>

    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold">Recent Activity</h2><button className="text-xs font-bold text-blue-600 hover:text-blue-800" onClick={() => navigate('/delivery/history')}>View All</button></div>{recent.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-500">Your completed deliveries will appear here.</div> : <div className="divide-y divide-slate-100">{recent.map((order) => <button key={order.id} onClick={() => navigate('/delivery/current')} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="w-28 text-xs font-bold text-slate-700">Order #{order.id}</span><span className="flex-1 text-xs text-slate-600">{order.status.replace(/_/g, ' ')}</span><span className="text-xs font-bold text-slate-800">₹{order.total_amount.toFixed(0)}</span><span className="text-xs text-slate-400"><ChevronRight className="h-4 w-4" /></span></button>)}</div>}</section>
  </div>;
};
