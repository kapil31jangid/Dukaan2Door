import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';

export const DeliveryEarningsPage: React.FC = () => <section className="mx-auto max-w-xl py-12 text-center">
  <Wallet className="mx-auto h-10 w-10 text-slate-400" />
  <h1 className="mt-4 text-2xl font-bold">Earnings unavailable</h1>
  <p className="mt-3 text-sm leading-6 text-slate-500">Payout information is not available yet. You can still review your completed deliveries.</p>
  <Link to="/delivery/history" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">View delivery history</Link>
</section>;
