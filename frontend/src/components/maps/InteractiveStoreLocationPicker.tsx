import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Loader2, Compass } from 'lucide-react';
import { getBrowserCoordinates, reverseGeocode } from '../../services/geoService';

// Ensure Leaflet assets work
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface InteractiveStoreLocationPickerProps {
  initialLat: number;
  initialLng: number;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  height?: string;
  className?: string;
}

export const InteractiveStoreLocationPicker: React.FC<InteractiveStoreLocationPickerProps> = ({
  initialLat,
  initialLng,
  onLocationChange,
  height = '360px',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [currentLat, setCurrentLat] = useState<number>(initialLat || 23.0365);
  const [currentLng, setCurrentLng] = useState<number>(initialLng || 72.5611);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>('');

  // Custom marker icon
  const customPinIcon = L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #059669, #10b981);
        color: white;
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4);
        border: 2px solid white;
      ">
        <span style="transform: rotate(45deg); font-size: 16px;">🏪</span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });

  const handleUpdatePosition = async (lat: number, lng: number) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    try {
      const addr = await reverseGeocode(lat, lng);
      setResolvedAddress(addr);
      onLocationChange(lat, lng, addr);
    } catch {
      onLocationChange(lat, lng);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const validLat = currentLat || 23.0365;
      const validLng = currentLng || 72.5611;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([validLat, validLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Create Draggable Marker
      const marker = L.marker([validLat, validLng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', (e) => {
        const position = e.target.getLatLng();
        handleUpdatePosition(position.lat, position.lng);
      });

      // Click on map to move pin
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        handleUpdatePosition(e.latlng.lat, e.latlng.lng);
      });

      markerRef.current = marker;
      mapInstanceRef.current = map;
    }

    return () => {};
  }, []);

  // Update marker position when props change externally
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current && initialLat && initialLng) {
      const latLng = L.latLng(initialLat, initialLng);
      markerRef.current.setLatLng(latLng);
      mapInstanceRef.current.panTo(latLng);
      setCurrentLat(initialLat);
      setCurrentLng(initialLng);
    }
  }, [initialLat, initialLng]);

  // Clean up
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleGpsClick = async () => {
    setIsDetectingGps(true);
    try {
      const coords = await getBrowserCoordinates();
      setCurrentLat(coords.lat);
      setCurrentLng(coords.lng);
      if (markerRef.current && mapInstanceRef.current) {
        const latLng = L.latLng(coords.lat, coords.lng);
        markerRef.current.setLatLng(latLng);
        mapInstanceRef.current.flyTo(latLng, 15);
      }
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setResolvedAddress(addr);
      onLocationChange(coords.lat, coords.lng, addr);
    } catch {
    } finally {
      setIsDetectingGps(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Quick GPS Button */}
        <div className="absolute top-3 right-3 z-[1000]">
          <button
            type="button"
            onClick={handleGpsClick}
            disabled={isDetectingGps}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-md text-emerald-700 font-bold text-xs rounded-xl shadow-lg border border-slate-200 hover:bg-emerald-50 active:scale-95 transition-all disabled:opacity-75"
          >
            {isDetectingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 fill-emerald-600" />
            )}
            <span>{isDetectingGps ? 'Locating…' : 'Center GPS'}</span>
          </button>
        </div>

        {/* Bottom Coordinates Badge */}
        <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs flex items-center justify-between border border-slate-700/80 shadow-md">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{resolvedAddress || `Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`}</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider shrink-0 ml-2 hidden sm:inline">
              Drag Pin to Adjust
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
