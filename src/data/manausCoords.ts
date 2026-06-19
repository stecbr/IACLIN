// Approximate centroids for Manaus neighborhoods (lat, lng).
// Used to render Servdonto/Rede Geral clinics on the map instantly,
// without hitting Nominatim (which is rate-limited and often blocked by CORS).
export const MANAUS_CENTER: [number, number] = [-3.119, -60.0217];

export const MANAUS_NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  adrianopolis: [-3.1006, -60.0125],
  aleixo: [-3.0905, -59.9876],
  alvorada: [-3.0782, -60.0418],
  aparecida: [-3.1339, -60.0257],
  "armando mendes": [-3.0723, -59.9335],
  cachoeirinha: [-3.1264, -60.0107],
  centro: [-3.1316, -60.0237],
  chapada: [-3.0883, -60.0257],
  "cidade nova": [-3.0298, -59.9907],
  "cidade de deus": [-3.0205, -60.0086],
  "colonia santo antonio": [-3.0997, -60.0469],
  compensa: [-3.1085, -60.0608],
  coroado: [-3.0937, -59.9706],
  crespo: [-3.1487, -59.9938],
  flores: [-3.0807, -60.0089],
  "jorge teixeira": [-3.0436, -59.9217],
  "monte das oliveiras": [-3.0142, -60.0204],
  "nossa senhora das gracas": [-3.1015, -60.0151],
  "parque 10 de novembro": [-3.0944, -60.0035],
  "ponta negra": [-3.0858, -60.0989],
  "santa etelvina": [-3.0009, -60.0246],
  "santo antonio": [-3.1136, -60.0473],
  "sao francisco": [-3.1118, -59.9938],
  "sao jose operario": [-3.0648, -59.9476],
  "tancredo neves": [-3.0654, -59.9591],
};

export function lookupManausCoords(neighborhood?: string | null): [number, number] {
  if (!neighborhood) return MANAUS_CENTER;
  const key = neighborhood
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return MANAUS_NEIGHBORHOOD_COORDS[key] ?? MANAUS_CENTER;
}