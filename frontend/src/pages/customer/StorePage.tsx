import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Store, MapPin, Clock3, Package, Truck, ArrowRight, Filter } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { ProductGrid } from '../../components/customer/ProductGrid';
import { EmptyState } from '../../components/customer/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { useCart } from '../../context/CartContext';

export const StorePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 24;
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    customerService.listProducts({ page_size: 100 })
      .then((data) => { if (!cancelled) { setProducts(data.products); setCategories(Array.from(new Set(data.products.map((product) => product.category).filter((category): category is string => Boolean(category))))); setTotal(data.total); } })
      .catch((err: any) => { if (!cancelled) setError(err.message || 'Failed to load store catalog.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await customerService.listProducts({
          category: selectedCategory || undefined,
          page,
          page_size: PAGE_SIZE,
        });
        setProducts(data.products);
        setTotal(data.total || 0);
        
        // Extract categories from products
        if (!cancelled) setCategories(Array.from(new Set(data.products.map((p: Product) => p.category).filter((cat): cat is string => Boolean(cat)))));
      } catch (err: any) {
        setError(err.message || 'Failed to load products.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedCategory, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleCategorySelect = (cat: string | null) => {
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  };

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || null);
    setPage(1);
  }, [searchParams]);

  // Load store profile info
  useEffect(() => {
    let cancelled = false;
    customerService.getProfile().then((p) => {
      if (!cancelled) setDeliveryLocation(p.delivery_address || '');
    }).catch(() => {}).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      {/* Store header with delivery location */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              <Store className="h-4 w-4" aria-hidden="true" />
              Your neighbourhood store
            </p>
            <h1 className="max-w-xl text-3xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-4xl">
              Dukaan2Door Local Store
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
              Groceries and daily essentials delivered to your door. Open now and delivering today.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/customer/products')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                Browse products <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => navigate('/customer/location')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                <MapPin className="h-4 w-4" aria-hidden="true" /> {deliveryLocation ? 'Change delivery location' : 'Set delivery location'}
              </button>
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl bg-white sm:h-40">
              <Store className="h-14 w-14 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Store status</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Open</h2>
              <p className="mt-1 text-sm text-slate-600">Delivering until 10 PM</p>
            </div>
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-bold text-emerald-800">
              Free delivery on orders over ₹299
            </Badge>
          </div>
        </div>
      </section>

      {/* Category filters */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>Select Category</span>
          </div>
          {total > 0 && (
            <span className="text-xs font-semibold text-slate-500">
              Showing {products.length} of {total} products
            </span>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => handleCategorySelect(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === null
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {selectedCategory || 'All Products & Essentials'}
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Sort by:</span>
          <select
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          >
            <option value="default">Relevance & Popularity</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Fetching products from the local store…" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products available in this category"
          description="Try selecting another category or clear your filters to view other daily essentials."
          action={{
            label: 'View All Products',
            onClick: () => handleCategorySelect(null),
          }}
        />
      ) : (
        <>
          <ProductGrid products={products} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6 pb-4">
              <button
                disabled={page === 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>Previous</span>
              </button>
              <span className="text-xs text-slate-600 font-bold">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <span>Next</span>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
