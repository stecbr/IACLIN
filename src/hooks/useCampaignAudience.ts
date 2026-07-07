import { supabase } from '@/integrations/supabase/client';

/**
 * Segmentação de público para Campanhas — roda na base REAL (Supabase),
 * não no JSON-db do backend. Reusa os campos que já existem na tabela
 * `patients` (is_active, date_of_birth, insurance_provider) e em
 * `appointments` (start_time, status).
 *
 * Retorna a lista de destinatários resolvida (com telefone) e a contagem.
 * O front manda essa lista pronta pro backend, que só dispara.
 */

export type AudienceType =
  | 'all'
  | 'active'
  | 'inactive'
  | 'scheduled'
  | 'absent'
  | 'birthday'
  | 'private'
  | 'insurance'
  | 'manual';

export interface AudienceFilters {
  /** meses sem consulta — usado por audienceType 'absent' */
  last_visit_months?: number | null;
  /** nome do convênio — usado por audienceType 'insurance' */
  insurance_plan?: string | null;
  /** ids de pacientes — usado por audienceType 'manual' */
  patient_ids?: string[] | null;
}

export interface Recipient {
  patient_id: string;
  phone: string;
  name: string;
}

export interface AudienceResult {
  recipients: Recipient[];
  count: number;
}

type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  date_of_birth: string | null;
  insurance_provider: string | null;
};

const SELECT_COLS = 'id, full_name, phone, is_active, date_of_birth, insurance_provider';

// Só entram na campanha pacientes com telefone (sem telefone não há como enviar).
function toRecipients(rows: PatientRow[]): Recipient[] {
  return rows
    .filter((p) => p.phone && p.phone.trim().length > 0)
    .map((p) => ({
      patient_id: p.id,
      phone: p.phone as string,
      name: p.full_name,
    }));
}

async function fetchBasePatients(clinicId: string): Promise<PatientRow[]> {
  const { data, error } = await supabase
    .from('patients')
    .select(SELECT_COLS)
    .eq('clinic_id', clinicId)
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as PatientRow[];
}

// Ids de pacientes com consulta no futuro (para 'scheduled').
async function fetchPatientIdsWithFutureAppointment(clinicId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('appointments')
    .select('patient_id, start_time')
    .eq('clinic_id', clinicId)
    .gte('start_time', new Date().toISOString())
    .limit(10000);
  if (error) throw error;
  return new Set((data ?? []).map((a: { patient_id: string }) => a.patient_id));
}

// Ids de pacientes com consulta DEPOIS do corte (para 'absent' = SEM consulta recente).
async function fetchPatientIdsSeenSince(clinicId: string, since: Date): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('appointments')
    .select('patient_id, start_time')
    .eq('clinic_id', clinicId)
    .gte('start_time', since.toISOString())
    .limit(10000);
  if (error) throw error;
  return new Set((data ?? []).map((a: { patient_id: string }) => a.patient_id));
}

/**
 * Resolve o público em uma lista de destinatários reais.
 * Use para estimativa (só `.count`) e para o envio (`.recipients`).
 */
export async function resolveCampaignAudience(
  clinicId: string,
  audienceType: AudienceType,
  filters: AudienceFilters = {},
): Promise<AudienceResult> {
  if (!clinicId) return { recipients: [], count: 0 };

  const all = await fetchBasePatients(clinicId);
  let selected: PatientRow[] = all;

  switch (audienceType) {
    case 'all':
      selected = all;
      break;

    case 'active':
      selected = all.filter((p) => p.is_active);
      break;

    case 'inactive':
      selected = all.filter((p) => !p.is_active);
      break;

    case 'private':
      // Particular = sem convênio informado.
      selected = all.filter((p) => !p.insurance_provider);
      break;

    case 'insurance':
      selected = filters.insurance_plan
        ? all.filter((p) => p.insurance_provider === filters.insurance_plan)
        : all.filter((p) => !!p.insurance_provider);
      break;

    case 'birthday': {
      // Aniversariantes do mês atual.
      const thisMonth = new Date().getMonth(); // 0-11
      selected = all.filter((p) => {
        if (!p.date_of_birth) return false;
        const m = new Date(p.date_of_birth).getMonth();
        return m === thisMonth;
      });
      break;
    }

    case 'scheduled': {
      const withFuture = await fetchPatientIdsWithFutureAppointment(clinicId);
      selected = all.filter((p) => withFuture.has(p.id));
      break;
    }

    case 'absent': {
      // Sem consulta há X meses = NÃO teve consulta depois do corte.
      const months = filters.last_visit_months ?? 6;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const seenRecently = await fetchPatientIdsSeenSince(clinicId, cutoff);
      selected = all.filter((p) => !seenRecently.has(p.id));
      break;
    }

    case 'manual': {
      const ids = new Set(filters.patient_ids ?? []);
      selected = all.filter((p) => ids.has(p.id));
      break;
    }

    default:
      selected = all;
  }

  const recipients = toRecipients(selected);
  return { recipients, count: recipients.length };
}
