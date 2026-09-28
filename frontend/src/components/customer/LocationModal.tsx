import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  X,
  Check,
  AlertCircle,
  Loader2,
  Building2,
  Sparkles,
  Compass,
  Map,
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
import { InteractiveStoreLocationPicker } from '../maps/InteractiveStoreLocationPicker';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress?: string;
  currentLat?: number | null;
  currentLng?: number | null;
  onLocationUpdated: (profile: CustomerProfile) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  currentLat,
  currentLng,
  onLocationUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ address: string; lat: number; lng: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);
  const [mapLat, setMapLat] = useState(currentLat ?? 23.0365);
  const [mapLng, setMapLng] = useState(currentLng ?? 72.5611);
  const [mapAddress, setMapAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || currentLat == null || currentLng == null) return;
    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) return;
    setMapLat(currentLat);
    setMapLng(currentLng);
  }, [isOpen, currentLat, currentLng]);

  if (!isOpen) return null;

  // 1. Detect device GPS & Reverse Geocode
  const handleDetectGps = async () => {
    setIsDetectingGps(true);
    setError(null);
    try {
      const coords = await getBrowserCoordinates();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);

      const updated = await customerService.updateProfile({
        delivery_address: resolvedAddress,
        lat: coords.lat,
        lng: coords.lng,
      });

      onLocationUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to resolve GPS. Please select a popular area below or pin on map.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // 2. Select a quick preset location
  const handleSelectPreset = async (preset: PresetLocation) => {
    setError(null);
    setIsDetectingGps(true);
    try {
      const updated = await customerService.updateProfile({
        delivery_address: preset.address,
        lat: preset.lat,
        lng: preset.lng,
      });
      onLocationUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update location.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // 3. Search address with live query
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
    setIsDetectingGps(true);
    try {
      const updated = await customerService.updateProfile({
        delivery_address: result.address,
        lat: result.lat,
        lng: result.lng,
      });
      onLocationUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save selected address.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleConfirmMapPin = async () => {
    setIsDetectingGps(true);
    setError(null);
    try {
      const addr = mapAddress || (await reverseGeocode(mapLat, mapLng));
      const updated = await customerService.updateProfile({
        delivery_address: addr,
        lat: mapLat,
        lng: mapLng,
      });
      onLocationUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save map location.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Select Delivery Location</h2>
            <p className="text-xs text-slate-500 font-medium">Set the location used for local store availability and delivery.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* One-tap GPS location control */}
          <button
            onClick={handleDetectGps}
            disabled={isDetectingGps}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white shadow-lg shadow-purple-600/20 active:scale-[0.98] transition-all disabled:opacity-75 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white">
                {isDetectingGps ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5 text-amber-300 fill-amber-300 group-hover:rotate-45 transition-transform" />
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-black tracking-tight">
                  {isDetectingGps ? 'Detecting Location…' : 'Use Current Location'}
                </p>
                <p className="text-xs text-purple-200 font-medium">
                  {isDetectingGps ? 'Waiting for a precise device GPS fix…' : 'Use your device GPS location'}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
              AUTO GPS
            </div>
          </button>

          {/* Interactive OpenStreetMap Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowInteractiveMap(!showInteractiveMap)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold transition-colors"
            >
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-purple-600" />
                <span>{showInteractiveMap ? 'Hide Map View' : 'Pin Exactly on OpenStreetMap (Visual Map)'}</span>
              </div>
              <span className="text-[10px] text-purple-700 uppercase font-black">
                {showInteractiveMap ? 'Close' : 'Open Map'}
              </span>
            </button>

            {showInteractiveMap && (
              <div className="mt-3 space-y-2">
                <InteractiveStoreLocationPicker
                  initialLat={mapLat}
                  initialLng={mapLng}
                  onLocationChange={(newLat, newLng, newAddr) => {
                    setMapLat(newLat);
                    setMapLng(newLng);
                    if (newAddr) setMapAddress(newAddr);
                  }}
                  height="220px"
                />
                <button
                  type="button"
                  onClick={handleConfirmMapPin}
                  disabled={isDetectingGps}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Pinned Location</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Area / Landmark Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Or search your area / landmark</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search area, apartment, street (e.g. Navrangpura, SG Highway)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                </div>
              )}
            </div>

            {/* Search Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden divide-y divide-slate-100">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-purple-50/60 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-800 font-semibold line-clamp-2">{res.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Preset Delivery Hubs / Areas */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Popular Local Areas (1-Click Switch)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_LOCATIONS.map((preset) => {
                const isSelected = currentAddress?.toLowerCase().includes(preset.name.toLowerCase());
                return (
                  <button
                    key={preset.name}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 group ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-2xs'
                        : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/80 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight truncate">{preset.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{preset.locality}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-purple-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default LocationModal;
