import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Package, Search, Store, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { resolveAssetUrl } from '../../services/api';
import { Product } from '../../types/product';
import { ProductCard } from '../../components/customer/ProductCard';
import { ProductGridSkeleton } from '../../components/customer/ProductGrid';
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
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div><p className="text-xs font-bold text-rose-700">YOUR EVERYDAY ESSENTIALS</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Fresh picks. Local shelves.</h1><p className="mt-2 text-sm text-slate-500">Groceries, household supplies, and more from your local catalogue.</p></div>
        <button onClick={() => navigate('/customer/store')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold"><Store className="h-4 w-4 text-rose-600" />Browse store<ArrowRight className="h-4 w-4" /></button>
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
        <ProductGridSkeleton />
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
                <h2 id="products-heading" className="mt-1 text-xl font-bold text-slate-950">Available essentials</h2>
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
