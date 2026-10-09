import React from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Bike, ShoppingBasket, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const destinations = {
  customer: '/customer/home',
  retailer: '/retailer',
  delivery_partner: '/delivery',
};

const portals = [
  {
    title: 'Customer',
    text: 'Shop groceries and follow your orders.',
    path: '/login/customer',
    icon: ShoppingBasket,
    style: 'bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white',
  },
  {
    title: 'Retailer',
    text: 'Manage orders, inventory, and your store.',
    path: '/login/retailer',
    icon: Store,
    style: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white',
  },
  {
    title: 'Delivery partner',
    text: 'Access pickups, routes, and delivery status.',
    path: '/login/delivery',
    icon: Bike,
    style: 'bg-blue-50 text-blue-700 group-hover:bg-blue-700 group-hover:text-white',
  },
] as const;

export const LoginPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();

  if (!isLoading && isAuthenticated && user) {
    return <Navigate to={destinations[user.role]} replace />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <img
        src="/images/dukaan2door-kirana-hero.webp"
        alt="Local grocery store and delivery partner"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-35"
      />
      <div className="absolute inset-0 bg-slate-950/65" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-200 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <Link to="/" className="flex items-center gap-2.5 font-black">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600"><Store className="h-4 w-4" /></span>
            <span>dukaan<span className="text-rose-400">2door</span></span>
          </Link>
        </div>

        <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold uppercase text-emerald-300">Secure portal access</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">How do you use Dukaan2Door?</h1>
            <p className="mt-4 text-base leading-7 text-slate-200">Choose your workspace to continue with the right account and tools.</p>
          </div>

          {searchParams.get('expired') === 'true' && (
            <div className="mx-auto mt-7 flex w-full max-w-xl items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" /> Your session expired. Choose your portal and sign in again.
            </div>
          )}

          <div className="mt-9 grid gap-3 md:grid-cols-3">
            {portals.map(({ title, text, path, icon: Icon, style }) => (
              <Link
                key={path}
                to={path}
                className="group flex min-h-52 flex-col rounded-lg border border-white/15 bg-white p-5 text-slate-950 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${style}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-6 text-xl font-extrabold">{title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{text}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold">
                  Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
