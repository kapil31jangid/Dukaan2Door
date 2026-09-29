import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin, ShoppingCart, Store } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CartItemRow } from '../../components/customer/CartItemRow';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/customer/EmptyState';
import { Card, CardContent } from '../../components/ui/Card';

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
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Ready when you are</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Your cart</h1>
        <p className="mt-1 text-sm text-slate-500">Review your local-store order before checkout.</p>
      </div>

      {storeIds.size > 1 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
          Note: Your cart contains items from multiple stores. We will automatically find a store that can fulfill your entire order, but some items might become unavailable during checkout.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] lg:items-start">
        <Card>
          <CardContent className="p-0 sm:p-2">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Store className="h-4 w-4" /></div>
              <div><p className="text-sm font-extrabold text-slate-900">Dukaan2Door Local Store</p><p className="text-xs text-slate-500">Local delivery · stock checked at checkout</p></div>
            </div>
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
        </Card>

        <Card className="lg:sticky lg:top-24">
          <CardContent className="space-y-5 p-5">
            <div><h2 className="text-base font-extrabold text-slate-950">Order summary</h2><p className="mt-1 text-xs text-slate-500">{totalItems} item{totalItems !== 1 ? 's' : ''} from your local store</p></div>
            <div className="space-y-3 border-y border-slate-100 py-4 text-sm">
              <div className="flex items-center justify-between text-slate-600"><span>Subtotal</span><span>₹{totalPrice.toFixed(2)}</span></div>
              <div className="flex items-center justify-between text-sm"><span>Delivery</span><span className="font-semibold text-emerald-600">Free on orders over ₹299</span></div>
              <div className="flex items-center justify-between text-base font-black text-slate-950"><span>Total</span><span className="text-emerald-600">₹{totalPrice.toFixed(2)}</span></div>
            </div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-700" />Address confirmed at checkout</p>
              <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-700" />Delivery timing depends on store availability</p>
            </div>
            <Button variant="primary" size="lg" className="w-full" rightIcon={<ArrowRight className="w-5 h-5" />} onClick={() => navigate('/customer/checkout')}>
              Proceed to Checkout
            </Button>
            <button onClick={() => navigate('/customer/store')} className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800">Continue shopping</button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
