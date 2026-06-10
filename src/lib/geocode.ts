const cache = new Map<string, { lat: number; lng: number }>();

async function fetchNominatim(params: Record<string, string>): Promise<{ lat: number; lng: number } | null> {
  try {
    const qs = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", ...params });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`);
    const data = await res.json();
    if (data?.[0]) {
      return { lat: +data[0].lat, lng: +data[0].lon };
    }
  } catch {
    // silent fail
  }
  return null;
}

export async function geocodeAddress(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zipCode?: string | null,
  addressNumber?: string | null,
  neighborhood?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const street = address
    ? addressNumber
      ? `${address}, ${addressNumber}`
      : address
    : null;
  const key = [street, neighborhood, city, state, zipCode].filter(Boolean).join(", ");
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  // 1. Structured search
  const structured: Record<string, string> = {};
  if (street) structured.street = street;
  if (city) structured.city = city;
  if (state) structured.state = state;
  if (zipCode) structured.postalcode = zipCode;

  let coords = await fetchNominatim(structured);

  // 1b. Try with neighborhood as suburb if first attempt failed
  if (!coords && neighborhood) {
    const withSuburb: Record<string, string> = { ...structured, suburb: neighborhood };
    coords = await fetchNominatim(withSuburb);
  }

  // 2. Free-text fallback
  if (!coords) {
    coords = await fetchNominatim({ q: key });
  }

  // 3. City + state fallback
  if (!coords && city) {
    const cityParams: Record<string, string> = { city };
    if (state) cityParams.state = state;
    coords = await fetchNominatim(cityParams);
  }

  if (coords) {
    cache.set(key, coords);
  }
  return coords;
}
