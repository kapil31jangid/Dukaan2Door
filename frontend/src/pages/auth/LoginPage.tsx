import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Store, Truck, ShoppingBag, Lock, Mail, ArrowRight, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

type RoleOption = 'customer' | 'retailer' | 'delivery_partner';

export const LoginPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleOption>('customer');
  const [email, setEmail] = useState('demo.customer@example.com');
  const [password, setPassword] = useState('DemoPassword123!');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role);
    setError(null);
    if (role === 'customer') {
      setEmail('demo.customer@example.com');
      setPassword('DemoPassword123!');
    } else if (role === 'retailer') {
      setEmail('demo.retailer.central@example.com');
      setPassword('DemoPassword123!');
    } else if (role === 'delivery_partner') {
      setEmail('demo.rider1@example.com');
      setPassword('DemoPassword123!');
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const user = await login(email, password);
      // Route immediately into the separated role workspace
      if (user.role === 'retailer') {
        navigate('/retailer', { replace: true });
      } else if (user.role === 'delivery_partner') {
        navigate('/delivery', { replace: true });
      } else if (user.role === 'customer') {
        navigate('/customer/home', { replace: true });
      } else {
        setError(`Unknown role "${user.role}".`);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, role: RoleOption) => {
    setSelectedRole(role);
    setEmail(demoEmail);
    setPassword('DemoPassword123!');
    setError(null);
  };

  const roleMeta = {
    customer: {
      title: 'Customer Shopper Portal',
      subtitle: 'Order groceries & daily essentials from local neighbourhood stores',
      badge: 'Shopper',
      themeColor: 'from-emerald-500 to-teal-400',
      activeBorder: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
      icon: <ShoppingBag className="w-5 h-5" />,
      tagline: 'Hyperlocal Direct Delivery',
      buttonColor: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    },
    retailer: {
      title: 'Kirana Merchant Portal',
      subtitle: 'Manage your local store inventory, incoming orders & fulfillment',
      badge: 'Merchant',
      themeColor: 'from-blue-500 to-indigo-500',
      activeBorder: 'border-blue-500 bg-blue-500/10 text-blue-300',
      icon: <Store className="w-5 h-5" />,
      tagline: 'Store Management & Orders',
      buttonColor: 'bg-blue-500 hover:bg-blue-400 text-slate-950',
    },
    delivery_partner: {
      title: 'Delivery Rider Portal',
      subtitle: 'Accept store pickups, navigate routes & fulfill doorstep deliveries',
      badge: 'Rider',
      themeColor: 'from-amber-500 to-orange-500',
      activeBorder: 'border-amber-500 bg-amber-500/10 text-amber-300',
      icon: <Truck className="w-5 h-5" />,
      tagline: 'Last-Mile Pickup & Delivery',
      buttonColor: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    },
  };

  const current = roleMeta[selectedRole];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Unified Multi-Role Sign In</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Dukaan<span className="text-emerald-400">2Door</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 font-medium max-w-sm mx-auto">
          Hyperlocal Direct Delivery Platform connecting Customers, Local Kirana Stores & Delivery Riders
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-slate-900/95 backdrop-blur-xl py-8 px-6 shadow-2xl border border-slate-800 rounded-3xl sm:px-10">
          
          {/* Role Selection Tabs */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
              Select Your Portal
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleRoleSelect('customer')}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all ${
                  selectedRole === 'customer'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <ShoppingBag className="w-4 h-4 mb-1" />
                <span className="text-xs">Customer</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('retailer')}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all ${
                  selectedRole === 'retailer'
                    ? 'bg-slate-800 text-blue-400 border border-blue-500/30 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Store className="w-4 h-4 mb-1" />
                <span className="text-xs">Retailer</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('delivery_partner')}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all ${
                  selectedRole === 'delivery_partner'
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

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address</label>
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

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className={`w-full mt-2 font-bold ${current.buttonColor}`}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to {current.badge} Screen
            </Button>
          </form>

          {/* Register link */}
          <p className="mt-4 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to={`/register?role=${selectedRole}`} className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Register as {current.badge}
            </Link>
          </p>

          {/* Quick Demo Logins Section */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
              Quick 1-Click Demo Accounts
            </p>

            {selectedRole === 'customer' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('demo.customer@example.com', 'customer')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Demo Customer</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">demo.customer@example.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('rahul@example.com', 'customer')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Rahul (Satellite Shopper)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">rahul@example.com</p>
                </button>
              </div>
            )}

            {selectedRole === 'retailer' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('demo.retailer.central@example.com', 'retailer')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold mb-0.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>Central Mart</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">demo.retailer.central</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('demo.retailer.west@example.com', 'retailer')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold mb-0.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>West Kirana</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">demo.retailer.west</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('satellite.retailer.rahul@example.com', 'retailer')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold mb-0.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>Rahul Satellite</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">satellite.retailer.rahul</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('satellite.retailer.neha@example.com', 'retailer')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold mb-0.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>Neha Satellite</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">satellite.retailer.neha</p>
                </button>
              </div>
            )}

            {selectedRole === 'delivery_partner' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('demo.rider1@example.com', 'delivery_partner')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Demo Rider 1</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">demo.rider1@example.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('demo.rider2@example.com', 'delivery_partner')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Demo Rider 2</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">demo.rider2@example.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('satellite.rider.rahul@example.com', 'delivery_partner')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Rahul Satellite Rider</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">satellite.rider.rahul</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillDemoAccount('satellite.rider.arjun.3km@example.com', 'delivery_partner')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Arjun • 3 km Away</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">satellite.rider.arjun.3km</p>
                </button>
              </div>
            )}

            <p className="text-[10px] text-slate-500 text-center mt-3">
              Preset Demo Password: <code className="text-slate-400">DemoPassword123!</code>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
