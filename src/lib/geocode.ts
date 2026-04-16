const cache = new Map<string, { lat: number; lng: number }>();

export async function geocodeAddress(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zipCode?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const key = [address, city, state, zipCode].filter(Boolean).join(", ");
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const params = new URLSearchParams({ format: "json", limit: "1", country: "Brazil" });
    if (address) params.set("street", address);
    if (city) params.set("city", city);
    if (state) params.set("state", state);
    if (zipCode) params.set("postalcode", zipCode);

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    const data = await res.json();
    if (data?.[0]) {
      const coords = { lat: +data[0].lat, lng: +data[0].lon };
      cache.set(key, coords);
      return coords;
    }
  } catch {
    // silent fail
  }
  return null;
}
