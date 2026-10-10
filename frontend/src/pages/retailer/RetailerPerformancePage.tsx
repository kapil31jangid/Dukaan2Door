import React, { useEffect, useState } from 'react';
import { retailerService } from '../../services/retailerService';
import { Order } from '../../types/order';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';

export const RetailerPerformancePage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    try { setOrders(await retailerService.getOrders(undefined, 1, 100)); setError(''); }
    catch { setError('Performance data could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  if (loading) return <Spinner label="Loading performance..." />;
  const delivered = orders.filter(order => order.status === 'DELIVERED');
  const revenue = delivered.reduce((sum, order) => sum + order.total_amount, 0);
  const totals = new Map<number, { name: string; quantity: number; sales: number }>();
  delivered.forEach(order => order.items.forEach(item => {
    const previous = totals.get(item.product_id) || { name: item.product_name, quantity: 0, sales: 0 };
    totals.set(item.product_id, { ...previous, quantity: previous.quantity + item.quantity, sales: previous.sales + item.subtotal });
  }));
  const best = [...totals.values()].sort((a, b) => b.sales - a.sales).slice(0, 8);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Store performance</h1><p className="mt-2 text-sm text-slate-500">Based on the latest {orders.length} orders. Sales include delivered orders only.</p></div><Button variant="outline" onClick={() => void load()}>Refresh</Button></header>
    {error && <Alert variant="error">{error}</Alert>}
    <div className="grid gap-4 sm:grid-cols-3">{[['Delivered sales', `₹${revenue.toFixed(2)}`], ['Completed orders', delivered.length], ['Average completed order', `₹${(delivered.length ? revenue / delivered.length : 0).toFixed(2)}`]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums">{value}</p></div>)}</div>
    <section className="border-y border-slate-200 py-5"><h2 className="text-lg font-bold">Products by delivered sales</h2>{best.length ? <div className="mt-5 divide-y divide-slate-200">{best.map(product => <div key={product.name} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="text-sm font-semibold">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.quantity} units sold</p></div><span className="text-sm font-bold">₹{product.sales.toFixed(2)}</span></div>)}</div> : <p className="py-8 text-sm text-slate-500">Sales will appear after your first completed delivery.</p>}</section>
  </div>;
};
