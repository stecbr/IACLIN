import Holidays from 'date-holidays';

export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
}

const cache = new Map<string, Holidays>();

function getInstance(state?: string | null, city?: string | null): Holidays {
  const key = `BR|${state ?? ''}|${city ?? ''}`;
  let hd = cache.get(key);
  if (!hd) {
    try {
      if (state && city) hd = new Holidays('BR', state, city);
      else if (state) hd = new Holidays('BR', state);
      else hd = new Holidays('BR');
    } catch {
      hd = new Holidays('BR');
    }
    cache.set(key, hd);
  }
  return hd;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getHolidaysForMonth(
  year: number,
  monthIndex0: number,
  state?: string | null,
  city?: string | null
): Map<string, HolidayInfo> {
  const hd = getInstance(state, city);
  const list = hd.getHolidays(year) ?? [];
  const map = new Map<string, HolidayInfo>();
  for (const h of list) {
    const start = new Date(h.start);
    if (start.getMonth() !== monthIndex0) continue;
    const key = toLocalDateStr(start);
    if (!map.has(key)) {
      map.set(key, { date: key, name: h.name, type: h.type });
    }
  }
  return map;
}

export function getHolidayForDate(
  date: Date,
  state?: string | null,
  city?: string | null
): HolidayInfo | null {
  const map = getHolidaysForMonth(date.getFullYear(), date.getMonth(), state, city);
  return map.get(toLocalDateStr(date)) ?? null;
}

export { toLocalDateStr };
