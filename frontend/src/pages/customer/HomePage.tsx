import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Percent,
  ChevronRight,
  ShoppingBag,
  Flame,
  Coffee,
  Sun
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { ProductCard } from '../../components/customer/ProductCard';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

// Curated Category Grid Definitions with Zepto-style visuals & gradients
const SHOP_CATEGORIES = [
  {
    id: 'Fruits & Vegetables',
    name: 'Fruits & Vegetables',
    icon: '🥦',
    bg: 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-100',
    itemCount: 'Fresh Daily',
  },
  {
    id: 'Dairy & Bakery',
    name: 'Dairy, Bread & Eggs',
    icon: '🥛',
    bg: 'bg-blue-50 hover:bg-blue-100/80 border-blue-100',
    itemCount: 'Morning Staples',
  },
  {
    id: 'Groceries',
    name: 'Atta, Rice, Oil & Dals',
    icon: '🌾',
    bg: 'bg-amber-50 hover:bg-amber-100/80 border-amber-100',
    itemCount: 'Pantry Essentials',
  },
  {
    id: 'Snacks & Packaged Foods',
    name: 'Packaged Food & Snacks',
    icon: '🍿',
    bg: 'bg-orange-50 hover:bg-orange-100/80 border-orange-100',
    itemCount: 'Munchies & Biscuits',
  },
  {
    id: 'Beverages',
    name: 'Tea, Coffee & Drinks',
    icon: '🧃',
    bg: 'bg-red-50 hover:bg-red-100/80 border-red-100',
    itemCount: 'Cold & Hot Sips',
  },
  {
    id: 'Personal Care',
    name: 'Personal Care & Hygiene',
    icon: '🧴',
    bg: 'bg-purple-50 hover:bg-purple-100/80 border-purple-100',
    itemCount: 'Bath & Grooming',
  },
  {
    id: 'Household Cleaning',
    name: 'Cleaning & Household',
    icon: '🧹',
    bg: 'bg-cyan-50 hover:bg-cyan-100/80 border-cyan-100',
    itemCount: 'Detergent & Mops',
  },
  {
    id: 'Baby Care',
    name: 'Baby Care & Diapers',
    icon: '👶',
    bg: 'bg-pink-50 hover:bg-pink-100/80 border-pink-100',
    itemCount: 'Infant Needs',
  },
  {
    id: 'Pooja & Daily Essentials',
    name: 'Pooja & Daily Essentials',
    icon: '🪔',
    bg: 'bg-yellow-50 hover:bg-yellow-100/80 border-yellow-100',
    itemCount: 'Agarbatti & Camphor',
  },
  {
    id: 'Other Kirana Essentials',
    name: 'Paan & Local Corner',
    icon: '🏪',
    bg: 'bg-teal-50 hover:bg-teal-100/80 border-teal-100',
    itemCount: 'Foils & Disposables',
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await customerService.listProducts({ page_size: 40 });
        setAllProducts(res.products);
      } catch (err: any) {
        setError(err.message || 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Filter products by domain category for curated sections
  const dairyProducts = allProducts.filter((p) => p.category === 'Dairy & Bakery');
  const groceryProducts = allProducts.filter((p) => p.category === 'Groceries');
  const snackProducts = allProducts.filter((p) => p.category === 'Snacks & Packaged Foods');
  const personalCareProducts = allProducts.filter((p) => p.category === 'Personal Care');
  const beverageProducts = allProducts.filter((p) => p.category === 'Beverages');

  return (
    <div className="space-y-10">
      
      {/* 1. Zepto Hero Promotional Banners (2 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Left Card: All New Experience & Zero Fees */}
        <div className="relative rounded-3xl bg-gradient-to-br from-purple-100 via-pink-50 to-purple-50 p-6 sm:p-8 border border-purple-200/60 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 rounded-full bg-purple-600 text-white text-[11px] font-black uppercase tracking-wider mb-4 shadow-xs">
              ALL NEW DUKAAN2DOOR EXPERIENCE
            </span>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 my-2">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-purple-100 shadow-xs">
                <span className="text-2xl font-black text-purple-700">₹0</span>
                <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-tight">
                  FEES ON<br />ORDERS
                </span>
              </div>

              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-purple-100 shadow-xs">
                <span className="text-xl">📉</span>
                <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-tight">
                  EVERYDAY<br />LOW PRICES*
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-purple-200/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 fill-emerald-100" /> ₹0 Handling Fee
            </span>
            <span className="flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 fill-emerald-100" /> ₹0 Delivery Fee*
            </span>
            <span className="flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 fill-emerald-100" /> ₹0 Surge Fee
            </span>
          </div>

          {/* Decorative background blobs */}
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-pink-300/30 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-purple-300/30 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Right Card: Paan & Local Kirana Corner */}
        <div className="relative rounded-3xl bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-100/70 p-6 sm:p-8 border border-teal-200/60 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 max-w-sm">
            <div className="flex items-center gap-1.5 text-xs font-black text-teal-800 uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>DIRECT FROM NEARBY STORE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              LOCAL KIRANA <br />
              <span className="text-teal-700">DELIVERED IN 10 MINS</span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm font-medium text-slate-600">
              Get pantry staples, morning milk, cold refreshments & snacks delivered right to your doorstep.
            </p>
          </div>

          <div className="relative z-10 mt-6">
            <button
              onClick={() => navigate('/customer/products')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-md active:scale-95 group"
            >
              <span>Explore Catalog</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Decorative icons */}
          <div className="absolute right-4 bottom-4 text-6xl opacity-30 select-none pointer-events-none">
            🛍️
          </div>
        </div>

      </div>

      {/* 2. Shop by Category Grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Shop by Category
            </h2>
            <p className="text-xs text-slate-500 font-medium">Explore fresh essentials, snacks & household groceries</p>
          </div>
          <button
            onClick={() => navigate('/customer/products')}
            className="flex items-center gap-1 text-xs font-black text-purple-700 hover:text-purple-800 transition-colors"
          >
            <span>See All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {SHOP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/customer/products?category=${encodeURIComponent(cat.id)}`)}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col justify-between group ${cat.bg}`}
            >
              <div className="text-3xl sm:text-4xl mb-3 group-hover:scale-110 transition-transform origin-left">
                {cat.icon}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                  {cat.name}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{cat.itemCount}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Loading or Error State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" label="Loading fresh products from local stores…" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <>
          {/* 3. Trending 10-Minute Best Deals */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Trending in 10 Mins
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Most ordered items in your neighbourhood</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/customer/products')}
                className="text-xs font-black text-purple-700 hover:text-purple-800"
              >
                View All →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {allProducts.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>

          {/* 4. Dairy, Bread & Morning Staples */}
          {dairyProducts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Sun className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      Dairy, Bread & Morning Staples
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Fresh milk, butter, curd & bakery essentials</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/customer/products?category=Dairy%20%26%20Bakery')}
                  className="text-xs font-black text-purple-700 hover:text-purple-800"
                >
                  View All →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {dairyProducts.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* 5. Snacks & Instant Munchies */}
          {snackProducts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                    <span className="text-lg">🍿</span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      Snacks & Instant Munchies
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Biscuits, chips, namkeen & instant noodles</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/customer/products?category=Snacks%20%26%20Packaged%20Foods')}
                  className="text-xs font-black text-purple-700 hover:text-purple-800"
                >
                  View All →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {snackProducts.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* 6. Atta, Rice, Oil & Dals */}
          {groceryProducts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <span className="text-lg">🌾</span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      Atta, Rice, Cooking Oil & Spices
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Daily cooking staples from trusted local brands</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/customer/products?category=Groceries')}
                  className="text-xs font-black text-purple-700 hover:text-purple-800"
                >
                  View All →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {groceryProducts.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* 7. Personal Care & Daily Hygiene */}
          {personalCareProducts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                    <span className="text-lg">🧴</span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      Personal Care & Grooming
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Soaps, face wash, shampoos & body care</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/customer/products?category=Personal%20Care')}
                  className="text-xs font-black text-purple-700 hover:text-purple-800"
                >
                  View All →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {personalCareProducts.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

    </div>
  );
};

export default HomePage;
