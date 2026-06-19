const cache = new Map<string, { lat: number; lng: number } | null>();
const inflight = new Map<string, Promise<{ lat: number; lng: number } | null>>();
// v2: previous version persisted null results, which permanently hid clinics
// whose first geocode attempt failed (rate-limit, transient network). v2 only
// persists successful coords; nulls live in-memory for this session only.
const LS_KEY = "geocode-cache-v5";
try {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("geocode-cache-v1");
    window.localStorage.removeItem("geocode-cache-v2");
    window.localStorage.removeItem("geocode-cache-v3");
    window.localStorage.removeItem("geocode-cache-v4");
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

type NominatimResult = { lat: number; lng: number; name: string; displayName: string; addresstype?: string; type?: string };

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStreet = (value?: string | null) =>
  normalizeText(value)
    .replace(/\b(rua|r|avenida|av|travessa|tv|estrada|rodovia|alameda)\b/g, "")
    .replace(/\b(de|da|do|dos|das|e)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isGenericCep = (zip?: string | null) => {
  const digits = (zip ?? "").replace(/\D/g, "");
  return digits.length === 8 && digits.endsWith("000");
};

function pickBestCandidate(
  candidates: NominatimResult[],
  target: { address?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null },
) {
  if (candidates.length === 0) return null;
  const street = normalizeStreet(target.address);
  const neighborhood = normalizeText(target.neighborhood);
  const city = normalizeText(target.city);
  const state = normalizeText(target.state);

  const ranked = candidates
    .map((candidate) => {
      const name = normalizeStreet(candidate.name);
      const display = normalizeText(candidate.displayName);
      let score = 0;
      if (street && (name.includes(street) || display.includes(street))) score += 60;
      if (street && !(name.includes(street) || display.includes(street))) score -= 35;
      if (neighborhood && display.includes(neighborhood)) score += 36;
      if (neighborhood && !display.includes(neighborhood)) score -= 12;
      if (city && display.includes(city)) score += 12;
      if (state && display.includes(state)) score += 6;
      if (["road", "highway"].includes(candidate.addresstype ?? "")) score += 6;
      if (["residential", "primary", "secondary", "tertiary"].includes(candidate.type ?? "")) score += 3;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  if (street && ranked[0]?.score < 25) return null;
  return ranked[0]?.candidate ?? null;
}

async function fetchNominatim(params: Record<string, string>): Promise<NominatimResult[]> {
  try {
    const qs = new URLSearchParams({ format: "json", limit: "5", countrycodes: "br", ...params });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item?.lat && item?.lon)
      .map((item) => ({
        lat: +item.lat,
        lng: +item.lon,
        name: item.name ?? "",
        displayName: item.display_name ?? "",
        addresstype: item.addresstype,
        type: item.type,
      }));
  } catch {
    // silent fail
  }
  return [];
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
    let coords: { lat: number; lng: number } | null = null;
    const target = { address, neighborhood, city, state };

    // Street + neighborhood must win over generic CEPs like 69010-000,
    // otherwise geocoders can place Centro addresses on the wrong road.
    if (street && city) {
      const fullQuery = [street, neighborhood, city, state, "Brasil"].filter(Boolean).join(", ");
      coords = pickBestCandidate(await fetchNominatim({ q: fullQuery }), target);
    }
    if (!coords && street && city) {
      const structuredParams: Record<string, string> = { street, city };
      if (state) structuredParams.state = state;
      if (zipCode && !isGenericCep(zipCode)) structuredParams.postalcode = zipCode;
      coords = pickBestCandidate(await fetchNominatim(structuredParams), target);
    }
    if (!coords && zipCode && !isGenericCep(zipCode)) coords = await fetchBrasilApiCep(zipCode);
    if (!coords) {
      const fallbackQuery = [street, neighborhood, city, state, "Brasil"].filter(Boolean).join(", ");
      coords = pickBestCandidate(await fetchNominatim({ q: fallbackQuery || key }), target);
    }
    if (!coords && city) {
      const cityParams: Record<string, string> = { city };
      if (state) cityParams.state = state;
      coords = (await fetchNominatim(cityParams))[0] ?? null;
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
