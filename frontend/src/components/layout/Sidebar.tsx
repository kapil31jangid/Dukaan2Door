import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingBag,
  PackageCheck,
  Store,
  Truck,
  Navigation,
  History,
  Layers,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();

  const retailerNav = [
    { to: '/retailer', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, end: true },
    { to: '/retailer/orders', label: 'Order Processing', icon: <ShoppingBag className="w-4 h-4" /> },
    { to: '/retailer/inventory', label: 'Catalog & Inventory', icon: <Layers className="w-4 h-4" /> },
    { to: '/retailer/store', label: 'Store Settings', icon: <Store className="w-4 h-4" /> },
  ];

  const deliveryNav = [
    { to: '/delivery', label: 'Active Delivery', icon: <Navigation className="w-4 h-4" />, end: true },
    { to: '/delivery/history', label: 'Delivery History', icon: <History className="w-4 h-4" /> },
  ];

  const navItems = role === 'retailer' ? retailerNav : deliveryNav;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={twMerge(
          'fixed lg:sticky top-16 z-40 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 transition-transform duration-200 ease-in-out lg:translate-x-0 shrink-0 flex flex-col justify-between py-6 px-4',
          isOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full'
        )}
      >
        <div className="space-y-6">
          <div>
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Navigation
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    twMerge(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )
                  }
                >
                  <span className="text-inherit">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Status footer badge */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-700">Neon API Connected</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Live DB & OSRM Engine</p>
        </div>
      </aside>
    </>
  );
};
