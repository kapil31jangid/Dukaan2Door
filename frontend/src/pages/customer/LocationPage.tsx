import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Navigation,
  Search,
  Check,
  Building2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  PRESET_LOCATIONS,
  PresetLocation,
  getBrowserCoordinates,
  reverseGeocode,
  searchAddressLocations,
} from '../../services/geoService';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const LocationPage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ address: string; lat: number; lng: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    customerService.getProfile().then((p) => {
      setProfile(p);
      setAddress(p.delivery_address || '');
      setLat(p.lat || null);
      setLng(p.lng || null);
    }).catch(() => {});
  }, []);

  // 1. Detect Device GPS & Reverse Geocode
  const handleDetectGps = async () => {
    setIsDetectingGps(true);
    setError(null);
    try {
      const coords = await getBrowserCoordinates();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);

      setLat(coords.lat);
      setLng(coords.lng);
      setAddress(resolvedAddress);

      // Save directly to profile
      const updated = await customerService.updateProfile({
        delivery_address: resolvedAddress,
        lat: coords.lat,
        lng: coords.lng,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => navigate('/customer/home'), 800);
    } catch (err: any) {
      setError(err.message || 'Could not fetch current GPS location.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // 2. Select Preset
  const handleSelectPreset = async (preset: PresetLocation) => {
    setError(null);
    setIsSaving(true);
    try {
      setLat(preset.lat);
      setLng(preset.lng);
      setAddress(preset.address);

      const updated = await customerService.updateProfile({
        delivery_address: preset.address,
        lat: preset.lat,
        lng: preset.lng,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => navigate('/customer/home'), 800);
    } catch (err: any) {
      setError(err.message || 'Failed to update location.');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Search query change
  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 3) {
      setIsSearching(true);
      try {
        const results = await searchAddressLocations(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSearchResult = async (result: { address: string; lat: number; lng: number }) => {
    setError(null);
    setIsSaving(true);
    try {
      setLat(result.lat);
      setLng(result.lng);
      setAddress(result.address);

      const updated = await customerService.updateProfile({
        delivery_address: result.address,
        lat: result.lat,
        lng: result.lng,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => navigate('/customer/home'), 800);
    } catch (err: any) {
      setError(err.message || 'Failed to save selected address.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Manual Save
  const handleManualSave = async () => {
    if (!address.trim()) {
      setError('Please enter a delivery address.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await customerService.updateProfile({
        delivery_address: address.trim(),
        lat: lat || undefined,
        lng: lng || undefined,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => navigate('/customer/home'), 800);
    } catch (err: any) {
      setError(err.message || 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Delivery Location</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Dukaan2Door matches you with the nearest open Kirana store within 2 km – 5 km.
        </p>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success">Location updated successfully! Redirecting…</Alert>}

      {/* 1-Click Detect GPS Location */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <button
          onClick={handleDetectGps}
          disabled={isDetectingGps}
          className="group flex w-full items-center justify-between rounded-xl bg-rose-600 p-4 text-white shadow-lg shadow-rose-600/20 transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-75"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white">
              {isDetectingGps ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5 text-amber-300 fill-amber-300 group-hover:rotate-45 transition-transform" />
              )}
            </div>
            <div className="text-left">
              <p className="text-sm sm:text-base font-black tracking-tight">
                {isDetectingGps ? 'Detecting GPS Coordinates…' : 'Fetch Current GPS Location'}
              </p>
              <p className="text-xs font-medium text-rose-100">
                {isDetectingGps ? 'Reverse geocoding with OpenStreetMap…' : 'Automatic 1-click device geolocation'}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
            1-CLICK GPS
          </div>
        </button>
      </div>

      {/* Address Search */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
          Search Area, Landmark or Society
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Type your area (e.g. Navrangpura, Vastrapur, Bodakdev)..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/10 sm:text-sm"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
            </div>
          )}
        </div>

        {/* Dropdown Results */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md divide-y divide-slate-100 overflow-hidden">
            {searchResults.map((res, i) => (
              <button
                key={i}
                onClick={() => handleSelectSearchResult(res)}
                className="flex w-full items-start gap-2.5 p-3 text-left transition-colors hover:bg-rose-50/60"
              >
                <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-800 font-semibold line-clamp-2">{res.address}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular Area Presets */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          Popular Local Areas (1-Click Switch)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PRESET_LOCATIONS.map((preset) => {
            const isSelected = address?.toLowerCase().includes(preset.name.toLowerCase());
            return (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(preset)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 group ${
                  isSelected
                    ? 'border-rose-300 bg-rose-50 text-rose-900 shadow-2xs'
                    : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-rose-600 text-white' : 'border border-slate-200 bg-white text-slate-600'
                  }`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight truncate">{preset.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{preset.locality}</p>
                  </div>
                </div>

                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-rose-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Address Confirmation */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
          Or Enter Full House / Flat Address
        </label>
        <textarea
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Flat / House No., Apartment Name, Street, Landmark, Pincode"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/10 sm:text-sm"
        />

        <Button
          type="button"
          variant="primary"
          size="lg"
          isLoading={isSaving}
          onClick={handleManualSave}
          className="w-full rounded-lg bg-rose-600 py-3 font-bold text-white hover:bg-rose-700"
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Confirm & Save Address
        </Button>
      </div>
    </div>
  );
};

export default LocationPage;
