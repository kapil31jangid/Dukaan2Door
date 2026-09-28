import React, { useState, useEffect, useMemo } from 'react';
import { retailerService } from '../../services/retailerService';
import { Product, ProductCreate, ProductUpdate } from '../../types/product';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { ProductModal } from '../../components/retailer/ProductModal';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Package,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const RetailerInventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [stockInput, setStockInput] = useState<number>(0);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await retailerService.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load store products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Extract unique categories from actual products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  const handleSaveProduct = async (
    payload: ProductCreate | ProductUpdate,
    productId?: number
  ) => {
    if (productId) {
      await retailerService.updateProduct(productId, payload as ProductUpdate);
      setNotice('Product details updated successfully');
    } else {
      await retailerService.createProduct(payload as ProductCreate);
      setNotice('New product added to store catalog');
    }
    await fetchProducts();
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      const updated = await retailerService.patchProductAvailability(product.id, {
        is_available: !product.is_available,
      });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      setNotice(`${product.name} is now ${updated.is_available ? 'in stock & available' : 'marked out of stock'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle availability');
    }
  };

  const handleSaveStock = async (productId: number) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const updated = await retailerService.patchProductAvailability(productId, {
        is_available: product.is_available,
        quantity: stockInput,
      });
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setEditingStockId(null);
      setNotice(`Stock updated for ${product.name}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update stock');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to deactivate "${product.name}"?`)) return;
    try {
      await retailerService.deleteProduct(product.id);
      setNotice(`"${product.name}" removed from active catalog`);
      await fetchProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to remove product');
    }
  };

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery, selectedCategory]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, pageSize]);

  // Paginate filtered results
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Catalog & Inventory"
        description="Manage your items, unit prices, live stock counts, and customer visibility"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchProducts}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setSelectedProduct(null);
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Product
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {notice && (
        <Alert variant="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search items by name, code, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-48 py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-700"
            >
              <option value="ALL">All Categories ({products.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 font-medium">
          <span>
            Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} items
          </span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="py-1 px-2 text-xs rounded-lg border border-slate-200 bg-white font-semibold text-slate-600"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <Spinner size="lg" label="Loading catalog items..." />
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">No products found</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'Try adjusting your search or category filter.'
              : 'Click "Add Product" to create your first item.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/80 font-bold text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left">Product Title</th>
                    <th className="px-5 py-3 text-left">Category</th>
                    <th className="px-5 py-3 text-right">Unit Price</th>
                    <th className="px-5 py-3 text-center">Stock Count</th>
                    <th className="px-5 py-3 text-center">Availability</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                                    '<div class="w-full h-full flex items-center justify-center"><svg xmlns=\'http://www.w3.org/2000/svg\' class=\'w-5 h-5 text-slate-300\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4\'/></svg></div>';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{product.name}</p>
                            {product.description && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">{product.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {product.category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-extrabold text-slate-900">
                        ₹{product.price.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {editingStockId === product.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={stockInput}
                              onChange={(e) => setStockInput(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-xs border rounded-lg text-center"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveStock(product.id)}
                              className="text-xs text-emerald-600 font-bold hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStockId(null)}
                              className="text-xs text-slate-400 hover:underline"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingStockId(product.id);
                              setStockInput(product.quantity);
                            }}
                            className={`font-bold px-2.5 py-1 rounded-lg border text-xs transition-colors hover:border-emerald-300 ${
                              product.quantity > 5
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : product.quantity > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                            title="Click to edit stock"
                          >
                            {product.quantity} units
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleAvailability(product)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            product.is_available && product.quantity > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {product.is_available && product.quantity > 0 ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>In Stock</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Unavailable</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-600">
              <span className="font-medium text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Prev
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = currentPage;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                          currentPage === pageNum
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Add / Edit Modal */}
      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
      />
    </div>
  );
};

