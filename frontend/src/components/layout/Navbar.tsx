import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, Truck, ShoppingBag, LogOut, User, Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden focus:outline-none"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
                <Store className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-base font-extrabold text-slate-900 tracking-tight block leading-tight">
                  Dukaan<span className="text-emerald-600">2Door</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                  {role === 'retailer' ? 'Merchant Portal' : role === 'delivery_partner' ? 'Delivery Partner App' : 'Customer App'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="/customer/products" className="text-slate-600 hover:text-emerald-800 transition-colors font-medium">
              Home
            </a>
            <a href="/customer/search" className="text-slate-600 hover:text-emerald-800 transition-colors font-medium">
              Search
            </a>
            <a href="/customer/orders" className="text-slate-600 hover:text-emerald-800 transition-colors font-medium">
              Orders
            </a>
            <a href="/customer/profile" className="text-slate-600 hover:text-emerald-800 transition-colors font-medium">
              Account
            </a>
          </div>

          {/* Cart & Mobile Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/customer/cart')}
              className="relative"
            >
              <ShoppingBag className="w-5 h-5 text-slate-600 hover:text-emerald-700 transition-colors" />
            </Button>

            {user && (
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left pr-2">
                  <p className="text-xs font-semibold text-slate-800 leading-none">
                    {user.name || user.email}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 capitalize font-medium">{user.role}</p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/auth/logout')}
              leftIcon={<LogOut className="w-4 h-4" />}
              className="text-slate-600 border-slate-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50"
            >
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
