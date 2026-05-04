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
  /** Type of conflict so UI can decide how to react */
  type?: 'patient_overlap' | 'doctor_overlap';
  /** Conflicting record (only set for patient_overlap so the UI can offer to replace it) */
  existing?: {
    id: string;
    dentistId: string;
    dentistName: string;
    startTime: string;
    endTime: string;
  };
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

  // Build local Sao_Paulo day range to check "same patient + same doctor + same day"
  const ymd = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
  }).format(startTime);
  const dayStartIso = new Date(`${ymd}T00:00:00-03:00`).toISOString();
  const dayEndIso = new Date(new Date(`${ymd}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();

  // a1) Same patient + same doctor + same day -> patient_overlap (offer replace)
  {
    let q = supabase
      .from('appointments')
      .select('id, dentist_id, start_time, end_time')
      .eq('patient_id', patientId)
      .eq('dentist_id', dentistId)
      .gte('start_time', dayStartIso)
      .lt('start_time', dayEndIso)
      .neq('status', 'cancelled');
    if (ignoreAppointmentId) q = q.neq('id', ignoreAppointmentId);
    const { data } = await q.limit(1);
    if (data && data.length > 0) {
      const conflict = data[0];
      const name = await getDentistName(supabase, conflict.dentist_id);
      return {
        ok: false,
        type: 'patient_overlap',
        message: `O paciente já tem consulta com Dr(a). ${name} neste dia, das ${format(new Date(conflict.start_time), 'HH:mm')} às ${format(new Date(conflict.end_time), 'HH:mm')}.`,
        existing: {
          id: conflict.id,
          dentistId: conflict.dentist_id,
          dentistName: name,
          startTime: conflict.start_time,
          endTime: conflict.end_time,
        },
      };
    }
  }

  // a2) Patient time overlap with another doctor at same time
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
        type: 'patient_overlap',
        message: `O paciente já tem consulta com Dr(a). ${name} das ${format(new Date(conflict.start_time), 'HH:mm')} às ${format(new Date(conflict.end_time), 'HH:mm')}.`,
        existing: {
          id: conflict.id,
          dentistId: conflict.dentist_id,
          dentistName: name,
          startTime: conflict.start_time,
          endTime: conflict.end_time,
        },
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
        type: 'doctor_overlap',
        message: `Você já tem atendimento marcado das ${format(new Date(conflict.start_time), 'HH:mm')} às ${format(new Date(conflict.end_time), 'HH:mm')}.`,
      };
    }
  }

  return { ok: true };
}
