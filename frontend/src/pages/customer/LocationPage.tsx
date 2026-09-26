import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Card, CardContent } from '../../components/ui/Card';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { Spinner } from '../../components/ui/Spinner';

export const LocationPage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeoLocating, setIsGeoLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    customerService.getProfile().then((p) => {
      setProfile(p);
      setAddress(p.delivery_address || '');
      setLat(p.lat?.toString() || '');
      setLng(p.lng?.toString() || '');
    }).catch(() => {});
  }, []);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setIsGeoLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude.toFixed(6));
        setLng(longitude.toFixed(6));
        setAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
        setIsGeoLocating(false);
      },
      (err) => {
        setError('Could not get your location. Please enter it manually.');
        setIsGeoLocating(false);
      }
    );
  };

  const handleSave = async () => {
    if (!address.trim()) {
      setError('Please enter a delivery address.');
      return;
    }
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    if (latNum !== undefined && (isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (lngNum !== undefined && (isNaN(lngNum) || lngNum < -180 || lngNum > 180)) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await customerService.updateProfile({
        delivery_address: address.trim(),
        lat: latNum,
        lng: lngNum,
      });
      setSuccess(true);
      setTimeout(() => navigate('/customer/home'), 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save location.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Set Delivery Location</h1>
        <p className="text-sm text-slate-500 mt-1">We'll find the nearest store to deliver to you.</p>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success">Location saved! Redirecting…</Alert>}

      {/* Current location */}
      {profile?.delivery_address && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Current Location</p>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-slate-800">{profile.delivery_address}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Geolocation option */}
      <Button
        variant="outline"
        size="lg"
        onClick={handleGeolocate}
        isLoading={isGeoLocating}
        leftIcon={<Navigation className="w-4 h-4" />}
        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
      >
        Use My Current Location
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">or enter manually</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Manual form */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Delivery Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House No, Street, Area, City, PIN"
              className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Latitude (optional)</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 28.6139"
                className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Longitude (optional)</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. 77.2090"
                className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 transition-all"
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Latitude and longitude help us find the nearest store. You can leave these blank if you're unsure.
          </p>
        </CardContent>
      </Card>

      <Button
        variant="primary"
        size="lg"
        onClick={handleSave}
        isLoading={isLoading}
        className="w-full"
        leftIcon={<CheckCircle2 className="w-4 h-4" />}
      >
        Save Location
      </Button>
    </div>
  );
};
