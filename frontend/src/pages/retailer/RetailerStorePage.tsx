import React, { useState, useEffect } from 'react';
import { retailerService } from '../../services/retailerService';
import { StoreProfile, RetailerProfile } from '../../types/user';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { InteractiveStoreLocationPicker } from '../../components/maps/InteractiveStoreLocationPicker';
import { Store, User, MapPin, Clock, Phone, Save, Navigation, Loader2 } from 'lucide-react';
import { getBrowserCoordinates, reverseGeocode } from '../../services/geoService';

export const RetailerStorePage: React.FC = () => {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [profile, setProfile] = useState<RetailerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Store form state
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number>(23.0365);
  const [lng, setLng] = useState<number>(72.5611);
  const [operatingHours, setOperatingHours] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  // Profile form state
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [storeData, profileData] = await Promise.all([
        retailerService.getStore(),
        retailerService.getProfile(),
      ]);
      setStore(storeData);
      setProfile(profileData);

      setStoreName(storeData.store_name);
      setAddress(storeData.address || '');
      setLat(storeData.lat || 23.0365);
      setLng(storeData.lng || 72.5611);
      setOperatingHours(storeData.operating_hours || '08:00 - 22:00');
      setIsOpen(storeData.is_open);

      setOwnerName(profileData.name || '');
      setOwnerPhone(profileData.phone || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load store settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetectGps = async () => {
    setIsDetectingGps(true);
    setError(null);
    try {
      const coords = await getBrowserCoordinates();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);
      setLat(coords.lat);
      setLng(coords.lng);
      if (!address.trim()) {
        setAddress(resolvedAddress);
      }
      setNotice(`Acquired live GPS coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to get browser GPS coordinates');
    } finally {
      setIsDetectingGps(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStore(true);
    setError(null);
    try {
      const updated = await retailerService.updateStore({
        store_name: storeName,
        address,
        lat: Number(lat),
        lng: Number(lng),
        operating_hours: operatingHours,
        is_open: isOpen,
      });
      setStore(updated);
      setNotice('Store profile & physical GPS coordinates saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update store settings');
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setError(null);
    try {
      const updated = await retailerService.updateProfile({
        name: ownerName,
        phone: ownerPhone,
      });
      setProfile(updated);
      setNotice('Merchant contact information updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update retailer profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return <Spinner size="lg" label="Loading store settings..." />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Store & Profile Settings"
        description="Configure physical store GPS coordinates, operating hours, and merchant details"
      />

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {notice && (
        <Alert variant="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* Store Location and Settings Card */}
      <form onSubmit={handleSaveStore}>
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-base font-bold text-slate-900">Store Profile & Map Location</CardTitle>
              </div>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={isDetectingGps}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200/60 transition-colors disabled:opacity-60"
              >
                {isDetectingGps ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 fill-emerald-600" />
                )}
                <span>{isDetectingGps ? 'Detecting GPS...' : 'Auto-Fetch GPS'}</span>
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Store Trade Name *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Sharma Kirana & Daily Needs"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Store Street Address & Landmark *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No, Street, Landmark, Area, City"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Interactive OpenStreetMap Location Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Pin Physical Store Location on Map (OpenStreetMap)
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Drag the pin or click on map to position exactly
                </span>
              </div>
              <InteractiveStoreLocationPicker
                initialLat={lat}
                initialLng={lng}
                onLocationChange={(newLat, newLng, newAddr) => {
                  setLat(newLat);
                  setLng(newLng);
                  if (newAddr && !address) {
                    setAddress(newAddr);
                  }
                }}
                height="300px"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Latitude (GPS) *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400">Used for 2km & 5km matching engine</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Longitude (GPS) *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400">Used for OSRM rider dispatching</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  placeholder="e.g. 08:00 - 22:00"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col justify-center pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setIsOpen(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Store Open for New Orders
                    </span>
                    <span className="text-[10px] text-slate-400">
                      When closed, matching engine bypasses this store
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSavingStore}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Store & Map Coordinates
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Retailer Contact Profile */}
      <form onSubmit={handleSaveProfile}>
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base font-bold text-slate-900">Merchant Contact Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manager / Owner Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="md"
              isLoading={isSavingProfile}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Update Merchant Details
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};
