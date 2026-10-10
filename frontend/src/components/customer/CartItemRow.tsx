import React, { useState } from 'react';
import { Package, Trash2 } from 'lucide-react';
import { resolveAssetUrl } from '../../services/api';
import { CartItem } from '../../context/CartContext';
import { QuantitySelector } from './QuantitySelector';

interface CartItemRowProps {
  item: CartItem;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onQtyChange, onRemove }) => {
  const subtotal = item.price * item.quantity;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-4 border-b border-slate-100 last:border-0 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
      {/* Icon placeholder */}
      <div className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-lg bg-rose-50 text-lg font-bold text-rose-600">
        {item.image_url && !imageFailed ? <img src={resolveAssetUrl(item.image_url) || undefined} alt={item.name} onError={() => setImageFailed(true)} className="h-full w-full object-contain" /> : <Package className="h-6 w-6" />}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 leading-snug break-words">{item.name}</p>
        {item.category && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.category}</p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">₹{item.price.toFixed(2)} each</p>
      </div>

      {/* Right side */}
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
        <p className="text-sm font-bold text-slate-900">₹{subtotal.toFixed(2)}</p>
        <div className="flex items-center gap-2">
          <QuantitySelector value={item.quantity} onChange={onQtyChange} min={0} />
          <button
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
