import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bell, ChevronDown, CircleHelp, ClipboardList, LayoutDashboard, Menu, Package, Settings, Store, TrendingUp, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const navigation = [
  { to: '/retailer', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/retailer/orders', label: 'Orders', icon: ClipboardList },
  { to: '/retailer/menu', label: 'Menu', icon: Package },
  { to: '/retailer/store', label: 'Store', icon: Store },
  { to: '/retailer/settings', label: 'Business Settings', icon: Settings },
  { to: '/retailer/performance', label: 'Performance', icon: TrendingUp },
  { to: '/retailer/help', label: 'Help', icon: CircleHelp },
];

export const RetailerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const firstName = user?.name?.split(' ')[0] || 'Retailer';

  return <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
    {isOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    <aside className={twMerge('fixed inset-y-0 left-0 top-14 z-50 flex w-52 flex-col bg-[#101820] px-3 py-4 text-white transition-transform lg:translate-x-0', isOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center gap-2.5 px-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#e21b2d]"><Store className="h-4 w-4" /></div>
        <div><p className="text-sm font-extrabold tracking-tight">Dukaan<span className="text-red-500">2Door</span></p><p className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Merchant Portal</p></div>
        <button aria-label="Close navigation" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setIsOpen(false)}><X className="h-4 w-4" /></button>
      </div>
      <nav className="mt-8 space-y-1">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setIsOpen(false)} className={({ isActive }) => twMerge('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors', isActive ? 'bg-[#e21b2d] text-white shadow-lg shadow-red-950/25' : 'text-slate-300 hover:bg-white/10 hover:text-white')}><Icon className="h-4 w-4" />{label}</NavLink>)}
      </nav>
      <div className="mt-auto space-y-3 px-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5"><p className="truncate text-xs font-bold">Local Grocery Store</p><p className="mt-1 text-[10px] text-slate-400">Store is open</p></div>
        <button onClick={logout} className="w-full rounded-lg border border-slate-500/70 px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10">Logout</button>
      </div>
    </aside>
    <div className="lg:pl-52 pt-14">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-5 sm:px-8">
          <button onClick={() => setIsOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#e21b2d]"><Store className="h-4 w-4" /></div><div><p className="text-sm font-extrabold tracking-tight">Dukaan<span className="text-[#e21b2d]">2Door</span></p><p className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Merchant Portal</p></div></div>
          <div className="ml-5 hidden min-w-0 flex-1 md:block"><div className="max-w-md rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">Search orders, products, customers...</div></div>
          <div className="ml-auto flex items-center gap-4"><button aria-label="Notifications" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><Bell className="h-4 w-4" /></button><div className="flex items-center gap-2 border-l border-slate-200 pl-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{firstName.charAt(0).toUpperCase()}</div><div className="hidden sm:block"><p className="text-xs font-bold text-slate-900">{user?.name || 'Retailer'}</p><p className="text-[10px] text-slate-500">Store Owner</p></div><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></div></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] p-5 sm:p-8"><Outlet /></main>
    </div>
  </div>;
};
