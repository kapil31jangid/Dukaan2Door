import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Package, Search, Store, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { resolveAssetUrl } from '../../services/api';
import { Product } from '../../types/product';
import { ProductCard } from '../../components/customer/ProductCard';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { Order } from '../../types/order';
import { useCart } from '../../context/CartContext';

const categoryIcon = (category: string) => category.trim().charAt(0).toUpperCase() || 'P';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { items: cartItems, totalItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    customerService.listProducts({ page_size: 100 })
      .then((response) => { if (!cancelled) setProducts(response.products); })
      .catch((err: any) => { if (!cancelled) setError(err.message || 'Unable to load the local store catalog.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshActiveOrder = async () => {
      try {
        const orders = await customerService.getOrders({ page_size: 20 });
        if (cancelled) return;
        const current = orders.find((order) => !['DELIVERED', 'REJECTED', 'CANCELLED'].includes(order.status));
        setActiveOrder(current || null);
      } catch {
        if (!cancelled) setActiveOrder(null);
      }
    };

    refreshActiveOrder();
    const interval = window.setInterval(refreshActiveOrder, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter((category): category is string => Boolean(category)))),
    [products],
  );
  const popularProducts = products.filter((product) => product.is_available && product.quantity > 0).slice(0, 8);

  return (
    <div className="space-y-7 pb-4">
      {/* Header section */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              <Store className="h-4 w-4" aria-hidden="true" />
              Your neighbourhood store
            </p>
            <h1 className="max-w-xl text-3xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-[2.6rem]">
              Groceries and everyday essentials, delivered locally.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
              Shop from Dukaan2Door Local Store. Your address{" "}
              {deliveryLocation || 'will be confirmed at checkout'}.{' '}
              Stock and delivery partner are confirmed through the live order workflow.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/customer/store')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2">
                Shop now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => navigate('/customer/location')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                <MapPin className="h-4 w-4" aria-hidden="true" /> Set delivery location
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-[#fff1f2] p-4 sm:p-5">
            {cartItems.length > 0 && (
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Cart</p>
                  <p className="mt-1 font-medium text-slate-900">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
            {resolveAssetUrl(popularProducts[0]?.image_url) && (
              <div className="mb-4 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-white">
                <img
                  src={resolveAssetUrl(popularProducts[0]?.image_url) || undefined}
                  alt={popularProducts[0].name}
                  className="h-full w-full object-contain p-3"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Store status</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Dukaan2Door Local Store</h2>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800">Open</span>
            </div>
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-700" />Matched to your delivery location</p>
              <p className="flex items-center gap-2"><Package className="h-4 w-4 text-emerald-700" />Stock checked at checkout</p>
              <p className="flex items-center gap-2"><Store className="h-4 w-4 text-emerald-700" />Direct local-store fulfillment</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-xl bg-rose-600 px-5 py-5 text-white sm:flex-row sm:items-center sm:px-7">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-100">Local ordering, made simple</p><h2 className="mt-1 text-xl font-black">Shop verified stock from your nearby store.</h2><p className="mt-1 text-sm text-rose-100">Availability is checked again before your order is accepted.</p></div>
        <button type="button" onClick={() => navigate('/customer/store')} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">Browse products <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </section>

      {/* Active order indicator */}
      {activeOrder && (
        <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Truck className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Order #{activeOrder.id} is active</p>
              <h2 className="mt-1 font-extrabold text-slate-950">{activeOrder.status.replace(/_/g, ' ')}</h2>
              <p className="mt-1 text-sm text-slate-600">Your retailer and delivery partner updates will appear here.</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate(`/customer/orders/${activeOrder.id}/status`)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Track order <ArrowRight className="h-4 w-4" /></button>
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" label="Loading products from the local store…" /></div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <>
          {/* Categories section */}
          <section aria-labelledby="categories-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Shop essentials</p>
                <h2 id="categories-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Browse by category</h2>
              </div>
              <button type="button" onClick={() => navigate('/customer/products')} className="text-sm font-bold text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:underline">View all</button>
            </div>
            {categories.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {categories.slice(0, 10).map((category) => (
                  <button type="button" key={category} onClick={() => navigate(`/customer/products?category=${encodeURIComponent(category)}`)} className="flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-800" aria-hidden="true">{categoryIcon(category)}</span>
                    <span className="line-clamp-2 text-xs font-bold leading-4 text-slate-800">{category}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Categories will appear when the store catalog is available.</p>
            )}
          </section>

          {/* Products section */}
          <section aria-labelledby="products-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Available now</p>
                <h2 id="products-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Popular near you</h2>
              </div>
              <button type="button" onClick={() => navigate('/customer/search')} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:underline"><Search className="h-4 w-4" aria-hidden="true" /> Search</button>
            </div>
            {popularProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {popularProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Package className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-slate-800">The local catalog is temporarily unavailable.</p><p className="mt-1 text-sm text-slate-500">Please check back after the store inventory is updated.</p></div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
