import React from 'react';
import { Bell, CheckCircle2, Info } from 'lucide-react';

export const NotificationsPage: React.FC = () => <div className="mx-auto max-w-4xl space-y-6">
  <div>
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Account</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Notifications</h1>
    <p className="mt-1 text-sm text-slate-500">Order and delivery updates from Dukaan2Door.</p>
  </div>
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 p-5">
      <Bell className="h-5 w-5 text-emerald-600" />
      <div>
        <h2 className="font-extrabold text-slate-900">Live order updates</h2>
        <p className="text-sm text-slate-500">Status changes appear on your order tracking screen.</p>
      </div>
      <span className="ml-auto h-3 w-3 rounded-full bg-emerald-500" title="Connected" />
    </div>
    <div className="divide-y divide-slate-100">
      <div className="flex gap-3 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-bold text-slate-800">WebSocket tracking</p>
          <p className="mt-1 text-sm text-slate-500">Delivery status and location updates are streamed when a delivery is assigned.</p>
        </div>
      </div>
      <div className="flex gap-3 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-bold text-slate-800">Browser notifications</p>
          <p className="mt-1 text-sm text-slate-500">Push notifications are not enabled in the current backend. Keep the tracking page open for live updates.</p>
        </div>
      </div>
    </div>
  </section>
</div>;