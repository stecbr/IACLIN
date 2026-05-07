import {
  Bone, Brain, Sparkles, Stethoscope, Apple, Activity, Footprints,
  HeartPulse, type LucideIcon,
} from 'lucide-react';

/**
 * High-level "family" buckets that group 60+ specialties into 7 dashboards.
 * Each family decides:
 *  - Which Tools route the professional sees
 *  - Which procedure catalog (specialty_category) to load
 *  - Terminology ("paciente"/"cliente", "consulta"/"sessão")
 *  - Registration label (CRO / CRM / CRP / CRN / CREFITO / CRF)
 */
export type SpecialtyFamily =
  | 'odonto'
  | 'aesthetic'
  | 'psi'
  | 'medical'
  | 'nutrition'
  | 'physio'
  | 'podology'
  | 'generic';

export interface FamilyConfig {
  family: SpecialtyFamily;
  label: string;
  toolsRoute: string;
  patientNoun: string;
  patientNounPlural: string;
  appointmentNoun: string;
  appointmentNounPlural: string;
  registrationLabel: 'CRO' | 'CRM' | 'CRP' | 'CRN' | 'CREFITO' | 'CRF' | 'CR';
  icon: LucideIcon;
  /** Maps to procedures.specialty_category column. */
  procedureCategory: 'odonto' | 'estetica' | 'psi' | 'medico' | 'nutricao' | 'fisio' | 'podologia' | 'outro';
  /** Hide the dental "tooth" field in budgets / odontogram. */
  hasTooth: boolean;
}

/**
 * Normalize a specialty id (lowercase, accents stripped, separators unified).
 */
function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
}

/** Substring buckets — a specialty matches if its normalized id contains any token. */
const FAMILY_PATTERNS: Array<{ family: SpecialtyFamily; tokens: string[] }> = [
  // Odontology — every dental specialty
  { family: 'odonto', tokens: [
    'dentist', 'dental', 'odonto', 'orto', 'endo', 'perio', 'implanto',
    'bucomax', 'protese-dent', 'limpeza-dental', 'estomatolog',
  ]},
  // Aesthetic
  { family: 'aesthetic', tokens: [
    'cirurgia-plastica', 'plastica', 'estetica', 'dermatolog',
  ]},
  // Psi / Mental health
  { family: 'psi', tokens: [
    'psicolog', 'psicoterap', 'psicanal', 'psiquiatr', 'neuropsico',
    'psicomotric', 'psicopedag',
  ]},
  // Nutrition
  { family: 'nutrition', tokens: ['nutric', 'nutrolog'] },
  // Physio / musculoskeletal rehab
  { family: 'physio', tokens: ['fisio', 'rpg', 'quiropraxia', 'osteopatia'] },
  // Podology
  { family: 'podology', tokens: ['podolog'] },
];

const FAMILY_CONFIGS: Record<SpecialtyFamily, Omit<FamilyConfig, 'family'>> = {
  odonto: {
    label: 'Odontologia',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'consulta',
    appointmentNounPlural: 'consultas',
    registrationLabel: 'CRO',
    icon: Bone,
    procedureCategory: 'odonto',
    hasTooth: true,
  },
  aesthetic: {
    label: 'Estética / Cirurgia Plástica',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'procedimento',
    appointmentNounPlural: 'procedimentos',
    registrationLabel: 'CRM',
    icon: Sparkles,
    procedureCategory: 'estetica',
    hasTooth: false,
  },
  psi: {
    label: 'Psicologia / Saúde Mental',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'sessão',
    appointmentNounPlural: 'sessões',
    registrationLabel: 'CRP',
    icon: Brain,
    procedureCategory: 'psi',
    hasTooth: false,
  },
  medical: {
    label: 'Médico Clínico',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'consulta',
    appointmentNounPlural: 'consultas',
    registrationLabel: 'CRM',
    icon: Stethoscope,
    procedureCategory: 'medico',
    hasTooth: false,
  },
  nutrition: {
    label: 'Nutrição',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'consulta',
    appointmentNounPlural: 'consultas',
    registrationLabel: 'CRN',
    icon: Apple,
    procedureCategory: 'nutricao',
    hasTooth: false,
  },
  physio: {
    label: 'Fisioterapia / Reabilitação',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'sessão',
    appointmentNounPlural: 'sessões',
    registrationLabel: 'CREFITO',
    icon: Activity,
    procedureCategory: 'fisio',
    hasTooth: false,
  },
  podology: {
    label: 'Podologia',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'atendimento',
    appointmentNounPlural: 'atendimentos',
    registrationLabel: 'CR',
    icon: Footprints,
    procedureCategory: 'podologia',
    hasTooth: false,
  },
  generic: {
    label: 'Atendimento Clínico',
    toolsRoute: '/ferramentas',
    patientNoun: 'paciente',
    patientNounPlural: 'pacientes',
    appointmentNoun: 'atendimento',
    appointmentNounPlural: 'atendimentos',
    registrationLabel: 'CRM',
    icon: HeartPulse,
    procedureCategory: 'outro',
    hasTooth: false,
  },
};

/**
 * Returns the family for a given specialty id (e.g. "cirurgia-plastica", "nutricao").
 * Defaults to 'generic' if unknown.
 */
export function getSpecialtyFamily(specialtyId: string | null | undefined): SpecialtyFamily {
  const key = normalize(specialtyId);
  if (!key) return 'generic';
  for (const { family, tokens } of FAMILY_PATTERNS) {
    if (tokens.some((t) => key.includes(t))) return family;
  }
  return 'generic';
}

export function getFamilyConfig(specialtyId: string | null | undefined): FamilyConfig {
  const family = getSpecialtyFamily(specialtyId);
  return { family, ...FAMILY_CONFIGS[family] };
}

export function getFamilyConfigByFamily(family: SpecialtyFamily): FamilyConfig {
  return { family, ...FAMILY_CONFIGS[family] };
}