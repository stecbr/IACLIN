import rawCities from './brazilCities.json';

export interface BrazilCity {
  /** Canonical name with proper Title Case */
  name: string;
  /** UF sigla (2 letters) */
  uf: string;
}

// JSON is stored compactly as { n, u } to save bytes — expand to a friendly shape.
const RAW = rawCities as Array<{ n: string; u: string }>;

export const BRAZIL_CITIES: BrazilCity[] = RAW.map((r) => ({ name: r.n, uf: r.u }));

export const BR_STATE_NAME_TO_UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA',
  ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE',
  piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

export const BR_UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

/** Strip accents, lowercase, collapse spaces — used as a comparison key. */
export function foldKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Normalize a UF value: accepts "SP", "sp", "São Paulo" → "SP". Returns '' if unknown. */
export function normalizeUf(input: string | null | undefined): string {
  if (!input) return '';
  const v = input.trim();
  if (!v) return '';
  const up = v.toUpperCase();
  if (up.length === 2 && (BR_UF_LIST as readonly string[]).includes(up)) return up;
  const key = foldKey(v);
  return BR_STATE_NAME_TO_UF[key] ?? '';
}

// Build city index per UF for fast lookup.
const CITY_BY_UF = new Map<string, BrazilCity[]>();
const CITY_KEY_BY_UF = new Map<string, Map<string, BrazilCity>>();
const CITY_KEY_ANY = new Map<string, BrazilCity[]>();
for (const c of BRAZIL_CITIES) {
  const arr = CITY_BY_UF.get(c.uf) ?? [];
  arr.push(c);
  CITY_BY_UF.set(c.uf, arr);

  const keyMap = CITY_KEY_BY_UF.get(c.uf) ?? new Map();
  keyMap.set(foldKey(c.name), c);
  CITY_KEY_BY_UF.set(c.uf, keyMap);

  const k = foldKey(c.name);
  const list = CITY_KEY_ANY.get(k) ?? [];
  list.push(c);
  CITY_KEY_ANY.set(k, list);
}

export function getCitiesByUf(uf: string): BrazilCity[] {
  return CITY_BY_UF.get(uf.toUpperCase()) ?? [];
}

/**
 * Resolve a possibly-misspelled / wrong-case city to a canonical city object.
 * Tries UF-scoped exact match first, then global match.
 */
export function resolveCity(cityInput: string, ufHint?: string): BrazilCity | null {
  if (!cityInput) return null;
  const key = foldKey(cityInput);
  if (!key) return null;
  const uf = normalizeUf(ufHint ?? '');
  if (uf) {
    const m = CITY_KEY_BY_UF.get(uf);
    if (m && m.has(key)) return m.get(key)!;
  }
  const any = CITY_KEY_ANY.get(key);
  if (any && any.length > 0) return any[0];
  return null;
}

/** Search cities by free text; optionally constrained to a UF. Returns top N. */
export function searchCities(query: string, ufHint?: string, limit = 50): BrazilCity[] {
  const q = foldKey(query);
  const uf = normalizeUf(ufHint ?? '');
  const pool = uf ? (CITY_BY_UF.get(uf) ?? []) : BRAZIL_CITIES;
  if (!q) return pool.slice(0, limit);
  const starts: BrazilCity[] = [];
  const includes: BrazilCity[] = [];
  for (const c of pool) {
    const k = foldKey(c.name);
    if (k === q) starts.unshift(c);
    else if (k.startsWith(q)) starts.push(c);
    else if (k.includes(q)) includes.push(c);
    if (starts.length + includes.length >= limit * 2) break;
  }
  return [...starts, ...includes].slice(0, limit);
}