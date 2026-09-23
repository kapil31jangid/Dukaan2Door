import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Store, Truck, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      if (user.role === 'retailer') {
        navigate('/retailer', { replace: true });
      } else if (user.role === 'delivery_partner') {
        navigate('/delivery', { replace: true });
      } else {
        setError(`Your account has role "${user.role}". Frontend 2 is strictly for Retailers and Delivery Partners.`);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoRole: 'retailer' | 'delivery_partner') => {
    setEmail(demoEmail);
    setPassword('DemoPassword123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Store className="w-6 h-6" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-black tracking-tight text-white">
          Dukaan<span className="text-emerald-400">2Door</span>
        </h2>
        <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Partner & Merchant Operation Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl border border-slate-800 rounded-3xl sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
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
                  placeholder="retailer@example.com"
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
              className="w-full mt-2 font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Dashboard
            </Button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Quick 1-Click Operational Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('demo.retailer.central@example.com', 'retailer')}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                  <Store className="w-3.5 h-3.5" />
                  <span>Central Retailer</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">demo.retailer.central</p>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('demo.rider1@example.com', 'delivery_partner')}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold mb-0.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Demo Rider 1</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">demo.rider1@example.com</p>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('demo.retailer.west@example.com', 'retailer')}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                  <Store className="w-3.5 h-3.5" />
                  <span>West Retailer</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">demo.retailer.west</p>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('demo.rider2@example.com', 'delivery_partner')}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold mb-0.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Demo Rider 2</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">demo.rider2@example.com</p>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-3">
              Password preset: <code className="text-slate-400">DemoPassword123!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
