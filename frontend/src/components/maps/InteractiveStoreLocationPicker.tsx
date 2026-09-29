import React, { useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { getBrowserCoordinates, reverseGeocode } from '../../services/geoService';
import { MapView } from './MapView';

interface InteractiveStoreLocationPickerProps {
  initialLat: number;
  initialLng: number;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  height?: string;
  className?: string;
}

export const InteractiveStoreLocationPicker: React.FC<InteractiveStoreLocationPickerProps> = ({ initialLat, initialLng, onLocationChange, height = '360px', className = '' }) => {
  const [currentLat, setCurrentLat] = useState<number>(initialLat || 23.0365);
  const [currentLng, setCurrentLng] = useState<number>(initialLng || 72.5611);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState('');

  const handleUpdatePosition = async (lat: number, lng: number) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    try {
      const address = await reverseGeocode(lat, lng);
      setResolvedAddress(address);
      onLocationChange(lat, lng, address);
    } catch {
      onLocationChange(lat, lng);
    }
  };

  const handleGpsClick = async () => {
    setIsDetectingGps(true);
    try {
      const coords = await getBrowserCoordinates();
      await handleUpdatePosition(coords.lat, coords.lng);
    } finally {
      setIsDetectingGps(false);
    }
  };

  return <div className={`space-y-2 ${className}`}>
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm" style={{ height }}>
      <MapView
        center={{ lat: currentLat, lng: currentLng }}
        markers={[{ id: 'selected-location', lat: currentLat, lng: currentLng, label: 'Selected location', kind: 'store', draggable: true, onDragEnd: ({ lat, lng }) => void handleUpdatePosition(lat, lng) }]}
        fitToContent={false}
        onMapClick={({ lat, lng }) => void handleUpdatePosition(lat, lng)}
        height="100%"
      />
      <div className="absolute right-3 top-3 z-10">
        <button type="button" onClick={handleGpsClick} disabled={isDetectingGps} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-emerald-700 shadow-lg backdrop-blur-md transition-all hover:bg-emerald-50 active:scale-95 disabled:opacity-75">
          {isDetectingGps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5 fill-emerald-600" />}
          <span>{isDetectingGps ? 'Locating...' : 'Center GPS'}</span>
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10">
        <div className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow-md backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" /><span className="truncate">{resolvedAddress || `Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`}</span></div>
          <span className="ml-2 hidden shrink-0 text-[10px] uppercase tracking-wider text-slate-400 sm:inline">Click or drag to adjust</span>
        </div>
      </div>
    </div>
  </div>;
};
