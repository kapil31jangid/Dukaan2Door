import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, User, Mail, Lock, Phone, MapPin, ArrowRight, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setError(null);
    setIsLoading(true);
    try {
      await authService.register({
        email: email.trim(),
        password,
        role: 'customer',
        name: name.trim(),
        phone: phone.trim() || undefined,
        delivery_address: deliveryAddress.trim() || undefined,
      });
      await refreshUser();
      navigate('/customer/home', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-black tracking-tight text-white">
          Dukaan<span className="text-emerald-400">2Door</span>
        </h2>
        <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Create your customer account
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

          <form className="space-y-4" onSubmit={handleRegister}>
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Full Name *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
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
                  placeholder="you@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Password * (min 6 chars)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Phone (optional)</label>
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

            {/* Delivery Address */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Default Delivery Address (optional)</label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none text-slate-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="123, Main Street, City"
                  rows={2}
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2 font-bold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
