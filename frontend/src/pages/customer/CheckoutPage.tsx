import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Info, ArrowRight, Store, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { getBrowserCoordinates, reverseGeocode } from '../../services/geoService';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const isRedirectingToTracking = useRef(false);
  
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0 && !isRedirectingToTracking.current) {
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

  const handleFetchCurrentLocation = async () => {
    setIsFetchingLocation(true);
    setError(null);
    try {
      const coords = await getBrowserCoordinates();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);
      setAddress(resolvedAddress);
      setLat(coords.lat);
      setLng(coords.lng);
      
      // Also update customer profile in background
      customerService.updateProfile({
        delivery_address: resolvedAddress,
        lat: coords.lat,
        lng: coords.lng,
      }).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Could not fetch device GPS location. Please type your delivery address.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

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
      
      isRedirectingToTracking.current = true;
      clearCart();
      navigate(`/customer/orders/${order.id}/confirmation`, { replace: true });
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
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Almost there</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">Confirm your delivery details and place the order with the local store.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-label="Checkout progress">
        {['Delivery', 'Payment', 'Review'].map((step, index) => (
          <div key={step} className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>{index + 1}</span>
            <span className="hidden sm:inline">{step}</span>
            {index < 2 && <span className="ml-auto h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>

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
            <span className="text-xl font-black text-emerald-600">₹{totalPrice.toFixed(2)}</span>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Delivery Address *</label>
              <button
                type="button"
                onClick={handleFetchCurrentLocation}
                disabled={isFetchingLocation}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60"
              >
                {isFetchingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{isFetchingLocation ? 'Detecting GPS...' : 'Use Current GPS'}</span>
              </button>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House No, Street, Area, City"
              className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            {lat && lng && (
              <p className="mt-1 text-[11px] text-slate-400">
                GPS pinned: {lat.toFixed(4)}, {lng.toFixed(4)}
              </p>
            )}
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
              We will verify this location and the local store's inventory when you place the order.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Payment method</h2>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <input id="cash-on-delivery" type="radio" checked readOnly className="h-4 w-4 accent-emerald-600" />
            <label htmlFor="cash-on-delivery" className="text-sm font-bold text-slate-800">Cash on Delivery</label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Online payments are not enabled in the current backend.</p>
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