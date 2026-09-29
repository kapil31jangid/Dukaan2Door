import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  MapPin,
  Search,
  User,
  LogOut,
  Zap,
  ChevronDown,
  ShoppingBag,
  Clock,
  Sparkles,
  ArrowRight,
  ClipboardList,
  Navigation,
  Loader2,
  Tag,
  Bell,
  Home
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { LocationModal } from './LocationModal';
import { getBrowserCoordinates, reverseGeocode } from '../../services/geoService';

export const CustomerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalItems, totalPrice } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const rotatingPlaceholders = [
    'Search for "milk, curd & butter"',
    'Search for "lays, kurkure & chips"',
    'Search for "aashirvaad atta, rice & dal"',
    'Search for "dove soap & shampoo"',
    'Search for "tata tea & nescafe coffee"',
  ];

  // Load the saved delivery location. Location changes must be explicit so a browser
  // GPS fix cannot silently overwrite a manually selected address.
  useEffect(() => {
    customerService.getProfile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    customerService.listProducts({ page_size: 100 }).then((response) => {
      setCategories(Array.from(new Set(response.products.map((product) => product.category).filter((category): category is string => Boolean(category)))));
    }).catch(() => {
      // Home and catalog pages still show their own loading/error states.
    });
  }, []);

  const handleQuickFetchLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFetchingLocation(true);
    try {
      const coords = await getBrowserCoordinates();
      const addr = await reverseGeocode(coords.lat, coords.lng);
      const updated = await customerService.updateProfile({
        delivery_address: addr,
        lat: coords.lat,
        lng: coords.lng,
      });
      setProfile(updated);
    } catch {
      setIsLocationModalOpen(true);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % rotatingPlaceholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/customer/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const currentAddress = profile?.delivery_address || 'Choose delivery location';

  return (
    <div className="customer-shell flex min-h-screen flex-col bg-[#f6f8fa] font-sans text-slate-900">
      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentAddress={currentAddress}
        currentLat={profile?.lat}
        currentLng={profile?.lng}
        onLocationUpdated={(newProfile) => setProfile(newProfile)}
      />

      {/* Customer storefront header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3 sm:gap-6">
            
            {/* Brand Logo & Tagline */}
            <div className="flex items-center gap-4 sm:gap-6 shrink-0">
              <button
                onClick={() => navigate('/customer/home')}
                className="flex items-center gap-1.5 focus:outline-none group text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm transition-colors group-hover:bg-rose-700">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                    dukaan<span className="text-rose-600">2door</span>
                  </span>
                </div>
              </button>

              {/* Delivery Time & Location Dropdown with 1-Click GPS */}
              <div className="hidden md:flex items-center pl-3 border-l border-slate-200">
                <button
                  onClick={() => setIsLocationModalOpen(true)}
                  className="flex flex-col text-left group focus:outline-none"
                >
                  <div className="flex items-center gap-1 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Local delivery</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors group-hover:text-rose-700">
                    <span className="max-w-36 truncate">{currentAddress}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={handleQuickFetchLocation}
                  disabled={isFetchingLocation}
                  title="Detect live GPS location"
                  className="ml-2 rounded-lg border border-rose-100 bg-rose-50 p-1.5 text-rose-700 transition-all hover:bg-rose-100 active:scale-95 disabled:opacity-60"
                >
                  {isFetchingLocation ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 fill-purple-700" />
                  )}
                </button>
              </div>
            </div>

            {/* Global catalog search */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-purple-600 transition-colors">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={rotatingPlaceholders[placeholderIndex]}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-900 shadow-none transition-all placeholder:text-slate-400 hover:bg-white focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                />
              </div>
            </form>

            {/* Right Side Actions: Orders, Profile, Cart */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => navigate('/customer/notifications')}
                className="hidden sm:inline-flex rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              
              {/* Order History */}
              <button
                onClick={() => navigate('/customer/orders')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
              >
                <ClipboardList className="w-4 h-4 text-slate-500" />
                <span>Orders</span>
              </button>

              {/* Profile / Account */}
              <button
                onClick={() => navigate('/customer/profile')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline max-w-24 truncate">{user?.name || 'Account'}</span>
              </button>

              {/* Cart Pill Button */}
              <button
                onClick={() => navigate('/customer/cart')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black shadow-md transition-all active:scale-95 ${
                  totalItems > 0
                    ? 'bg-rose-600 text-white shadow-rose-600/20 hover:bg-rose-700'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <div className="relative">
                  <ShoppingCart className="w-4 h-4" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span>{totalItems > 0 ? `₹${Math.round(totalPrice)}` : 'Cart'}</span>
              </button>

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Location bar */}
        <div className="md:hidden px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-1.5 text-slate-700 font-semibold truncate flex-1"
          >
            <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="truncate">{currentAddress}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
          
          <button
            onClick={handleQuickFetchLocation}
            disabled={isFetchingLocation}
            title="Auto-fetch GPS location"
            className="p-1 px-2 rounded-lg bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center gap-1 shrink-0"
          >
            {isFetchingLocation ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Navigation className="w-3 h-3 fill-purple-700" />
            )}
            <span>GPS</span>
          </button>

              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
            <Tag className="w-2.5 h-2.5" />
            <span>LOCAL STORE</span>
          </div>
        </div>

        {/* Category Navigation Strip */}
        <div className="border-t border-slate-100 bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar">
              {[{ id: 'all', name: 'All products' }, ...categories.map((category) => ({ id: category, name: category }))].map((cat) => {
                const isActive =
                  (cat.id === 'all' && ['/customer/home', '/customer/store', '/customer/products'].includes(location.pathname)) ||
                  location.search.includes(`category=${encodeURIComponent(cat.id)}`);

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (cat.id === 'all') {
                        navigate('/customer/home');
                      } else {
                        navigate(`/customer/products?category=${encodeURIComponent(cat.id)}`);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      isActive
                        ? 'bg-purple-50 text-purple-700 border border-purple-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Floating cart action when items are present */}
      {totalItems > 0 && location.pathname !== '/customer/cart' && location.pathname !== '/customer/checkout' && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-8 sm:w-96 z-40 animate-bounce-short">
          <button
            onClick={() => navigate('/customer/cart')}
            className="w-full bg-slate-950 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between border border-slate-800 hover:bg-slate-900 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Tag className="w-3 h-3" />
                  <span>LOCAL STORE</span>
                </div>
                <p className="text-sm font-black text-white">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'} • ₹{Math.round(totalPrice)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black">
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden" aria-label="Customer navigation">
        <div className="grid grid-cols-5 gap-1">
          {[{ label: 'Home', path: '/customer/home', icon: Home }, { label: 'Search', path: '/customer/search', icon: Search }, { label: 'Orders', path: '/customer/orders', icon: ClipboardList }, { label: 'Profile', path: '/customer/profile', icon: User }, { label: 'Cart', path: '/customer/cart', icon: ShoppingCart }].map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path || (path === '/customer/search' && (location.pathname === '/customer/store' || location.pathname === '/customer/products')) || (path === '/customer/home' && location.pathname === '/customer');
            return <button key={label} type="button" onClick={() => navigate(path)} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-bold ${active ? 'text-emerald-700' : 'text-slate-500'}`}><Icon className="h-4 w-4" /><span>{label}</span></button>;
          })}
        </div>
      </nav>
    </div>
  );
};

export default CustomerLayout;
