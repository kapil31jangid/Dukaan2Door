import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CircleHelp, ClipboardList, LayoutDashboard, LogOut, Menu, Package, ScanLine, Search, Settings, Store, TrendingUp, X } from 'lucide-react';

const navigation = [
  { to: '/retailer', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/retailer/orders', label: 'Orders', icon: ClipboardList },
  { to: '/retailer/inventory', label: 'Inventory', icon: Package },
  { to: '/retailer/menu', label: 'Products', icon: Store },
  { to: '/retailer/performance', label: 'Performance', icon: TrendingUp },
  { to: '/retailer/store', label: 'Store profile', icon: Store },
  { to: '/retailer/settings', label: 'Settings', icon: Settings },
  { to: '/retailer/help', label: 'Help & support', icon: CircleHelp },
];

export const RetailerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const current = navigation.find(item => item.to === location.pathname)?.label || 'Store workspace';
  return <div className="portal-shell min-h-screen">
    {isOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setIsOpen(false)} />}
    <aside aria-label="Merchant sidebar" className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white p-4 transition-transform lg:visible lg:translate-x-0 ${isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'}`} onKeyDown={event => { if (event.key === 'Escape') setIsOpen(false); }}>
      <Link to="/retailer" className="flex h-12 items-center gap-2 font-extrabold"><Store className="h-8 w-8 rounded-lg bg-rose-600 p-1.5 text-white" />Dukaan<span className="-ml-2 text-rose-600">2Door</span></Link>
      <button aria-label="Close navigation" onClick={() => setIsOpen(false)} className="absolute right-2 top-3 p-2 lg:hidden"><X className="h-4 w-4" /></button>
      <p className="mb-4 mt-6 px-3 text-xs font-semibold text-slate-400">STORE WORKSPACE</p>
      <nav aria-label="Retailer navigation" className="space-y-1">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setIsOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}
      </nav>
      <Link to="/retailer/inventory?add=scan" onClick={() => setIsOpen(false)} className="mt-6 flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"><ScanLine className="h-4 w-4 text-rose-600" />Upload inventory bill</Link>
      <button onClick={logout} className="mt-auto flex min-h-11 items-center gap-3 border-t border-slate-200 px-3 pt-4 text-sm text-slate-600"><LogOut className="h-4 w-4" />Sign out</button>
    </aside>
    <div className="lg:pl-60">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-7">
          <button onClick={() => setIsOpen(true)} aria-label="Open navigation" aria-expanded={isOpen} className="p-2 lg:hidden"><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-semibold">{current}</span>
          <form className="ml-auto hidden w-72 sm:block" onSubmit={event => { event.preventDefault(); navigate(`/retailer/inventory?q=${encodeURIComponent(search)}`); }}>
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search inventory" placeholder="Search inventory" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm" /></div>
          </form>
          <Link to="/retailer/settings" aria-label="Account settings" className="ml-auto flex min-w-0 items-center gap-2 sm:ml-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-700">{(user?.name || 'R').charAt(0)}</span><span className="hidden max-w-40 truncate text-xs font-semibold xl:block">{user?.name}</span></Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-7"><Outlet /></main>
    </div>
  </div>;
};
