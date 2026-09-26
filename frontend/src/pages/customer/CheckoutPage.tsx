import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Info, ArrowRight, Store, AlertCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, clearCart } = useCart();
  
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/customer/cart', { replace: true });
      return;
    }
    
    customerService.getProfile().then((p) => {
      setProfile(p);
      setAddress(p.delivery_address || '');
      setLat(p.lat || undefined);
      setLng(p.lng || undefined);
      setIsLoadingProfile(false);
    }).catch(() => {
      setIsLoadingProfile(false);
    });
  }, [items.length, navigate]);

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      setError('Please provide a delivery address.');
      return;
    }
    
    setIsPlacingOrder(true);
    setError(null);
    
    try {
      const order = await customerService.placeOrder({
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_address: address.trim(),
        delivery_lat: lat,
        delivery_lng: lng,
        notes: notes.trim() || undefined,
      });
      
      clearCart();
      // Navigate to tracking timeline
      navigate(`/customer/orders/${order.id}/status`, { replace: true });
    } catch (err: any) {
      if (err.status === 404) {
        setError('No store found nearby with these items in stock. Please try a different location or update your cart.');
      } else if (err.status === 409) {
        setError('Some items in your cart are now out of stock. Please return to cart and update quantities.');
      } else {
        setError(err.message || 'Failed to place order. Please try again.');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isLoadingProfile) {
    return <div className="p-8 text-center text-slate-500">Loading checkout...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Checkout</h1>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Order Summary</h2>
          </div>
          
          <div className="space-y-3 mb-4">
            {items.map(item => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span className="text-slate-600">{item.quantity} × {item.name}</span>
                <span className="font-semibold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-900">Total to Pay</span>
            <span className="text-xl font-black text-emerald-700">₹{totalPrice.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Delivery Details</h2>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Delivery Address *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House No, Street, Area, City"
              className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Delivery Instructions (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ring the doorbell, leave at gate..."
              rows={2}
              className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
            />
          </div>
          
          <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">
              We'll automatically find the nearest Dukaan2Door partner store that has your items in stock.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="primary"
        size="lg"
        className="w-full font-bold text-lg"
        onClick={handlePlaceOrder}
        isLoading={isPlacingOrder}
        disabled={isPlacingOrder}
        rightIcon={!isPlacingOrder ? <ArrowRight className="w-5 h-5" /> : undefined}
      >
        {isPlacingOrder ? 'Finding Nearest Store...' : 'Place Order'}
      </Button>
    </div>
  );
};
