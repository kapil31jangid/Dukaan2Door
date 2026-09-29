import React, { useEffect, useState } from 'react';
import { Building2, Check, Loader2, Store } from 'lucide-react';
import { retailerService } from '../../services/retailerService';
import { StoreProfile } from '../../types/user';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const RetailerBusinessSettingsPage: React.FC = () => {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    retailerService.getStore()
      .then(setStore)
      .catch((err: any) => setError(err?.message || 'Unable to load store settings.'))
      .finally(() => setIsLoading(false));
  }, []);

  const save = async (isOpen: boolean) => {
    if (!store || isSaving) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await retailerService.updateStore({ is_open: isOpen });
      setStore(updated);
      setNotice(isOpen ? 'Store is now accepting orders.' : 'Store is now paused.');
    } catch (err: any) {
      setError(err?.message || 'Store status could not be updated.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Spinner size="lg" label="Loading business settings..." />;
  if (!store) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error || 'Business settings could not be loaded.'}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Configuration</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Business Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage the store details and order availability connected to your account.</p>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert variant="success" onDismiss={() => setNotice('')}>{notice}</Alert>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-red-500" /><h2 className="font-extrabold">Business Information</h2></div>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-bold text-slate-600">Store Name<input readOnly value={store.store_name} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800" /></label>
            <label className="block text-xs font-bold text-slate-600">Store Type<input readOnly value="Grocery Store" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800" /></label>
            <label className="block text-xs font-bold text-slate-600">Address<textarea readOnly value={store.address || ''} className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800" /></label>
          </div>
          <Button className="mt-5" onClick={() => window.location.assign('/retailer/store')}>Edit Store Details</Button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><Store className="h-5 w-5 text-red-500" /><h2 className="font-extrabold">Store Status</h2></div>
          <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-4">
            <div><p className="text-sm font-bold">Open for Orders</p><p className="mt-1 text-xs text-slate-500">Customers can place orders when enabled.</p></div>
            <button type="button" aria-label={store.is_open ? 'Pause store orders' : 'Open store for orders'} aria-pressed={store.is_open} disabled={isSaving} onClick={() => void save(!store.is_open)} className={`relative h-6 w-11 rounded-full transition disabled:cursor-wait disabled:opacity-60 ${store.is_open ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${store.is_open ? 'left-6' : 'left-1'}`} /></button>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs font-bold text-emerald-600">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isSaving ? 'Saving to database...' : store.is_open ? 'Currently accepting orders' : 'Currently paused'}</div>
        </section>
      </div>
    </div>
  );
};
