import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, ClipboardList, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { twMerge } from 'tailwind-merge';

interface BottomNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

export const CustomerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const navItems: BottomNavItem[] = [
    { to: '/customer/home', label: 'Home', icon: <Home className="w-5 h-5" />, end: true },
    { to: '/customer/products', label: 'Products', icon: <ShoppingBag className="w-5 h-5" /> },
    { to: '/customer/cart', label: 'Cart', icon: <ShoppingCart className="w-5 h-5" /> },
    { to: '/customer/orders', label: 'Orders', icon: <ClipboardList className="w-5 h-5" /> },
    { to: '/customer/profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <button
              onClick={() => navigate('/customer/home')}
              className="flex items-center gap-2 focus:outline-none"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Dukaan<span className="text-emerald-600">2Door</span>
                </span>
                <span className="block text-[9px] font-semibold text-slate-400 tracking-wider uppercase leading-none">
                  Customer App
                </span>
              </div>
            </button>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              {/* Cart icon with badge (visible on desktop) */}
              <button
                onClick={() => navigate('/customer/cart')}
                className="hidden lg:flex relative p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </button>

              {/* User info (desktop) */}
              {user && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 max-w-24 truncate">
                    {user.name || user.email}
                  </span>
                </div>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop top nav links */}
        <div className="hidden lg:block border-t border-slate-100">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center gap-1 py-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    twMerge(
                      'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label === 'Cart' ? (
                        <span className="relative">
                          {item.icon}
                          {totalItems > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                              {totalItems > 9 ? '9+' : totalItems}
                            </span>
                          )}
                        </span>
                      ) : (
                        item.icon
                      )}
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 lg:pb-6">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                twMerge(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-[10px] font-semibold relative',
                  isActive ? 'text-emerald-700' : 'text-slate-500'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label === 'Cart' ? (
                    <span className="relative">
                      <span
                        className={twMerge(
                          'block transition-colors',
                          isActive ? 'text-emerald-600' : 'text-slate-500'
                        )}
                      >
                        {item.icon}
                      </span>
                      {totalItems > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {totalItems > 9 ? '9+' : totalItems}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      className={twMerge(
                        'transition-colors',
                        isActive ? 'text-emerald-600' : 'text-slate-500'
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
