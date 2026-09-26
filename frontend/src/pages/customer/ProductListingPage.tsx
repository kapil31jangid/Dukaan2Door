import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { SearchBar } from '../../components/customer/SearchBar';
import { ProductGrid } from '../../components/customer/ProductGrid';
import { EmptyState } from '../../components/customer/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const ProductListingPage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 20;

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
        setProducts(data.products);
        setTotal(data.total);
        if (!selectedCategory && categories.length === 0) {
          const cats = Array.from(
            new Set(data.products.map((p) => p.category).filter(Boolean) as string[])
          );
          setCategories(cats);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load products.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedCategory, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <SearchBar className="flex-1" />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => { setSelectedCategory(null); setPage(1); }}
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
            onClick={() => { setSelectedCategory(cat); setPage(1); }}
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

      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {total > 0 ? `${total} product${total !== 1 ? 's' : ''}` : ''}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Loading products…" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          description={selectedCategory ? `No products in "${selectedCategory}"` : 'No products available right now.'}
          action={selectedCategory ? { label: 'Clear Filter', onClick: () => setSelectedCategory(null) } : undefined}
        />
      ) : (
        <>
          <ProductGrid products={products} />
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600 font-medium">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
