import { Bone, Footprints, PersonStanding, Utensils, Activity, Brain, type LucideIcon } from 'lucide-react';

export type MapType = 'tooth' | 'foot' | 'body' | 'meal' | 'musculoskeletal' | 'psyche';

export interface MapConfig {
  mapType: MapType;
  label: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Maps a doctor's specialty (stored in clinic_members.specialty) to a clinical map.
 * Specialties not in this dictionary will hide the menu item entirely.
 * Keys are normalized: lowercase, no accents, underscores replace spaces.
 */
export const MAP_BY_SPECIALTY: Record<string, MapConfig> = {
  // Odontologia → Odontograma
  odontologia: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },
  ortodontia: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },
  endodontia: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },
  periodontia: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },
  implantodontia: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },
  odontopediatria: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },
  dentista: { mapType: 'tooth', label: 'Odontograma', icon: Bone, description: 'Prontuário odontológico visual' },

  // Podologia → Mapa Podológico
  podologia: { mapType: 'foot', label: 'Mapa Podológico', icon: Footprints, description: 'Achados clínicos nos pés' },
  podologo: { mapType: 'foot', label: 'Mapa Podológico', icon: Footprints, description: 'Achados clínicos nos pés' },

  // Áreas que usam mapa corporal
  clinico_geral: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  clinica_medica: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  cardiologia: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  pneumologia: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  gastroenterologia: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  neurologia: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  pediatria: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding, description: 'Achados anatômicos por região' },
  dermatologia: { mapType: 'body', label: 'Mapa Dermatológico', icon: PersonStanding, description: 'Lesões e condições da pele' },

  // Nutrição → Diário Alimentar
  nutricao: { mapType: 'meal', label: 'Diário Alimentar', icon: Utensils, description: 'Refeições e hábitos alimentares' },
  nutricionista: { mapType: 'meal', label: 'Diário Alimentar', icon: Utensils, description: 'Refeições e hábitos alimentares' },

  // Fisio / Ortopedia → Musculoesquelético
  fisioterapia: { mapType: 'musculoskeletal', label: 'Mapa Musculoesquelético', icon: Activity, description: 'Articulações e grupos musculares' },
  fisioterapeuta: { mapType: 'musculoskeletal', label: 'Mapa Musculoesquelético', icon: Activity, description: 'Articulações e grupos musculares' },
  ortopedia: { mapType: 'musculoskeletal', label: 'Mapa Musculoesquelético', icon: Activity, description: 'Articulações e grupos musculares' },
  reumatologia: { mapType: 'musculoskeletal', label: 'Mapa Musculoesquelético', icon: Activity, description: 'Articulações e grupos musculares' },

  // Psicologia → Mapa Psíquico (áreas da vida)
  psicologia: { mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain, description: 'Áreas da vida e estado emocional' },
  psicologo: { mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain, description: 'Áreas da vida e estado emocional' },
  psicanalise: { mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain, description: 'Áreas da vida e estado emocional' },
  psicoterapia: { mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain, description: 'Áreas da vida e estado emocional' },
  neuropsicologia: { mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain, description: 'Áreas da vida e estado emocional' },
  psiquiatria: { mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain, description: 'Áreas da vida e estado emocional' },
};

function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

export function getMapForSpecialty(specialty: string | null | undefined): MapConfig | null {
  const key = normalize(specialty);
  if (!key) return null;
  if (MAP_BY_SPECIALTY[key]) return MAP_BY_SPECIALTY[key];
  // Loose match: try first word
  const firstWord = key.split('_')[0];
  if (firstWord && MAP_BY_SPECIALTY[firstWord]) return MAP_BY_SPECIALTY[firstWord];
  return null;
}

export interface ConditionOption {
  value: string;
  label: string;
  color: string;
}

export const CONDITIONS_BY_MAP: Record<MapType, ConditionOption[]> = {
  tooth: [
    { value: 'healthy', label: 'Saudável', color: '#22C55E' },
    { value: 'cavity', label: 'Cárie', color: '#EF4444' },
    { value: 'restoration', label: 'Restauração', color: '#3B82F6' },
    { value: 'extraction', label: 'Extração', color: '#6B7280' },
    { value: 'crown', label: 'Coroa', color: '#F59E0B' },
    { value: 'root_canal', label: 'Canal', color: '#8B5CF6' },
    { value: 'implant', label: 'Implante', color: '#06B6D4' },
    { value: 'bridge', label: 'Ponte', color: '#EC4899' },
    { value: 'missing', label: 'Ausente', color: '#9CA3AF' },
  ],
  foot: [
    { value: 'healthy', label: 'Saudável', color: '#22C55E' },
    { value: 'callus', label: 'Calo', color: '#F59E0B' },
    { value: 'fungus', label: 'Micose', color: '#A855F7' },
    { value: 'ingrown_nail', label: 'Unha encravada', color: '#EF4444' },
    { value: 'spur', label: 'Esporão', color: '#EC4899' },
    { value: 'pain', label: 'Dor', color: '#DC2626' },
    { value: 'wound', label: 'Ferida', color: '#B91C1C' },
    { value: 'deformity', label: 'Deformidade', color: '#6B7280' },
  ],
  body: [
    { value: 'healthy', label: 'Sem queixa', color: '#22C55E' },
    { value: 'pain', label: 'Dor', color: '#EF4444' },
    { value: 'lesion', label: 'Lesão', color: '#F59E0B' },
    { value: 'surgery', label: 'Cirurgia prévia', color: '#8B5CF6' },
    { value: 'allergy', label: 'Alergia', color: '#EC4899' },
    { value: 'rash', label: 'Erupção', color: '#A855F7' },
    { value: 'numbness', label: 'Dormência', color: '#06B6D4' },
  ],
  meal: [
    { value: 'balanced', label: 'Balanceada', color: '#22C55E' },
    { value: 'high_carb', label: 'Rica em carbo', color: '#F59E0B' },
    { value: 'high_protein', label: 'Rica em proteína', color: '#3B82F6' },
    { value: 'fast_food', label: 'Fast food', color: '#EF4444' },
    { value: 'skipped', label: 'Pulou refeição', color: '#9CA3AF' },
  ],
  musculoskeletal: [
    { value: 'healthy', label: 'Sem queixa', color: '#22C55E' },
    { value: 'pain', label: 'Dor', color: '#EF4444' },
    { value: 'stiffness', label: 'Rigidez', color: '#F59E0B' },
    { value: 'limited_range', label: 'Mobilidade reduzida', color: '#8B5CF6' },
    { value: 'inflammation', label: 'Inflamação', color: '#EC4899' },
    { value: 'weakness', label: 'Fraqueza', color: '#06B6D4' },
    { value: 'injury', label: 'Lesão', color: '#B91C1C' },
  ],
  psyche: [
    { value: 'stable', label: 'Estável', color: '#22C55E' },
    { value: 'improving', label: 'Em melhora', color: '#06B6D4' },
    { value: 'worsening', label: 'Em piora', color: '#F59E0B' },
    { value: 'crisis', label: 'Em crise', color: '#EF4444' },
    { value: 'goal', label: 'Meta terapêutica', color: '#8B5CF6' },
    { value: 'resource', label: 'Recurso/apoio', color: '#3B82F6' },
  ],
};

export function getConditionMeta(mapType: MapType, value: string): ConditionOption {
  const list = CONDITIONS_BY_MAP[mapType] ?? [];
  return list.find((c) => c.value === value) ?? { value, label: value, color: '#9CA3AF' };
}
