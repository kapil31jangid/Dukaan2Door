import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Check } from 'lucide-react';
import { Product } from '../../types/product';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { useCart } from '../../context/CartContext';
import { QuantitySelector } from './QuantitySelector';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const { items, addItem, updateQty, removeItem } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const [added, setAdded] = React.useState(false);

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleQtyChange = (newQty: number) => {
    if (newQty <= 0) removeItem(product.id);
    else updateQty(product.id, newQty);
  };

  const isOutOfStock = !product.is_available || product.quantity === 0;

  return (
    <Card
      className="flex flex-col cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      onClick={() => navigate(`/customer/products/${product.id}`)}
    >
      {/* Category Header */}
      <div className="bg-emerald-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        {product.category ? (
          <Badge variant="info" size="sm">{product.category}</Badge>
        ) : (
          <Badge variant="default" size="sm">General</Badge>
        )}
        {isOutOfStock && (
          <Badge variant="danger" size="sm">Out of Stock</Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-emerald-700">
            ₹{product.price.toFixed(2)}
          </span>

          {isOutOfStock ? (
            <span className="text-xs text-slate-400 font-medium">Unavailable</span>
          ) : qty > 0 ? (
            <div onClick={(e) => e.stopPropagation()}>
              <QuantitySelector
                value={qty}
                onChange={handleQtyChange}
                min={0}
                max={product.quantity}
              />
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAdd();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {added ? (
                <><Check className="w-3.5 h-3.5" /> Added</>
              ) : (
                <><Plus className="w-3.5 h-3.5" /> Add</>
              )}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};
