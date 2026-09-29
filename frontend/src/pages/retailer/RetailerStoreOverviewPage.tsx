import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Edit3, FileText, MapPin, Store, Tag } from 'lucide-react';
import { retailerService } from '../../services/retailerService';
import { Product } from '../../types/product';
import { StoreProfile } from '../../types/user';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { MapView } from '../../components/maps/MapView';

export const RetailerStoreOverviewPage: React.FC = () => {
  const [store, setStore] = useState<StoreProfile | null>(null); const [products, setProducts] = useState<Product[]>([]); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isMounted = true;
    retailerService.getStore().then((storeData) => {
      if (!isMounted) return;
      setStore(storeData);
      setIsLoading(false);
      return retailerService.getProducts().then((productsData) => {
        if (isMounted) setProducts(productsData);
      }).catch(() => {
        if (isMounted) setError('The store loaded, but the product catalog could not be loaded.');
      });
    }).catch((err: any) => {
      if (!isMounted) return;
      setError(err?.message || 'Unable to load store details.');
      setIsLoading(false);
    });
    return () => { isMounted = false; };
  }, []);
  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))), [products]);
  if (isLoading) return <Spinner size="lg" label="Loading store details..." />;
  if (!store) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">Store details could not be loaded. Check the backend connection and sign in again.</div>;
  const hasCoordinates = store.lat != null && store.lng != null;
  return <div className="space-y-6"><div><h1 className="text-2xl font-extrabold tracking-tight">Store Details</h1><p className="mt-1 text-sm text-slate-500">Manage your store information and settings.</p></div><section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[180px_minmax(0,1fr)_180px]"><div className="flex h-36 items-center justify-center rounded-lg bg-gradient-to-br from-red-50 to-slate-100"><Store className="h-14 w-14 text-red-500" /></div><div><div className="flex items-center gap-3"><h2 className="text-xl font-black">{store.store_name}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${store.is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{store.is_open ? 'Open' : 'Closed'}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">Local Grocery Store</p><div className="mt-5 space-y-2 text-xs text-slate-600"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-red-500" />{store.address || 'Address not configured'}</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{store.operating_hours || 'Operating hours not configured'}</p></div><Button className="mt-5" size="sm" variant="outline" onClick={() => window.location.assign('/retailer/store/edit')} leftIcon={<Edit3 className="h-3.5 w-3.5" />}>Edit Store Details</Button></div><div className="min-h-36 overflow-hidden rounded-lg">{hasCoordinates ? <MapView center={{ lat: store.lat!, lng: store.lng! }} markers={[{ id: 'store', lat: store.lat!, lng: store.lng!, label: store.store_name, kind: 'store' }]} height="145px" showControls={false} fitToContent={false} /> : <div className="flex h-full items-center justify-center bg-slate-50 text-center text-xs text-slate-500">Store location not configured</div>}</div></section><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-red-500" /><h2 className="font-extrabold">Store Hours</h2></div><button className="text-xs font-bold text-red-600">Edit Hours</button></div><div className="mt-4 divide-y divide-slate-100 text-xs">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => <div key={day} className="flex items-center justify-between py-2.5"><span className="font-semibold text-slate-600">{day}</span><span className="text-slate-500">{store.operating_hours || 'Not configured'}</span></div>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Tag className="h-5 w-5 text-red-500" /><h2 className="font-extrabold">Store Categories</h2></div><button onClick={() => window.location.assign('/retailer/menu')} className="text-xs font-bold text-red-600">Edit Categories</button></div><div className="mt-4 grid grid-cols-2 gap-2">{categories.length ? categories.map((category) => <div key={String(category)} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{category}</div>) : <p className="text-xs text-slate-500">No product categories configured.</p>}</div></section></div><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-red-500" /><h2 className="font-extrabold">Store Documents</h2></div><span className="text-xs font-semibold text-slate-400">Upload when available</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"><FileText className="h-5 w-5 text-red-500" /><div><p className="text-xs font-bold">Business License</p><p className="mt-1 text-[10px] text-slate-400">No document uploaded</p></div></div><div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"><CheckCircle2 className="h-5 w-5 text-slate-300" /><div><p className="text-xs font-bold">Food Safety Certificate</p><p className="mt-1 text-[10px] text-slate-400">No document uploaded</p></div></div></div></section></div>;
};
