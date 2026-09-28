import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { ProductGrid } from '../../components/customer/ProductGrid';
import { EmptyState } from '../../components/customer/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

const ALL_CATEGORIES = [
  'Fruits & Vegetables',
  'Dairy & Bakery',
  'Groceries',
  'Snacks & Packaged Foods',
  'Beverages',
  'Personal Care',
  'Household Cleaning',
  'Baby Care',
  'Pooja & Daily Essentials',
  'Other Kirana Essentials',
];

export const ProductListingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 24;

  useEffect(() => {
    setSelectedCategory(categoryParam);
    setPage(1);
  }, [categoryParam]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await customerService.listProducts({
          category: selectedCategory || undefined,
          page,
          page_size: PAGE_SIZE,
        });

        let list = data.products;
        if (sortBy === 'price_asc') {
          list = [...list].sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_desc') {
          list = [...list].sort((a, b) => b.price - a.price);
        }

        setProducts(list);
        setTotal(data.total);
      } catch (err: any) {
        setError(err.message || 'Failed to load products.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedCategory, page, sortBy]);

  const handleCategorySelect = (cat: string | null) => {
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      
      {/* Category Pills Header */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-purple-600" />
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
                ? 'bg-purple-700 text-white shadow-md shadow-purple-700/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            All Categories
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-purple-700 text-white shadow-md shadow-purple-700/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Sorting & Active Category Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {selectedCategory || 'All Products & Essentials'}
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
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
          <Spinner size="lg" label="Fetching products from nearest kirana store…" />
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
                <ChevronLeft className="w-4 h-4" />
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
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductListingPage;
