import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Package } from 'lucide-react';
import { Product } from '../../types/product';
import { useCart } from '../../context/CartContext';
import { resolveAssetUrl } from '../../services/api';

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const { items, addItem, updateQty, removeItem } = useCart();
  const qty = items.find(item => item.product_id === product.id)?.quantity ?? 0;
  const [imageFailed, setImageFailed] = useState(false);
  const image = resolveAssetUrl(product.image_url);
  const unavailable = !product.is_available || product.quantity <= 0;
  return <article className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-rose-200">
    <Link to={`/customer/products/${product.id}`} className="group flex flex-1 flex-col" aria-label={`View ${product.name}`}>
      <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-50 p-3">
        {image && !imageFailed ? <img src={image} alt={product.name} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-contain mix-blend-multiply" /> : <Package className="h-12 w-12 text-slate-300" aria-hidden="true" />}
      </div>
      <p className="min-h-4 truncate text-[11px] font-medium text-slate-500">{product.brand || product.category}</p>
      <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900 group-hover:text-rose-700">{product.name}</h3>
      <p className="mt-1 text-xs text-slate-500">{product.unit}</p>
    </Link>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-extrabold tabular-nums">₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
      {unavailable ? <span className="text-xs font-semibold text-slate-500">Out of stock</span> : qty === 0 ? <button aria-label={`Add ${product.name} to cart`} onClick={() => addItem(product, 1)} className="flex min-h-10 items-center gap-1 rounded-lg border border-rose-600 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50">Add <Plus className="h-4 w-4" /></button> : <div className="flex h-10 items-center rounded-lg bg-rose-600 text-white">
        <button aria-label={`Decrease ${product.name} quantity`} onClick={() => qty === 1 ? removeItem(product.id) : updateQty(product.id, qty - 1)} className="flex h-10 w-8 items-center justify-center rounded-l-lg hover:bg-rose-700"><Minus className="h-4 w-4" /></button>
        <span className="min-w-5 text-center text-xs font-bold" aria-live="polite">{qty}</span>
        <button aria-label={`Increase ${product.name} quantity`} disabled={qty >= product.quantity} onClick={() => updateQty(product.id, qty + 1)} className="flex h-10 w-8 items-center justify-center rounded-r-lg hover:bg-rose-700 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
      </div>}
    </div>
  </article>;
};
