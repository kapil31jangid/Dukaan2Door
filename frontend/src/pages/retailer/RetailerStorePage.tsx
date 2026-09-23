import React, { useState, useEffect } from 'react';
import { retailerService } from '../../services/retailerService';
import { StoreProfile, RetailerProfile } from '../../types/user';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Store, User, MapPin, Clock, Phone, Save } from 'lucide-react';

export const RetailerStorePage: React.FC = () => {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [profile, setProfile] = useState<RetailerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Store form state
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
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
      setLat(storeData.lat || 0);
      setLng(storeData.lng || 0);
      setOperatingHours(storeData.operating_hours || '');
      setIsOpen(storeData.is_open);

      setOwnerName(profileData.name || '');
      setOwnerPhone(profileData.phone || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load store settings');
    } finally {
      setIsLoading(false);
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
      setNotice('Store settings saved successfully');
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
      setNotice('Retailer contact information updated');
    } catch (err: any) {
      setError(err.message || 'Failed to update retailer profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return <Spinner size="lg" label="Loading store profile..." />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Store & Profile Settings"
        description="Configure your physical store location coordinates, operating hours, and merchant details"
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
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base">Store Profile & Location</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Trade Name *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address with landmark"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Latitude (GPS) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400">Used for 2km / 5km hyperlocal matching</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Longitude (GPS) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400">Used for OSRM route calculations</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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

              <div className="flex flex-col justify-center pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setIsOpen(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Store Open for New Orders
                    </span>
                    <span className="text-[10px] text-slate-400">
                      When closed, matching service will bypass this store
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingStore}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Store Changes
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
              <CardTitle className="text-base">Merchant Contact Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manager / Owner Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={isSavingProfile}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Update Contact Details
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};
