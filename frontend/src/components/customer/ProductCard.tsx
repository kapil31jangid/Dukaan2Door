import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Package } from 'lucide-react';
import { Product } from '../../types/product';
import { useCart } from '../../context/CartContext';
import { resolveAssetUrl } from '../../services/api';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const { items, addItem, updateQty, removeItem } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const [imgError, setImgError] = useState(false);
  const imageUrl = resolveAssetUrl(product.image_url);

  const isOutOfStock = !product.is_available || product.quantity === 0;
  const canIncrease = qty < product.quantity;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQty(product.id, qty + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (qty <= 1) {
      removeItem(product.id);
    } else {
      updateQty(product.id, qty - 1);
    }
  };

  return (
    <div
      onClick={() => navigate(`/customer/products/${product.id}`)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          navigate(`/customer/products/${product.id}`);
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-3.5"
    >
      {/* Catalog provenance and availability */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/85 backdrop-blur-xs text-[10px] font-bold text-white shadow-xs">
          <Package className="w-2.5 h-2.5 text-emerald-300" />
          <span>LOCAL STORE</span>
        </div>
      </div>

      {/* Product Image Box */}
      <div className="relative w-full aspect-square rounded-xl bg-slate-50/80 mb-2.5 overflow-hidden flex items-center justify-center p-2">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-2">
            <Package className="w-12 h-12 text-slate-300 mb-2" aria-hidden="true" />
            <span className="text-[10px] font-semibold text-slate-400 line-clamp-1">{product.category || 'Product'}</span>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 mb-0.5 truncate">{product.category || 'Grocery product'}</p>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-emerald-700 transition-colors">
            {product.name}
          </h3>
        </div>

        {/* Price and Add Button Row */}
        <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between gap-1.5">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-extrabold text-slate-900">
                ₹{Math.round(product.price)}
              </span>
            </div>
          </div>

          {/* Fast add and quantity controls */}
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isOutOfStock ? (
              <button
                disabled
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed"
              >
                Sold Out
              </button>
            ) : qty === 0 ? (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 rounded-lg border border-rose-600 bg-rose-50/70 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-rose-700 shadow-2xs transition-all duration-150 hover:bg-rose-600 hover:text-white active:scale-95 sm:px-4"
              >
                <span>ADD</span>
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            ) : (
              <div className="flex items-center overflow-hidden rounded-lg bg-rose-600 text-white shadow-md shadow-rose-600/20">
                <button
                  onClick={handleDecrement}
                  className="px-2 py-1 hover:bg-emerald-700 active:bg-emerald-800 transition-colors focus:outline-none"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[3]" />
                </button>
                <span className="px-2 text-xs font-black min-w-5 text-center">{qty}</span>
                <button
                  onClick={handleIncrement}
                  disabled={!canIncrease}
                  className="px-2 py-1 hover:bg-emerald-700 active:bg-emerald-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Increase quantity"
                  title={canIncrease ? 'Increase quantity' : 'Maximum available quantity reached'}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
