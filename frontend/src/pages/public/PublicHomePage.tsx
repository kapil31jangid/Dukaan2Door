import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bike,
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  ShoppingBasket,
  Store,
} from 'lucide-react';

const roleLinks = [
  {
    title: 'Shop groceries',
    description: 'Browse daily essentials from a nearby local store and follow every order to your door.',
    action: 'Customer sign in',
    path: '/login/customer',
    icon: ShoppingBasket,
    accent: 'bg-rose-50 text-rose-700',
  },
  {
    title: 'Grow your local store',
    description: 'Manage stock, review incoming orders, and keep fulfilment moving from one workspace.',
    action: 'Retailer sign in',
    path: '/login/retailer',
    icon: Store,
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Deliver nearby',
    description: 'Claim eligible pickups, follow road routes, and share live delivery progress.',
    action: 'Partner sign in',
    path: '/login/delivery',
    icon: Bike,
    accent: 'bg-blue-50 text-blue-700',
  },
];

const steps = [
  { icon: MapPin, title: 'Find the local store', text: 'Location and available stock determine fulfilment.' },
  { icon: PackageCheck, title: 'Store prepares the order', text: 'The retailer accepts, packs, and marks it ready.' },
  { icon: Bike, title: 'Track doorstep delivery', text: 'A nearby partner picks up and shares live progress.' },
];

export const PublicHomePage: React.FC = () => (
  <main className="min-h-screen bg-white text-slate-950">
    <section className="relative min-h-[680px] overflow-hidden bg-slate-900 sm:min-h-[720px] lg:min-h-[min(820px,88svh)]">
      <div
        className="absolute inset-0 bg-cover bg-[position:65%_center] sm:bg-center"
        style={{ backgroundImage: "url('/images/dukaan2door-kirana-hero.webp')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.90)_0%,rgba(2,6,23,0.75)_34%,rgba(2,6,23,0.18)_68%,rgba(2,6,23,0.05)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-950/50 to-transparent" />

      <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5 text-white" aria-label="Dukaan2Door home">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600 shadow-lg shadow-rose-950/20">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-black">dukaan<span className="text-rose-400">2door</span></span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Public navigation">
          <a href="#how-it-works" className="hidden px-3 py-2 text-sm font-bold text-white/85 hover:text-white sm:inline-flex">
            How it works
          </a>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex max-w-7xl items-center px-5 pb-20 pt-20 sm:px-8 sm:pt-24 lg:px-10 lg:pt-28">
        <div className="max-w-2xl text-white">
          <div className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Hyperlocal delivery, powered by local stores
          </div>
          <h1 className="max-w-xl text-5xl font-black leading-[1.03] sm:text-6xl lg:text-7xl">
            Dukaan2Door
          </h1>
          <p className="mt-5 max-w-xl text-xl font-bold leading-snug text-white sm:text-2xl">
            Your neighbourhood store, delivered.
          </p>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-200 sm:text-lg">
            Order groceries and daily essentials nearby while local retailers manage fulfilment and delivery partners complete the last mile.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login/customer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 text-sm font-extrabold text-white shadow-lg shadow-slate-950/25 transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rose-600"
            >
              Start shopping <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#portals"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/35 bg-white/10 px-6 text-sm font-extrabold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Explore all portals
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-200">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />Inventory-aware</span>
            <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-400" />Live order status</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-400" />Local road routes</span>
          </div>
        </div>
      </div>
    </section>

    <section id="portals" className="border-b border-slate-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-extrabold uppercase text-rose-600">Choose your experience</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">One local delivery network. Three focused workspaces.</h2>
        </div>
        <div className="mt-10 grid border-y border-slate-200 md:grid-cols-3 md:divide-x md:divide-slate-200">
          {roleLinks.map(({ title, description, action, path, icon: Icon, accent }) => (
            <article key={path} className="border-b border-slate-200 py-8 last:border-b-0 md:border-b-0 md:px-7 first:md:pl-0 last:md:pr-0">
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-xl font-extrabold text-slate-950">{title}</h3>
              <p className="mt-2 min-h-14 text-sm leading-6 text-slate-600">{description}</p>
              <Link to={path} className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900 hover:text-rose-700">
                {action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section id="how-it-works" className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-extrabold uppercase text-emerald-700">From shelf to doorstep</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">A simple local order journey</h2>
          </div>
          <Link to="/login/customer" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-rose-700 hover:text-rose-900">
            Order from your local store <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="relative border-l-2 border-slate-200 pl-6">
              <span className="text-xs font-black text-slate-400">0{index + 1}</span>
              <Icon className="mt-4 h-6 w-6 text-rose-600" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <footer className="bg-slate-950 py-8 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div className="flex items-center gap-2 font-black text-white"><Store className="h-4 w-4 text-rose-500" />dukaan2door</div>
        <div className="flex flex-wrap gap-5 text-xs font-semibold">
          <Link to="/login/customer" className="hover:text-white">Customer</Link>
          <Link to="/login/retailer" className="hover:text-white">Retailer</Link>
          <Link to="/login/delivery" className="hover:text-white">Delivery partner</Link>
        </div>
      </div>
    </footer>
  </main>
);

export default PublicHomePage;
