import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { SearchBar } from '../../components/customer/SearchBar';
import { ProductGrid } from '../../components/customer/ProductGrid';
import { EmptyState } from '../../components/customer/EmptyState';
import { Product, PaginatedProductResponse } from '../../types/product';
import { Spinner } from '../../components/ui/Spinner';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [profileData, productData] = await Promise.allSettled([
          customerService.getProfile(),
          customerService.listProducts({ page_size: 12, category: selectedCategory || undefined }),
        ]);

        if (profileData.status === 'fulfilled') {
          setProfile(profileData.value);
        }
        if (productData.status === 'fulfilled') {
          setProducts(productData.value.products);
          // Extract unique categories
          const cats = Array.from(
            new Set(productData.value.products.map((p) => p.category).filter(Boolean) as string[])
          );
          if (!selectedCategory) setCategories(cats);
        } else {
          setError('Could not load products. Please try again.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load home page');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Location bar */}
      <button
        onClick={() => navigate('/customer/location')}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-left"
      >
        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Delivering to</p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {profile?.delivery_address || 'Set your delivery location'}
          </p>
        </div>
        <span className="text-xs font-bold text-emerald-600 shrink-0">Change</span>
      </button>

      {/* Search bar */}
      <SearchBar placeholder="Search for groceries, snacks, beverages…" />

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Dukaan2Door</p>
        <h1 className="text-xl font-extrabold leading-snug">
          From the local store<br />to your door.
        </h1>
        <p className="text-sm mt-1 opacity-80">
          Fresh products from nearby stores, delivered fast.
        </p>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Browse by Category</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === null
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-800">
            {selectedCategory ? selectedCategory : 'Featured Products'}
          </p>
          <button
            onClick={() => navigate('/customer/products')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            View All →
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" label="Loading products…" />
          </div>
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products found"
            description="Check back later or try a different category."
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </div>
  );
};
