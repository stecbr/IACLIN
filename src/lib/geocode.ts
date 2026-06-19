const cache = new Map<string, { lat: number; lng: number } | null>();
const inflight = new Map<string, Promise<{ lat: number; lng: number } | null>>();
// v2: previous version persisted null results, which permanently hid clinics
// whose first geocode attempt failed (rate-limit, transient network). v2 only
// persists successful coords; nulls live in-memory for this session only.
const LS_KEY = "geocode-cache-v4";
try {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("geocode-cache-v1");
    window.localStorage.removeItem("geocode-cache-v2");
    window.localStorage.removeItem("geocode-cache-v3");
  }
} catch { /* ignore */ }

// Hydrate from localStorage (persistent across sessions — dramatically speeds repeat visits)
try {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { lat: number; lng: number } | null>;
      for (const [k, v] of Object.entries(parsed)) cache.set(k, v);
    }
  }
} catch {
  // ignore
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush() {
  if (typeof window === "undefined") return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      const obj: Record<string, { lat: number; lng: number }> = {};
      cache.forEach((v, k) => { if (v) obj[k] = v; });
      window.localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch {
      // quota — ignore
    }
  }, 1000);
}

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

// BrasilAPI CEP v2 returns precise coordinates for a Brazilian postal code
// (street-level when available). Much more accurate than Nominatim for BR
// addresses, especially when the street name spelling is approximate.
async function fetchBrasilApiCep(zip: string): Promise<{ lat: number; lng: number } | null> {
  const cep = zip.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!res.ok) return null;
    const data = await res.json();
    const lat = data?.location?.coordinates?.latitude;
    const lng = data?.location?.coordinates?.longitude;
    if (lat && lng) return { lat: +lat, lng: +lng };
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
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    // Prefer the Brazilian postal code (CEP) — gives exact street coordinates
    // and avoids Nominatim picking the wrong street when the name is fuzzy.
    let coords: { lat: number; lng: number } | null = null;
    if (zipCode) coords = await fetchBrasilApiCep(zipCode);
    if (!coords && street && city) {
      const structuredParams: Record<string, string> = { street, city };
      if (state) structuredParams.state = state;
      if (zipCode) structuredParams.postalcode = zipCode;
      coords = await fetchNominatim(structuredParams);
    }
    if (!coords) coords = await fetchNominatim({ q: key });
    if (!coords && city) {
      const cityParams: Record<string, string> = { city };
      if (state) cityParams.state = state;
      coords = await fetchNominatim(cityParams);
    }
    cache.set(key, coords ?? null);
    scheduleFlush();
    return coords;
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}
