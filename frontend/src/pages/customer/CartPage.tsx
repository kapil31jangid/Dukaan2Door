import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CartItemRow } from '../../components/customer/CartItemRow';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/customer/EmptyState';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, updateQty, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-8 h-8" />}
        title="Your cart is empty"
        description="Looks like you haven't added anything to your cart yet."
        action={{ label: 'Browse Products', onClick: () => navigate('/customer/products') }}
      />
    );
  }

  // Group items by store to show a warning if multiple stores are in the cart
  const storeIds = new Set(items.map((i) => i.store_id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Your Cart</h1>
      
      {storeIds.size > 1 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
          Note: Your cart contains items from multiple stores. We will automatically find a store that can fulfill your entire order, but some items might become unavailable during checkout.
        </div>
      )}

      <Card>
        <CardContent className="p-0 sm:p-2">
          <div className="px-4 sm:px-2">
            {items.map((item) => (
              <CartItemRow
                key={item.product_id}
                item={item}
                onQtyChange={(qty) => updateQty(item.product_id, qty)}
                onRemove={() => removeItem(item.product_id)}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t border-slate-100 p-4 sm:p-5 flex flex-col gap-4 rounded-b-2xl">
          <div className="flex items-center justify-between w-full text-sm font-semibold text-slate-600">
            <span>Subtotal ({totalItems} items)</span>
            <span>₹{totalPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between w-full text-lg font-black text-slate-900">
            <span>Total</span>
            <span className="text-emerald-700">₹{totalPrice.toFixed(2)}</span>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full mt-2"
            rightIcon={<ArrowRight className="w-5 h-5" />}
            onClick={() => navigate('/customer/checkout')}
          >
            Proceed to Checkout
          </Button>
          <button
            onClick={() => navigate('/customer/products')}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Continue Shopping
          </button>
        </CardFooter>
      </Card>
    </div>
  );
};
