import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Check, PackageX } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Product } from '../../types/product';
import { useCart } from '../../context/CartContext';
import { QuantitySelector } from '../../components/customer/QuantitySelector';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Card, CardContent } from '../../components/ui/Card';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, addItem, updateQty, removeItem } = useCart();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await customerService.getProduct(parseInt(id, 10));
        setProduct(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load product details.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading product…" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Alert variant="error">{error || 'Product not found.'}</Alert>
      </div>
    );
  }

  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const isOutOfStock = !product.is_available || product.quantity === 0;

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleQtyChange = (newQty: number) => {
    if (newQty <= 0) removeItem(product.id);
    else updateQty(product.id, newQty);
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Card className="overflow-hidden">
        {/* Placeholder Image area */}
        <div className="w-full h-48 sm:h-64 bg-emerald-50 flex items-center justify-center border-b border-slate-100">
          <span className="text-4xl font-black text-emerald-600/20">{product.name.charAt(0).toUpperCase()}</span>
        </div>

        <CardContent className="p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              {product.category && (
                <Badge variant="info" className="mb-2">{product.category}</Badge>
              )}
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {product.name}
              </h1>
            </div>
            {isOutOfStock && (
              <Badge variant="danger" className="shrink-0 flex items-center gap-1">
                <PackageX className="w-3.5 h-3.5" /> Out of Stock
              </Badge>
            )}
          </div>

          <p className="text-3xl font-black text-emerald-700 mt-4">
            ₹{product.price.toFixed(2)}
          </p>

          {product.description && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Description</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100">
            {isOutOfStock ? (
              <Button disabled variant="outline" className="w-full" size="lg">
                Currently Unavailable
              </Button>
            ) : qty > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full bg-slate-50 p-2 rounded-xl flex items-center justify-center">
                  <QuantitySelector
                    value={qty}
                    onChange={handleQtyChange}
                    min={0}
                    max={product.quantity}
                    className="scale-110"
                  />
                </div>
                <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => navigate('/customer/cart')}>
                  View Cart
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold text-lg"
                onClick={handleAdd}
                leftIcon={added ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
              >
                {added ? 'Added to Cart' : 'Add to Cart'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
