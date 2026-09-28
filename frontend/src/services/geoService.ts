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
 * Fetch device coordinates via IP geolocation as high-reliability fallback
 */
export async function getIpCoordinates(): Promise<{ lat: number; lng: number; city?: string; region?: string }> {
  // Provider 1: ipwho.is
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.latitude && data.longitude) {
        return {
          lat: Number(data.latitude),
          lng: Number(data.longitude),
          city: data.city,
          region: data.region,
        };
      }
    }
  } catch {}

  // Provider 2: geojs.io
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (res.ok) {
      const data = await res.json();
      if (data && data.latitude && data.longitude) {
        return {
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude),
          city: data.city,
          region: data.region,
        };
      }
    }
  } catch {}

  // Default fallback to Ahmedabad Central hub
  return {
    lat: 23.0365,
    lng: 72.5611,
    city: 'Ahmedabad',
    region: 'Gujarat',
  };
}

/**
 * Fetch current device coordinates via HTML5 Geolocation API with automatic IP fallback
 */
export async function getBrowserCoordinates(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      getIpCoordinates().then(coords => resolve({ lat: coords.lat, lng: coords.lng }));
      return;
    }

    let hasResolved = false;

    // Timeout safety fallback to IP geolocation after 4 seconds
    const timer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        getIpCoordinates().then(coords => resolve({ lat: coords.lat, lng: coords.lng }));
      }
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timer);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      },
      async (_error) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timer);
          // Seamlessly fallback to IP-based coordinates instead of throwing error
          const ipCoords = await getIpCoordinates();
          resolve({ lat: ipCoords.lat, lng: ipCoords.lng });
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 3500,
        maximumAge: 300000,
      }
    );
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

  // Fallback to IP city / region
  try {
    const ip = await getIpCoordinates();
    if (ip.city && ip.region) {
      return `${ip.city}, ${ip.region}`;
    }
  } catch {}

  return `Ahmedabad, Gujarat 380009`;
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
