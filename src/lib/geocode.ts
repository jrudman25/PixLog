const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

interface GeocodingResult {
  locationName: string;
  city: string | null;
  country: string | null;
}

// Simple rate limiter — 1 request per second for Nominatim
let lastRequest = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequest;

  if (timeSinceLastRequest < 1100) {
    await new Promise((resolve) =>
      setTimeout(resolve, 1100 - timeSinceLastRequest)
    );
  }

  lastRequest = Date.now();
  return fetch(url);
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<GeocodingResult | null> {
  try {
    const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {return null;}

    const data = await response.json();
    const address = data.address;

    if (!address) {return null;}

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      null;
    const state = address.state || null;
    const country = address.country || null;

    const parts = [city, state, country].filter(Boolean);
    const locationName = parts.join(', ') || data.display_name || 'Unknown';

    return {
      locationName,
      city,
      country,
    };
  } catch {
    return null;
  }
}
