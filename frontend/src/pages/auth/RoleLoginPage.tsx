import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  PackageCheck,
  ShoppingBasket,
  Store,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';

type LoginRole = UserRole;

interface Props {
  role: LoginRole;
}

const destinationByRole: Record<LoginRole, string> = {
  customer: '/customer/home',
  retailer: '/retailer',
  delivery_partner: '/delivery',
};

const loginPathByRole: Record<LoginRole, string> = {
  customer: '/login/customer',
  retailer: '/login/retailer',
  delivery_partner: '/login/delivery',
};

const roleConfig = {
  customer: {
    eyebrow: 'Customer account',
    title: 'Your local store is closer than you think.',
    formTitle: 'Welcome back',
    formSubtitle: 'Sign in to shop groceries and track your orders.',
    demoEmail: 'rahul@example.com',
    demoLabel: 'Use customer demo',
    icon: ShoppingBasket,
    button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 disabled:bg-rose-300',
    iconStyle: 'bg-rose-600 text-white',
    focus: 'focus:border-rose-500 focus:ring-rose-500/15',
    points: ['Browse nearby stock', 'Checkout with your saved address', 'Follow live delivery progress'],
  },
  retailer: {
    eyebrow: 'Retailer account',
    title: 'Run your store from shelf to handoff.',
    formTitle: 'Retailer sign in',
    formSubtitle: 'Open your orders, inventory, and store operations.',
    demoEmail: 'satellite.retailer.rahul@example.com',
    demoLabel: 'Use retailer demo',
    icon: Store,
    button: 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-600 disabled:bg-emerald-300',
    iconStyle: 'bg-emerald-700 text-white',
    focus: 'focus:border-emerald-600 focus:ring-emerald-600/15',
    points: ['Review incoming orders', 'Manage catalog and inventory', 'Prepare pickup handoffs'],
  },
  delivery_partner: {
    eyebrow: 'Delivery partner account',
    title: 'Nearby pickups. Clear routes. Live progress.',
    formTitle: 'Partner sign in',
    formSubtitle: 'Access available deliveries and your current route.',
    demoEmail: 'satellite.rider.arjun.3km@example.com',
    demoLabel: 'Use partner demo',
    icon: Bike,
    button: 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-600 disabled:bg-blue-300',
    iconStyle: 'bg-blue-700 text-white',
    focus: 'focus:border-blue-600 focus:ring-blue-600/15',
    points: ['Claim eligible deliveries', 'Navigate store and customer routes', 'Share live delivery updates'],
  },
} satisfies Record<LoginRole, {
  eyebrow: string;
  title: string;
  formTitle: string;
  formSubtitle: string;
  demoEmail: string;
  demoLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  button: string;
  iconStyle: string;
  focus: string;
  points: string[];
}>;

const roleName = (role: LoginRole): string =>
  role === 'delivery_partner' ? 'delivery partner' : role;

export const RoleLoginPage: React.FC<Props> = ({ role }) => {
  const config = roleConfig[role];
  const Icon = config.icon;
  const { login, logout, isAuthenticated, user, isLoading: isSessionLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  if (!isSessionLoading && isAuthenticated && user) {
    return <Navigate to={destinationByRole[user.role]} replace />;
  }

  const useDemo = () => {
    setEmail(config.demoEmail);
    setPassword('DemoPassword123!');
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const signedInUser = await login(email.trim(), password);
      if (signedInUser.role !== role) {
        logout();
        setError(
          `This is a ${roleName(signedInUser.role)} account. Please use the ${roleName(signedInUser.role)} sign-in page.`,
        );
        return;
      }
      const requestedPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(requestedPath || destinationByRole[role], { replace: true });
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:block">
        <img
          src="/images/dukaan2door-kirana-hero.webp"
          alt="Local kirana delivery network"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.78)_100%)]" />
        <div className="relative z-10 flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
          <Link to="/" className="flex w-fit items-center gap-2.5 text-white" aria-label="Dukaan2Door home">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600"><Store className="h-5 w-5" /></span>
            <span className="text-xl font-black">dukaan<span className="text-rose-400">2door</span></span>
          </Link>
          <div className="max-w-xl pb-6 text-white">
            <div className="mb-5 flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${config.iconStyle}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-extrabold uppercase text-white/80">{config.eyebrow}</span>
            </div>
            <h1 className="text-4xl font-black leading-tight xl:text-5xl">{config.title}</h1>
            <ul className="mt-7 grid gap-3 text-sm font-semibold text-slate-100">
              {config.points.map((point, index) => (
                <li key={point} className="flex items-center gap-3">
                  {index === 0 ? <MapPin className="h-4 w-4 text-emerald-400" /> : index === 1 ? <PackageCheck className="h-4 w-4 text-emerald-400" /> : <ArrowRight className="h-4 w-4 text-emerald-400" />}
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <Link to={`/register?role=${role}`} className="text-sm font-extrabold text-slate-900 hover:text-rose-700">
            Create account
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg ${config.iconStyle}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-extrabold uppercase text-slate-500">{config.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">{config.formTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{config.formSubtitle}</p>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor={`${role}-email`} className="text-sm font-bold text-slate-800">Email address</label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id={`${role}-email`}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className={`min-h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:ring-4 ${config.focus}`}
                />
              </div>
            </div>
            <div>
              <label htmlFor={`${role}-password`} className="text-sm font-bold text-slate-800">Password</label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id={`${role}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className={`min-h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-11 text-sm outline-none transition focus:ring-4 ${config.focus}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting || isSessionLoading}
              className={`w-full text-white ${config.button}`}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-bold text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> DEMO ACCESS <span className="h-px flex-1 bg-slate-200" />
          </div>
          <button
            type="button"
            onClick={useDemo}
            className="flex min-h-12 w-full items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-4 text-left text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-100"
          >
            <span>{config.demoLabel}</span>
            <ArrowRight className="h-4 w-4 text-slate-500" />
          </button>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-xs font-bold uppercase text-slate-400">Switch portal</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
              {(Object.keys(roleConfig) as LoginRole[]).filter((item) => item !== role).map((item) => (
                <Link key={item} to={loginPathByRole[item]} className="text-slate-600 hover:text-slate-950">
                  {item === 'customer' ? 'Customer' : item === 'retailer' ? 'Retailer' : 'Delivery partner'}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default RoleLoginPage;
