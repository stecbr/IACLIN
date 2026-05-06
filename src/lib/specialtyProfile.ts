import { type SpecialtyFamily, getSpecialtyFamily, getFamilyConfig, type FamilyConfig } from './specialtyFamily';

/**
 * Per-family UX profile. Drives:
 *  - Which Home dashboard renders
 *  - Which Attendance tabs appear
 *  - Which PatientDetail tabs appear
 *
 * Keep this file focused on UX flags only. Domain config (terminology,
 * registration label, tools route) lives in specialtyFamily.ts.
 */
export type AttendanceTabKey =
  | 'assessment'
  | 'vitals'
  | 'diagnosis'
  | 'conduct'
  | 'requests'
  | 'procedures'
  | 'notes'
  | 'odontogram'
  | 'soap'
  | 'scales'
  | 'mood'
  | 'anthropometry'
  | 'mealplan';

export type PatientTabKey =
  | 'info'
  | 'anamnese'
  | 'appointments'
  | 'budgets'
  | 'documents'
  | 'financial'
  | 'timeline'
  | 'sessions'
  | 'evolution'
  | 'mealplans';

export interface SpecialtyProfile {
  family: SpecialtyFamily;
  config: FamilyConfig;
  /** Ordered list of tabs for the Attendance screen. */
  attendanceTabs: AttendanceTabKey[];
  /** Ordered list of tabs for the PatientDetail screen. */
  patientTabs: PatientTabKey[];
  /** Show the procedures-with-tooth/surface block in attendance. */
  showToothProcedures: boolean;
  /** Show financial/budgets-related areas. */
  showBudgets: boolean;
}

const PROFILES: Record<SpecialtyFamily, Omit<SpecialtyProfile, 'family' | 'config'>> = {
  odonto: {
    attendanceTabs: ['assessment', 'vitals', 'diagnosis', 'conduct', 'requests', 'procedures', 'notes', 'odontogram'],
    patientTabs: ['info', 'anamnese', 'appointments', 'budgets', 'documents', 'financial', 'timeline'],
    showToothProcedures: true,
    showBudgets: true,
  },
  medical: {
    attendanceTabs: ['assessment', 'vitals', 'diagnosis', 'conduct', 'requests', 'notes'],
    patientTabs: ['info', 'anamnese', 'appointments', 'documents', 'financial', 'timeline'],
    showToothProcedures: false,
    showBudgets: false,
  },
  aesthetic: {
    attendanceTabs: ['assessment', 'vitals', 'diagnosis', 'conduct', 'procedures', 'notes'],
    patientTabs: ['info', 'anamnese', 'appointments', 'budgets', 'documents', 'financial', 'timeline'],
    showToothProcedures: false,
    showBudgets: true,
  },
  psi: {
    attendanceTabs: ['soap', 'scales', 'mood', 'conduct', 'notes'],
    patientTabs: ['info', 'anamnese', 'sessions', 'evolution', 'documents', 'timeline'],
    showToothProcedures: false,
    showBudgets: false,
  },
  nutrition: {
    attendanceTabs: ['assessment', 'anthropometry', 'mealplan', 'conduct', 'notes'],
    patientTabs: ['info', 'anamnese', 'appointments', 'mealplans', 'evolution', 'documents', 'timeline'],
    showToothProcedures: false,
    showBudgets: false,
  },
  physio: {
    attendanceTabs: ['assessment', 'vitals', 'diagnosis', 'conduct', 'notes'],
    patientTabs: ['info', 'anamnese', 'appointments', 'evolution', 'documents', 'timeline'],
    showToothProcedures: false,
    showBudgets: false,
  },
  podology: {
    attendanceTabs: ['assessment', 'diagnosis', 'conduct', 'procedures', 'notes'],
    patientTabs: ['info', 'anamnese', 'appointments', 'documents', 'financial', 'timeline'],
    showToothProcedures: false,
    showBudgets: false,
  },
  generic: {
    attendanceTabs: ['assessment', 'vitals', 'diagnosis', 'conduct', 'requests', 'procedures', 'notes'],
    patientTabs: ['info', 'anamnese', 'appointments', 'documents', 'financial', 'timeline'],
    showToothProcedures: false,
    showBudgets: true,
  },
};

export function getSpecialtyProfile(specialty: string | null | undefined): SpecialtyProfile {
  const family = getSpecialtyFamily(specialty);
  const config = getFamilyConfig(specialty);
  return { family, config, ...PROFILES[family] };
}

export const ATTENDANCE_TAB_LABELS: Record<AttendanceTabKey, string> = {
  assessment: 'Avaliação',
  vitals: 'Sinais Vitais',
  diagnosis: 'Diagnóstico',
  conduct: 'Conduta',
  requests: 'Solicitações',
  procedures: 'Procedimentos',
  notes: 'Evolução',
  odontogram: 'Odontograma',
  soap: 'Sessão (SOAP)',
  scales: 'Escalas',
  mood: 'Humor',
  anthropometry: 'Antropometria',
  mealplan: 'Plano Alimentar',
};

export const PATIENT_TAB_LABELS: Record<PatientTabKey, string> = {
  info: 'Informações',
  anamnese: 'Anamnese',
  appointments: 'Consultas',
  budgets: 'Orçamentos',
  documents: 'Imagens',
  financial: 'Financeiro',
  timeline: 'Timeline',
  sessions: 'Sessões',
  evolution: 'Evolução',
  mealplans: 'Planos Alimentares',
};