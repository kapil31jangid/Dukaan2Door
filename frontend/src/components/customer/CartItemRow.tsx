import React from 'react';
import { Trash2 } from 'lucide-react';
import { CartItem } from '../../context/CartContext';
import { QuantitySelector } from './QuantitySelector';

interface CartItemRowProps {
  item: CartItem;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onQtyChange, onRemove }) => {
  const subtotal = item.price * item.quantity;

  return (
    <div className="flex items-start gap-3 py-4 border-b border-slate-100 last:border-0">
      {/* Icon placeholder */}
      <div className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-lg bg-rose-50 text-lg font-bold text-rose-600">
        {item.name.charAt(0).toUpperCase()}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 leading-snug truncate">{item.name}</p>
        {item.category && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.category}</p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">₹{item.price.toFixed(2)} each</p>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <p className="text-sm font-bold text-slate-900">₹{subtotal.toFixed(2)}</p>
        <div className="flex items-center gap-2">
          <QuantitySelector value={item.quantity} onChange={onQtyChange} min={0} />
          <button
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
