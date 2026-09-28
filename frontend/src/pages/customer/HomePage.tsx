import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Package, Search, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { ProductCard } from '../../components/customer/ProductCard';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';

const categoryIcon = (category: string) => category.trim().charAt(0).toUpperCase() || 'P';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    customerService.listProducts({ page_size: 100 })
      .then((response) => { if (!cancelled) setProducts(response.products); })
      .catch((err: any) => { if (!cancelled) setError(err.message || 'Unable to load the local store catalog.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter((category): category is string => Boolean(category)))),
    [products],
  );
  const popularProducts = products.filter((product) => product.is_available && product.quantity > 0).slice(0, 8);

  return (
    <div className="space-y-8 pb-4">
      <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50">
        <div className="grid gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
              <Store className="h-4 w-4" aria-hidden="true" />
              Your local Dukaan2Door store
            </p>
            <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Everyday groceries, picked close and delivered to your door.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Browse the catalog from our local store. At checkout, your saved location and stock are verified by the backend before the order is accepted.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/customer/products')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
                Browse the store <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => navigate('/customer/location')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                <MapPin className="h-4 w-4" aria-hidden="true" /> Set delivery location
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Store status</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Dukaan2Door Local Store</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Open</span>
            </div>
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-700" />Matched to your delivery location</p>
              <p className="flex items-center gap-2"><Package className="h-4 w-4 text-emerald-700" />Stock checked at checkout</p>
              <p className="flex items-center gap-2"><Store className="h-4 w-4 text-emerald-700" />Direct local-store fulfillment</p>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" label="Loading products from the local store…" /></div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <>
          <section aria-labelledby="categories-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Shop the catalog</p><h2 id="categories-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Browse by category</h2></div>
              <button type="button" onClick={() => navigate('/customer/products')} className="text-sm font-bold text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:underline">View all</button>
            </div>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {categories.map((category) => (
                  <button type="button" key={category} onClick={() => navigate(`/customer/products?category=${encodeURIComponent(category)}`)} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-800" aria-hidden="true">{categoryIcon(category)}</span>
                    <span className="line-clamp-2 text-sm font-bold leading-5 text-slate-800">{category}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Categories will appear when the store catalog is available.</p>
            )}
          </section>

          <section aria-labelledby="products-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Available now</p><h2 id="products-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Popular from our store</h2></div>
              <button type="button" onClick={() => navigate('/customer/search')} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:underline"><Search className="h-4 w-4" aria-hidden="true" /> Search</button>
            </div>
            {popularProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{popularProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Package className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-slate-800">The local catalog is temporarily unavailable.</p><p className="mt-1 text-sm text-slate-500">Please check back after the store inventory is updated.</p></div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
