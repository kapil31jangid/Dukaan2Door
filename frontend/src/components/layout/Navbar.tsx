import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, Truck, LogOut, User, Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { user, role, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-2xs">
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
              <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
                {role === 'retailer' ? <Store className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-base font-extrabold text-slate-900 tracking-tight block leading-tight">
                  Dukaan<span className="text-emerald-600">2Door</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                  {role === 'retailer' ? 'Merchant Portal' : 'Delivery Partner App'}
                </span>
              </div>
            </div>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center gap-4">
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
              onClick={logout}
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
