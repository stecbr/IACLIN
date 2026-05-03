import { format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConflictCheckParams {
  supabase: SupabaseClient<any, any, any>;
  patientId: string;
  dentistId: string;
  startTime: Date;
  endTime: Date;
  ignoreAppointmentId?: string;
}

export interface ConflictResult {
  ok: boolean;
  message?: string;
}

async function getDentistName(
  supabase: SupabaseClient<any, any, any>,
  dentistId: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', dentistId)
    .maybeSingle();
  return (data?.full_name as string) || 'profissional';
}

/**
 * Validates booking conflicts:
 *  - Patient cannot have another appointment with the same doctor on the same day.
 *  - Patient cannot have another appointment overlapping the requested time slot (any doctor).
 *  - Doctor cannot have another appointment overlapping the requested time slot.
 */
export async function checkAppointmentConflicts({
  supabase,
  patientId,
  dentistId,
  startTime,
  endTime,
  ignoreAppointmentId,
}: ConflictCheckParams): Promise<ConflictResult> {
  const startIso = startTime.toISOString();
  const endIso = endTime.toISOString();

  // a) Patient time overlap (any doctor)
  {
    let q = supabase
      .from('appointments')
      .select('id, dentist_id, start_time, end_time')
      .eq('patient_id', patientId)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .neq('status', 'cancelled');
    if (ignoreAppointmentId) q = q.neq('id', ignoreAppointmentId);
    const { data } = await q.limit(1);
    if (data && data.length > 0) {
      const conflict = data[0];
      const name = await getDentistName(supabase, conflict.dentist_id);
      return {
        ok: false,
        message: `O paciente já tem consulta com Dr(a). ${name} das ${format(new Date(conflict.start_time), 'HH:mm')} às ${format(new Date(conflict.end_time), 'HH:mm')}.`,
      };
    }
  }

  // c) Doctor time overlap
  {
    let q = supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('dentist_id', dentistId)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .neq('status', 'cancelled');
    if (ignoreAppointmentId) q = q.neq('id', ignoreAppointmentId);
    const { data } = await q.limit(1);
    if (data && data.length > 0) {
      const conflict = data[0];
      return {
        ok: false,
        message: `Você já tem atendimento marcado das ${format(new Date(conflict.start_time), 'HH:mm')} às ${format(new Date(conflict.end_time), 'HH:mm')}.`,
      };
    }
  }

  return { ok: true };
}
