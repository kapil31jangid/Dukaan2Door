import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bike, History, LayoutDashboard, LogOut, ShoppingBag, UserRound } from 'lucide-react';

const navigation = [
  { to: '/delivery', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/delivery/orders', label: 'Requests', icon: ShoppingBag },
  { to: '/delivery/current', label: 'Active trip', icon: Bike },
  { to: '/delivery/history', label: 'History', icon: History },
  { to: '/delivery/profile', label: 'Account', icon: UserRound },
];

export const DeliveryPartnerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  return <div className="portal-shell min-h-screen pb-24 lg:pb-0">
    <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
      <Link to="/delivery" className="flex h-12 items-center gap-2 text-base font-extrabold"><Bike className="h-9 w-9 rounded-lg bg-rose-600 p-2 text-white" />Dukaan2Door</Link>
      <p className="mb-4 mt-6 px-3 text-xs font-semibold text-slate-400">DELIVERY PARTNER</p>
      <nav aria-label="Delivery sidebar" className="space-y-1">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>
      <button onClick={logout} className="mt-auto flex min-h-11 items-center gap-3 border-t border-slate-200 px-3 pt-4 text-sm text-slate-600"><LogOut className="h-4 w-4" />Sign out</button>
    </aside>
    <div className="lg:pl-56">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
        <Link to="/delivery" className="flex items-center gap-2 text-sm font-extrabold"><Bike className="h-5 w-5 text-rose-600" /><span>Dukaan2Door <span className="font-medium text-slate-500">Partner</span></span></Link>
        <Link to="/delivery/profile" aria-label="Partner account" className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{(user?.name || 'R').charAt(0)}</Link>
      </header>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-7"><Outlet /></main>
    </div>
    <nav aria-label="Delivery navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{label}</NavLink>)}</nav>
  </div>;
};
