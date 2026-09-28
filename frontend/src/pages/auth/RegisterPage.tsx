import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShoppingBag, Store, Truck, User, Mail, Lock, Phone, MapPin, ArrowRight, AlertCircle, Building2, Car, Navigation, Loader2 } from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { getBrowserCoordinates, reverseGeocode } from '../../services/geoService';

type RoleOption = 'customer' | 'retailer' | 'delivery_partner';

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as RoleOption) || 'customer';

  const [role, setRole] = useState<RoleOption>(
    ['customer', 'retailer', 'delivery_partner'].includes(initialRole) ? initialRole : 'customer'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Role specific fields
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [storeName, setStoreName] = useState('');
  const [operatingHours, setOperatingHours] = useState('8:00 AM - 10:00 PM');
  const [vehicleInfo, setVehicleInfo] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const roleParam = searchParams.get('role') as RoleOption;
    if (roleParam && ['customer', 'retailer', 'delivery_partner'].includes(roleParam)) {
      setRole(roleParam);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    if (role === 'retailer' && !storeName.trim()) {
      setError('Store Name is required for Retailer registration.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await authService.register({
        email: email.trim(),
        password,
        role,
        name: name.trim(),
        phone: phone.trim() || undefined,
        delivery_address: role === 'customer' ? deliveryAddress.trim() || undefined : undefined,
        store_name: role === 'retailer' ? storeName.trim() || undefined : undefined,
        operating_hours: role === 'retailer' ? operatingHours.trim() || undefined : undefined,
        vehicle_info: role === 'delivery_partner' ? vehicleInfo.trim() || undefined : undefined,
      });
      await refreshUser();
      
      // Direct redirect into the separated workspace
      if (role === 'retailer') {
        navigate('/retailer', { replace: true });
      } else if (role === 'delivery_partner') {
        navigate('/delivery', { replace: true });
      } else {
        navigate('/customer/home', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const roleMeta = {
    customer: {
      badge: 'Customer',
      title: 'Customer Registration',
      subtitle: 'Create your account to order from neighborhood kirana stores',
      icon: <ShoppingBag className="w-5 h-5" />,
      themeColor: 'from-emerald-500 to-teal-400',
      buttonColor: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    },
    retailer: {
      badge: 'Merchant',
      title: 'Retailer / Store Registration',
      subtitle: 'Register your Kirana store to receive online orders & deliver directly',
      icon: <Store className="w-5 h-5" />,
      themeColor: 'from-blue-500 to-indigo-500',
      buttonColor: 'bg-blue-500 hover:bg-blue-400 text-slate-950',
    },
    delivery_partner: {
      badge: 'Rider',
      title: 'Delivery Partner Registration',
      subtitle: 'Join as a hyperlocal delivery partner for nearby store pickups',
      icon: <Truck className="w-5 h-5" />,
      themeColor: 'from-amber-500 to-orange-500',
      buttonColor: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    },
  };

  const handleDetectGps = async () => {
    setIsDetectingGps(true);
    setError(null);
    try {
      const coords = await getBrowserCoordinates();
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setDeliveryAddress(addr);
    } catch (err: any) {
      setError(err.message || 'Could not fetch device GPS location.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const current = roleMeta[role];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 text-center">
        <h1 className="text-3xl font-black tracking-tight text-white">
          Dukaan<span className="text-emerald-400">2Door</span>
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Create an Account
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-slate-900/95 backdrop-blur-xl py-8 px-6 shadow-2xl border border-slate-800 rounded-3xl sm:px-10">
          
          {/* Role Selection Tabs */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
              Choose Account Type
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setRole('customer'); setError(null); }}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all ${
                  role === 'customer'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <ShoppingBag className="w-4 h-4 mb-1" />
                <span className="text-xs">Customer</span>
              </button>

              <button
                type="button"
                onClick={() => { setRole('retailer'); setError(null); }}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all ${
                  role === 'retailer'
                    ? 'bg-slate-800 text-blue-400 border border-blue-500/30 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Store className="w-4 h-4 mb-1" />
                <span className="text-xs">Retailer</span>
              </button>

              <button
                type="button"
                onClick={() => { setRole('delivery_partner'); setError(null); }}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all ${
                  role === 'delivery_partner'
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/30 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Truck className="w-4 h-4 mb-1" />
                <span className="text-xs">Delivery</span>
              </button>
            </div>
          </div>

          {/* Role Header Banner */}
          <div className="mb-6 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${current.themeColor} flex items-center justify-center text-slate-950 shrink-0 font-black shadow-md`}>
              {current.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight truncate">{current.title}</h2>
              <p className="text-[11px] text-slate-400 leading-snug truncate">{current.subtitle}</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleRegister}>
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {role === 'retailer' ? 'Owner Full Name *' : role === 'delivery_partner' ? 'Rider Full Name *' : 'Full Name *'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Password *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Customer Specific Field */}
            {role === 'customer' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">Default Delivery Address</label>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    disabled={isDetectingGps}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {isDetectingGps ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    <span>{isDetectingGps ? 'Detecting GPS...' : 'Fetch Location'}</span>
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute top-3 left-3.5 flex items-center pointer-events-none text-slate-500">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <textarea
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="House/Flat No., Street, Landmark, Area"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            {/* Retailer Specific Fields */}
            {role === 'retailer' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Store / Dukaan Name *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="e.g. Sharma General Store"
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Operating Hours</label>
                  <input
                    type="text"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    placeholder="e.g. 8:00 AM - 10:00 PM"
                    className="block w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </>
            )}

            {/* Delivery Partner Specific Fields */}
            {role === 'delivery_partner' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Vehicle Information</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Car className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={vehicleInfo}
                    onChange={(e) => setVehicleInfo(e.target.value)}
                    placeholder="e.g. Honda Activa (MH-02-1234) or Bicycle"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className={`w-full mt-2 font-bold ${current.buttonColor}`}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create {current.badge} Account
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Sign in here
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
