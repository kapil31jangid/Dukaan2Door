import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Bike,
  ChevronDown,
  History,
  LayoutDashboard,
  Menu,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const navigation = [
  { to: '/delivery', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/delivery/orders', label: 'Available Orders', icon: ShoppingBag },
  { to: '/delivery/current', label: 'Current Delivery', icon: Bike },
  { to: '/delivery/earnings', label: 'Earnings', icon: Wallet },
  { to: '/delivery/history', label: 'Delivery History', icon: History },
  { to: '/delivery/profile', label: 'Profile', icon: UserRound },
];

export const DeliveryPartnerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      {isOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setIsOpen(false)} />}
      <aside className={twMerge(
        'fixed inset-y-0 left-0 z-50 flex w-48 flex-col bg-[#071526] px-3 py-4 text-white transition-transform lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#071526]"><Bike className="h-5 w-5" /></div>
            <div><p className="text-sm font-extrabold tracking-tight">Dukaan<span className="text-sky-400">2Door</span></p><p className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Delivery Partner</p></div>
          </div>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setIsOpen(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>

        <nav className="mt-8 space-y-1">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setIsOpen(false)} className={({ isActive }) => twMerge(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
              isActive ? 'bg-[#075fcf] text-white shadow-lg shadow-blue-950/30' : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 px-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />You are Online</div>
          <button onClick={logout} className="w-full rounded-lg border border-slate-500/70 px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10">Go Offline / Logout</button>
        </div>
      </aside>

      <div className="lg:pl-48">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-5 sm:px-8">
            <button onClick={() => setIsOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            <div className="hidden text-sm font-semibold text-slate-500 lg:block">Delivery operations</div>
            <div className="ml-auto flex items-center gap-4">
              <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell className="h-4 w-4" /></button>
              <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{(user?.name || 'R').charAt(0).toUpperCase()}</div>
                <div className="hidden sm:block"><p className="text-xs font-bold text-slate-900">{user?.name || 'Delivery Partner'}</p><p className="text-[10px] text-slate-500">Delivery Partner</p></div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-5 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
};
