/**
 * Tabela de anestésicos locais usados em odontologia.
 * Doses máximas em mg/kg conforme literatura clínica de referência.
 * Cada tubete contém 1.8 mL.
 */

export interface Anesthetic {
  id: string;
  name: string;
  concentrationPercent: number; // ex: 2 = 2%
  mgPerMl: number; // mg de fármaco por mL de solução
  maxMgPerKg: number; // dose máxima em mg/kg de peso
  absoluteMaxMg: number; // dose absoluta máxima por sessão (independe do peso)
  hasVasoconstrictor: boolean;
  notes?: string;
}

export const TUBETE_ML = 1.8;

export const ANESTHETICS: Anesthetic[] = [
  {
    id: 'lido-2-epi',
    name: 'Lidocaína 2% c/ epinefrina 1:100.000',
    concentrationPercent: 2,
    mgPerMl: 20,
    maxMgPerKg: 7,
    absoluteMaxMg: 500,
    hasVasoconstrictor: true,
  },
  {
    id: 'lido-2-sem',
    name: 'Lidocaína 2% sem vasoconstritor',
    concentrationPercent: 2,
    mgPerMl: 20,
    maxMgPerKg: 4.4,
    absoluteMaxMg: 300,
    hasVasoconstrictor: false,
  },
  {
    id: 'mepi-2-epi',
    name: 'Mepivacaína 2% c/ epinefrina',
    concentrationPercent: 2,
    mgPerMl: 20,
    maxMgPerKg: 6.6,
    absoluteMaxMg: 400,
    hasVasoconstrictor: true,
  },
  {
    id: 'mepi-3-sem',
    name: 'Mepivacaína 3% sem vasoconstritor',
    concentrationPercent: 3,
    mgPerMl: 30,
    maxMgPerKg: 6.6,
    absoluteMaxMg: 400,
    hasVasoconstrictor: false,
  },
  {
    id: 'arti-4-epi-100',
    name: 'Articaína 4% c/ epinefrina 1:100.000',
    concentrationPercent: 4,
    mgPerMl: 40,
    maxMgPerKg: 7,
    absoluteMaxMg: 500,
    hasVasoconstrictor: true,
  },
  {
    id: 'arti-4-epi-200',
    name: 'Articaína 4% c/ epinefrina 1:200.000',
    concentrationPercent: 4,
    mgPerMl: 40,
    maxMgPerKg: 7,
    absoluteMaxMg: 500,
    hasVasoconstrictor: true,
  },
  {
    id: 'bupi-05-epi',
    name: 'Bupivacaína 0,5% c/ epinefrina',
    concentrationPercent: 0.5,
    mgPerMl: 5,
    maxMgPerKg: 1.3,
    absoluteMaxMg: 90,
    hasVasoconstrictor: true,
    notes: 'Anestesia de longa duração',
  },
  {
    id: 'prilo-3-feli',
    name: 'Prilocaína 3% c/ felipressina',
    concentrationPercent: 3,
    mgPerMl: 30,
    maxMgPerKg: 6,
    absoluteMaxMg: 400,
    hasVasoconstrictor: true,
    notes: 'Indicada para gestantes (sem epinefrina)',
  },
];

export interface DoseResult {
  anesthetic: Anesthetic;
  weightKg: number;
  maxMgByWeight: number;
  effectiveMaxMg: number; // o menor entre dose por peso e máximo absoluto
  maxMl: number;
  maxTubetes: number; // arredondado para baixo
  limitedBy: 'weight' | 'absolute';
}

export function calculateMaxDose(anestheticId: string, weightKg: number): DoseResult | null {
  const anesthetic = ANESTHETICS.find((a) => a.id === anestheticId);
  if (!anesthetic || weightKg <= 0) return null;

  const maxMgByWeight = anesthetic.maxMgPerKg * weightKg;
  const effectiveMaxMg = Math.min(maxMgByWeight, anesthetic.absoluteMaxMg);
  const limitedBy: 'weight' | 'absolute' = maxMgByWeight <= anesthetic.absoluteMaxMg ? 'weight' : 'absolute';
  const maxMl = effectiveMaxMg / anesthetic.mgPerMl;
  const maxTubetes = Math.floor(maxMl / TUBETE_ML);

  return {
    anesthetic,
    weightKg,
    maxMgByWeight,
    effectiveMaxMg,
    maxMl,
    maxTubetes,
    limitedBy,
  };
}

/** Palavras-chave para detectar alergia a anestésicos no texto livre da anamnese. */
export const ANESTHETIC_ALLERGY_KEYWORDS = [
  'lidoca',
  'mepivaca',
  'artica',
  'bupivaca',
  'priloca',
  'anestésico',
  'anestesico',
  'epinefrina',
  'adrenalina',
  'vasoconstritor',
];

export function detectAnestheticAllergy(allergiesText: string | null | undefined): string[] {
  if (!allergiesText) return [];
  const lower = allergiesText.toLowerCase();
  return ANESTHETIC_ALLERGY_KEYWORDS.filter((kw) => lower.includes(kw));
}