import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { SearchBar } from '../../components/customer/SearchBar';
import { ProductGrid } from '../../components/customer/ProductGrid';
import { EmptyState } from '../../components/customer/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!q.trim()) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await customerService.searchProducts({ q: q.trim(), page, page_size: PAGE_SIZE });
        setProducts(data.products);
        setTotal(data.total);
      } catch (err: any) {
        setError(err.message || 'Search failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [q, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <SearchBar defaultValue={q} className="w-full" />

      {q && (
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {isLoading ? 'Searching…' : `${total} result${total !== 1 ? 's' : ''} for `}
            {!isLoading && <span className="text-emerald-700">"{q}"</span>}
          </p>
        </div>
      )}

      {!q ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="Search for products"
          description="Type a product name or category above to find what you need."
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Searching…" />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title={`No results for "${q}"`}
          description="Try a different search term or browse all products."
          action={{ label: 'Browse All Products', onClick: () => navigate('/customer/products') }}
        />
      ) : (
        <>
          <ProductGrid products={products} />
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
