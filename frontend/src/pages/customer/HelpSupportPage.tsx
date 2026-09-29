import React from 'react';
import { HelpCircle, MessageCircle, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const topics = [
  { icon: Package, title: 'Track my order', detail: 'View live status, delivery partner, and map tracking.', path: '/customer/orders' },
  { icon: ShoppingBag, title: 'Product & inventory', detail: 'Check availability and update your cart when stock changes.', path: '/customer/products' },
  { icon: RefreshCw, title: 'Order issues', detail: 'Review a current order and its latest backend status.', path: '/customer/orders' },
  { icon: HelpCircle, title: 'Account & location', detail: 'Update your saved delivery address and GPS coordinates.', path: '/customer/profile' },
];

export const HelpSupportPage: React.FC = () => {
  const navigate = useNavigate();
  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Customer care</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Help & Support</h1>
      <p className="mt-1 text-sm text-slate-500">Find answers about your local Dukaan2Door order.</p>
    </div>
    <div className="relative">
      <HelpCircle className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
      <input aria-label="Search help articles" placeholder="Search help articles..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
    </div>
    <section className="grid gap-4 sm:grid-cols-2">
      {topics.map(({ icon: Icon, title, detail, path }) => <button key={title} type="button" onClick={() => navigate(path)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md">
        <Icon className="h-5 w-5 text-emerald-600" />
        <h2 className="mt-4 font-extrabold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
      </button>)}
    </section>
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
      <div>
        <h2 className="font-extrabold text-slate-900">Need more help?</h2>
        <p className="mt-1 text-sm text-slate-600">Review your order and include its number when contacting the project team.</p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-800">
        <MessageCircle className="h-4 w-4" /> Chat and phone support are not enabled in the current backend.
      </div>
    </section>
  </div>;
};