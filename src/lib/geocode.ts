const cache = new Map<string, { lat: number; lng: number }>();
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

export async function geocodeAddress(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zipCode?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state, zipCode].filter(Boolean).join(", ");
  if (!query) return null;
  if (cache.has(query)) return cache.get(query)!;

  try {
    const res = await rateLimitedFetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`
    );
    const data = await res.json();
    if (data?.[0]) {
      const coords = { lat: +data[0].lat, lng: +data[0].lon };
      cache.set(query, coords);
      return coords;
    }
  } catch {
    // silent fail
  }
  return null;
}
