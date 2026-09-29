/**
 * Geolocation & Reverse Geocoding Services using OpenStreetMap Nominatim & Browser GPS
 */

export interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  pincode?: string;
}

export interface PresetLocation {
  name: string;
  locality: string;
  address: string;
  lat: number;
  lng: number;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    name: 'Navrangpura',
    locality: 'Ahmedabad Central',
    address: 'Navrangpura, Ahmedabad, Gujarat 380009',
    lat: 23.0365,
    lng: 72.5611,
  },
  {
    name: 'Vastrapur',
    locality: 'Ahmedabad West',
    address: 'Near Vastrapur Lake, Vastrapur, Ahmedabad 380015',
    lat: 23.0350,
    lng: 72.5293,
  },
  {
    name: 'Satellite',
    locality: 'Ahmedabad South-West',
    address: 'Satellite Road, Ramdev Nagar, Ahmedabad 380015',
    lat: 23.0276,
    lng: 72.5076,
  },
  {
    name: 'Bodakdev',
    locality: 'Ahmedabad SG Highway',
    address: 'Bodakdev, Judges Bungalow Road, Ahmedabad 380054',
    lat: 23.0450,
    lng: 72.5180,
  },
  {
    name: 'Central Mart Hub',
    locality: 'Ahmedabad East',
    address: 'Demo Central Store Hub, Ashram Road, Ahmedabad 380006',
    lat: 23.0225,
    lng: 72.5714,
  },
];

/**
 * Fetch current device coordinates via the HTML5 Geolocation API.
 * Network/IP coordinates are deliberately not used here because they can be kilometres away.
 */
export async function getBrowserCoordinates(): Promise<{ lat: number; lng: number; accuracyM?: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Precise GPS is not supported by this browser. Please select your location on the map.'));
      return;
    }

    const resolvePosition = (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new Error('The device returned invalid GPS coordinates.'));
          return;
        }
        resolve({
          lat: latitude,
          lng: longitude,
          accuracyM: Number.isFinite(accuracy) ? accuracy : undefined,
        });
    };

    const rejectPosition = (error: GeolocationPositionError) => {
      // Some desktop browsers have no GPS sensor but can still return a browser-managed
      // Wi-Fi/network position. Retry that provider without falling back to IP geolocation.
      if (error.code !== error.PERMISSION_DENIED) {
        navigator.geolocation.getCurrentPosition(
          resolvePosition,
          (fallbackError) => {
            reject(new Error(
              fallbackError.code === fallbackError.PERMISSION_DENIED
                ? 'Location permission was denied. Please allow GPS or pin your delivery location on the map.'
                : 'A device location was not available. Please enable location services or pin your delivery location on the map.',
            ));
          },
          { enableHighAccuracy: false, timeout: 30000, maximumAge: 0 },
        );
        return;
      }

        reject(new Error(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Please allow GPS or pin your delivery location on the map.'
            : 'A precise GPS fix was not available. Please try again outdoors or pin your delivery location on the map.',
        ));
    };

    navigator.geolocation.getCurrentPosition(resolvePosition, rejectPosition, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

/**
 * Reverse-geocode latitude and longitude into a readable address string using OpenStreetMap Nominatim
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const parts = [
          addr.suburb || addr.neighbourhood || addr.residential || addr.road || addr.village,
          addr.city || addr.town || addr.municipality || addr.district || addr.county,
          addr.state,
          addr.postcode,
        ].filter(Boolean);

        if (parts.length > 0) {
          return parts.join(', ');
        }
        if (data.display_name) {
          return data.display_name;
        }
      }
    }
  } catch {}

  // Keep the address label tied to the actual device coordinates. An IP-derived
  // city can be several kilometres away and must not replace a real GPS fix.
  return `Current device location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

/**
 * Search addresses matching query via OpenStreetMap Nominatim
 */
export async function searchAddressLocations(
  query: string
): Promise<Array<{ address: string; lat: number; lng: number }>> {
  if (!query || query.trim().length < 3) return [];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&countrycodes=in&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}
