const DEFAULT_GRADIENT = 'from-primary via-primary/70 to-primary/40';

type Brand = { label: string; gradient: string };

const BRANDS: Array<{ match: string[]; brand: Brand }> = [
  { match: ['unimed'], brand: { label: 'Unimed', gradient: 'from-emerald-600 via-emerald-500 to-emerald-400' } },
  { match: ['amil'], brand: { label: 'Amil', gradient: 'from-blue-700 via-blue-600 to-blue-400' } },
  { match: ['bradesco'], brand: { label: 'Bradesco Saúde', gradient: 'from-red-700 via-red-600 to-red-400' } },
  { match: ['sulamerica', 'sul america'], brand: { label: 'SulAmérica', gradient: 'from-orange-600 via-orange-500 to-amber-400' } },
  { match: ['hapvida', 'notredame', 'notre dame', 'intermedica'], brand: { label: 'Hapvida NotreDame', gradient: 'from-red-600 via-orange-500 to-orange-400' } },
  { match: ['porto'], brand: { label: 'Porto Saúde', gradient: 'from-indigo-700 via-indigo-600 to-sky-400' } },
  { match: ['golden cross', 'goldencross'], brand: { label: 'Golden Cross', gradient: 'from-amber-600 via-amber-500 to-yellow-300' } },
  { match: ['odontoprev'], brand: { label: 'OdontoPrev', gradient: 'from-cyan-600 via-cyan-500 to-sky-300' } },
  { match: ['metlife'], brand: { label: 'MetLife', gradient: 'from-blue-800 via-blue-700 to-blue-500' } },
  { match: ['allianz'], brand: { label: 'Allianz', gradient: 'from-indigo-800 via-indigo-700 to-indigo-500' } },
  { match: ['prevent senior', 'preventsenior'], brand: { label: 'Prevent Senior', gradient: 'from-sky-700 via-sky-500 to-sky-300' } },
  { match: ['care plus', 'careplus'], brand: { label: 'Care Plus', gradient: 'from-teal-700 via-teal-500 to-emerald-300' } },
  { match: ['sao francisco', 'são francisco'], brand: { label: 'São Francisco Saúde', gradient: 'from-blue-700 via-blue-500 to-cyan-300' } },
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function getInsuranceBrand(name?: string | null): Brand {
  if (!name) return { label: '', gradient: DEFAULT_GRADIENT };
  const n = normalize(name);
  for (const { match, brand } of BRANDS) {
    if (match.some((k) => n.includes(k))) return brand;
  }
  return { label: name, gradient: DEFAULT_GRADIENT };
}