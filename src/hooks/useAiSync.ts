import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  aiBackend,
  isAiBackendConfigured,
  type SyncPatientPayload,
  type SyncDoctor,
  type SyncAppointmentItem,
  type SyncAvailabilitySlot,
} from '@/lib/aiBackend';

// ============================================================
// useAiSync — sincroniza dados da clínica com o backend da IA.
//
// Política: TODAS as chamadas são fire-and-forget. Erros são
// silenciados (apenas console.warn) — a UI nunca deve bloquear
// nem mostrar loading/erro por causa de falha de sync.
// ============================================================

const POLL_INTERVAL_MS = 30_000;

function silent<T>(p: Promise<T>): Promise<T | null> {
  return p.catch((err) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[ai-sync] falhou:', err?.message ?? err);
    }
    return null;
  });
}

// ---------- Builders de payload (a partir do Supabase) ----------

async function buildConfigSnapshot(clinicId: string) {
  const [clinicRes, procRes, plansRes, roomsRes, membersRes, handoffRes, credRes] = await Promise.all([
    supabase.from('clinics').select('name, business_hours, address, city, state, zip_code, appointment_approval_mode').eq('id', clinicId).maybeSingle(),
    supabase.from('procedures').select('id, name, default_duration, category').eq('clinic_id', clinicId).eq('is_active', true),
    supabase.from('insurance_plans').select('id, name, ans_code, operator_id').eq('clinic_id', clinicId).eq('is_active', true),
    supabase.from('clinic_rooms').select('id, name').eq('clinic_id', clinicId).eq('is_active', true),
    supabase.from('clinic_members').select('id, user_id, role, specialty').eq('clinic_id', clinicId),
    supabase.from('ai_secretary_handoff').select('enabled, trigger_keywords, handoff_message, target_phone').eq('clinic_id', clinicId).maybeSingle(),
    // Credenciamentos APROVADOS da clínica → operadoras realmente vinculadas
    supabase.from('operator_credentialings').select('operator_id').eq('clinic_id', clinicId).eq('status', 'approved'),
  ]);

  // Conjunto de operadoras com credenciamento aprovado. A IA só pode confirmar
  // um convênio se houver vínculo real (credenciamento) com a operadora dele.
  const credentialedOperators = new Set(
    (credRes.data ?? []).map((c: any) => c.operator_id).filter(Boolean),
  );

  const memberRows = (membersRes.data ?? []) as Array<{ id: string; user_id: string; role: string; specialty: string | null }>;
  const userIds = memberRows.map((m) => m.user_id);
  const profilesRes = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));

  // Procedimentos por membro
  const memberIds = memberRows.map((m) => m.id);
  const { data: cmpRows } = memberIds.length
    ? await supabase
        .from('clinic_member_procedures' as any)
        .select('clinic_member_id, custom_duration, custom_price, procedures(id, name, default_duration, default_price)')
        .in('clinic_member_id', memberIds)
    : { data: [] as any[] };

  const procsByMember = new Map<string, Array<{ id: string; name: string; duration_min: number; price: number | null }>>();
  for (const r of (cmpRows ?? []) as any[]) {
    const p = r.procedures;
    if (!p) continue;
    const arr = procsByMember.get(r.clinic_member_id) ?? [];
    arr.push({
      id: p.id,
      name: p.name,
      duration_min: r.custom_duration ?? p.default_duration ?? 30,
      price: r.custom_price ?? p.default_price ?? null,
    });
    procsByMember.set(r.clinic_member_id, arr);
  }

  const doctors: SyncDoctor[] = memberRows.map((m) => ({
    user_id: m.user_id,
    full_name: profileMap.get(m.user_id) ?? '—',
    role: m.role,
    specialty: m.specialty,
    active: true,
    procedures: procsByMember.get(m.id) ?? [],
  }));

  const handoff = handoffRes.data
    ? {
        enabled: (handoffRes.data as any).enabled ?? false,
        trigger_keywords: (handoffRes.data as any).trigger_keywords ?? null,
        handoff_message: (handoffRes.data as any).handoff_message ?? null,
        target_phone: (handoffRes.data as any).target_phone ?? null,
      }
    : null;

  const c = clinicRes.data as any;
  const fullAddress = c
    ? [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(', ') || null
    : null;

  return {
    clinic_id: clinicId,
    name: c?.name ?? null,
    address: fullAddress,
    business_hours: (clinicRes.data?.business_hours as Record<string, unknown> | null) ?? null,
    approval_mode: ((c?.appointment_approval_mode as 'clinic' | 'professional' | null) ?? 'clinic'),
    procedures: (procRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      duration_min: p.default_duration ?? 30,
      category: p.category,
    })),
    // Envia TODOS os convênios ativos da clínica (is_active=true já filtrado na query).
    // A IA precisa conhecer a lista pra perguntar "particular ou convênio?" e oferecer opções.
    // Se não houver nenhum, envia [] — IA trata como só-particular.
    insurance_plans: (plansRes.data ?? []).map((ip: any) => ({
      id: ip.id,
      name: ip.name,
      code: ip.ans_code ?? null,
    })),
    rooms: (roomsRes.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    doctors,
    handoff,
  };
}

async function buildDoctorsBatch(clinicId: string) {
  const { data: rows } = await supabase
    .from('clinic_members')
    .select('id, user_id, role, specialty')
    .eq('clinic_id', clinicId);
  const memberRows = (rows ?? []) as Array<{ id: string; user_id: string; role: string; specialty: string | null }>;
  const userIds = memberRows.map((m) => m.user_id);
  const profilesRes = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));

  const memberIds = memberRows.map((m) => m.id);
  const { data: cmpRows } = memberIds.length
    ? await supabase
        .from('clinic_member_procedures' as any)
        .select('clinic_member_id, custom_duration, custom_price, procedures(id, name, default_duration, default_price)')
        .in('clinic_member_id', memberIds)
    : { data: [] as any[] };
  const procsByMember = new Map<string, Array<{ id: string; name: string; duration_min: number; price: number | null }>>();
  for (const r of (cmpRows ?? []) as any[]) {
    const p = r.procedures;
    if (!p) continue;
    const arr = procsByMember.get(r.clinic_member_id) ?? [];
    arr.push({
      id: p.id,
      name: p.name,
      duration_min: r.custom_duration ?? p.default_duration ?? 30,
      price: r.custom_price ?? p.default_price ?? null,
    });
    procsByMember.set(r.clinic_member_id, arr);
  }

  return memberRows.map((m) => ({
    user_id: m.user_id,
    full_name: profileMap.get(m.user_id) ?? '—',
    role: m.role,
    specialty: m.specialty,
    active: true,
    procedures: procsByMember.get(m.id) ?? [],
  }));
}

async function buildPatientsBatch(clinicId: string): Promise<SyncPatientPayload[]> {
  const { data: patients } = await supabase
    .from('patients')
    .select('id, full_name, phone, cpf, patient_user_id, date_of_birth')
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  const list = (patients ?? []) as Array<{
    id: string;
    full_name: string;
    phone: string | null;
    cpf: string | null;
    patient_user_id: string | null;
    date_of_birth: string | null;
  }>;
  if (list.length === 0) return [];

  const ids = list.map((p) => p.id);

  const [txRes, accountsRes, anamnesesRes, apptsRes] = await Promise.all([
    supabase
      .from('financial_transactions')
      .select('patient_id, amount, type, status')
      .in('patient_id', ids)
      .eq('clinic_id', clinicId)
      .eq('status', 'pending')
      .eq('type', 'income'),
    list.some((p) => p.cpf)
      ? supabase.from('patient_accounts').select('id, cpf, phone').in('cpf', list.map((p) => p.cpf).filter(Boolean) as string[])
      : Promise.resolve({ data: [] as Array<{ id: string; cpf: string; phone: string | null }> }),
    supabase.from('anamneses').select('patient_id, allergies, medications, notes').in('patient_id', ids),
    supabase
      .from('appointments')
      .select('id, patient_id, start_time, status, procedures(name)')
      .in('patient_id', ids)
      .eq('clinic_id', clinicId)
      .order('start_time', { ascending: true }),
  ]);

  const balanceMap = new Map<string, number>();
  for (const t of (txRes.data ?? []) as Array<{ patient_id: string | null; amount: number }>) {
    if (!t.patient_id) continue;
    balanceMap.set(t.patient_id, (balanceMap.get(t.patient_id) ?? 0) + Number(t.amount ?? 0));
  }

  const accountByCpf = new Map(
    ((accountsRes.data ?? []) as Array<{ id: string; cpf: string; phone: string | null }>).map((a) => [a.cpf, a]),
  );

  const anamneseByPatient = new Map(
    ((anamnesesRes.data ?? []) as Array<{
      patient_id: string;
      allergies: string | null;
      medications: string | null;
      notes: string | null;
    }>).map((a) => [a.patient_id, a]),
  );

  const now = Date.now();
  type Appt = { id: string; patient_id: string; start_time: string; status: string; procedures: { name: string } | null };
  const lastByPatient = new Map<string, Appt>();
  const nextByPatient = new Map<string, Appt>();
  for (const a of (apptsRes.data ?? []) as unknown as Appt[]) {
    const t = new Date(a.start_time).getTime();
    if (t <= now) {
      const cur = lastByPatient.get(a.patient_id);
      if (!cur || new Date(cur.start_time).getTime() < t) lastByPatient.set(a.patient_id, a);
    } else {
      const cur = nextByPatient.get(a.patient_id);
      if (!cur || new Date(cur.start_time).getTime() > t) nextByPatient.set(a.patient_id, a);
    }
  }

  return list.map((p) => {
    const acc = p.cpf ? accountByCpf.get(p.cpf) : undefined;
    const ana = anamneseByPatient.get(p.id);
    const last = lastByPatient.get(p.id);
    const next = nextByPatient.get(p.id);
    return {
      id: p.id,
      clinic_id: clinicId,
      account_id: acc?.id ?? null,
      full_name: p.full_name,
      phone: acc?.phone ?? p.phone ?? null,
      date_of_birth: p.date_of_birth ?? null,
      balance: balanceMap.get(p.id) ?? 0,
      last_appointment: last
        ? {
            id: last.id,
            start_time: last.start_time,
            status: last.status,
            procedure_name: last.procedures?.name ?? null,
          }
        : null,
      next_appointment: next
        ? {
            id: next.id,
            start_time: next.start_time,
            status: next.status,
            procedure_name: next.procedures?.name ?? null,
          }
        : null,
      anamnese: ana
        ? { allergies: ana.allergies, medications: ana.medications, notes: ana.notes }
        : null,
    };
  });
}

async function buildNpsSurveys(clinicId: string) {
  const { data } = await supabase
    .from('nps_surveys')
    .select('id, name, question, scale_min, scale_max, send_after_hours, is_active, is_default')
    .eq('clinic_id', clinicId)
    .eq('is_active', true);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    question: string;
    scale_min: number;
    scale_max: number;
    send_after_hours: number;
    is_active: boolean;
    is_default: boolean;
  }>;
}

async function buildAvailabilitySlots(clinicId: string): Promise<SyncAvailabilitySlot[]> {
  const { data } = await supabase
    .from('professional_availability')
    .select('user_id, work_date, start_time, end_time')
    .eq('clinic_id', clinicId);
  return ((data ?? []) as Array<{ user_id: string; work_date: string; start_time: string; end_time: string }>).map(
    (s) => {
      // work_date no formato YYYY-MM-DD — calcular day_of_week local
      const [y, m, d] = s.work_date.split('-').map(Number);
      const dow = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
      return {
        professional_id: s.user_id,
        day_of_week: dow,
        start_time: s.start_time?.slice(0, 5) ?? s.start_time,
        end_time: s.end_time?.slice(0, 5) ?? s.end_time,
      };
    },
  );
}

async function buildAppointmentsNext30(clinicId: string): Promise<SyncAppointmentItem[]> {
  // Inclui cancelados das últimas 48h para disparar a automação de reagendamento
  const since = new Date();
  since.setDate(since.getDate() - 2);
  const end = new Date();
  end.setDate(end.getDate() + 30);

  const { data } = await supabase
    .from('appointments')
    .select('id, dentist_id, patient_id, start_time, end_time, status, patients(full_name, phone), procedures(name)')
    .eq('clinic_id', clinicId)
    .gte('start_time', since.toISOString())
    .lte('start_time', end.toISOString());

  const rows = (data ?? []) as any[];

  // Resolve nome do médico via clinic_members → profiles
  const dentistIds = [...new Set(rows.map((a) => a.dentist_id).filter(Boolean))];
  const profileMap = new Map<string, string>();
  if (dentistIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', dentistIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) profileMap.set(p.id, p.full_name);
    }
  }

  return rows.map((a) => ({
    id: a.id,
    dentist_id: a.dentist_id,
    dentist_name: a.dentist_id ? profileMap.get(a.dentist_id) ?? null : null,
    patient_id: a.patient_id ?? null,
    patient_name: a.patients?.full_name ?? null,
    patient_phone: a.patients?.phone ?? null,
    procedure: a.procedures?.name ?? null,
    start_time: a.start_time,
    end_time: a.end_time,
    status: a.status,
  }));
}

// ============================================================
// Helpers exportados — chamados por mutations específicas
// ============================================================

export async function syncOnePatient(patientId: string, clinicId: string) {
  if (!isAiBackendConfigured()) return;
  try {
    const list = await buildPatientsBatch(clinicId);
    const one = list.find((p) => p.id === patientId);
    if (!one) return;
    await silent(aiBackend.syncPatient(one));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ai-sync] syncOnePatient:', err);
  }
}

export async function syncOneDoctor(payload: {
  clinicId: string;
  userId: string;
  fullName: string;
  role: string;
  specialty: string | null;
  active: boolean;
}) {
  if (!isAiBackendConfigured()) return;
  await silent(
    aiBackend.syncDoctor({
      clinic_id: payload.clinicId,
      user_id: payload.userId,
      full_name: payload.fullName,
      role: payload.role,
      specialty: payload.specialty,
      active: payload.active,
    }),
  );
}

export async function syncAgendaAppointments(clinicId: string) {
  if (!isAiBackendConfigured()) return;
  try {
    const appointments = await buildAppointmentsNext30(clinicId);
    await silent(aiBackend.syncAppointments({ clinic_id: clinicId, appointments }));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ai-sync] syncAgendaAppointments:', err);
  }
}

export async function syncClinicAvailability(clinicId: string) {
  if (!isAiBackendConfigured()) return;
  try {
    const availability = await buildAvailabilitySlots(clinicId);
    await silent(aiBackend.syncAvailability({ clinic_id: clinicId, availability }));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ai-sync] syncClinicAvailability:', err);
  }
}

export async function syncClinicConfig(clinicId: string) {
  if (!isAiBackendConfigured()) return;
  try {
    const config = await buildConfigSnapshot(clinicId);
    await silent(aiBackend.syncConfig(config));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[ai-sync] syncClinicConfig:', err);
  }
}

// ============================================================
// useAiSync — dispara o snapshot inicial e o polling de IA-pending
// ============================================================

export function useAiSync(clinicId: string | null | undefined) {
  const lastSyncedClinicRef = useRef<string | null>(null);

  // Snapshot inicial (fire-and-forget) sempre que a clínica muda
  useEffect(() => {
    if (!clinicId || !isAiBackendConfigured()) return;
    if (lastSyncedClinicRef.current === clinicId) return;
    lastSyncedClinicRef.current = clinicId;

    let cancelled = false;
    (async () => {
      try {
        const [config, doctors, patients, availability, npsSurveys] = await Promise.all([
          buildConfigSnapshot(clinicId),
          buildDoctorsBatch(clinicId),
          buildPatientsBatch(clinicId),
          buildAvailabilitySlots(clinicId),
          buildNpsSurveys(clinicId),
        ]);
        if (cancelled) return;
        await Promise.all([
          silent(aiBackend.syncConfig(config)),
          silent(aiBackend.syncDoctors({ clinic_id: clinicId, doctors })),
          silent(aiBackend.syncPatients(patients)),
          silent(aiBackend.syncAvailability({ clinic_id: clinicId, availability })),
          silent(aiBackend.syncNpsSurveys({ clinic_id: clinicId, surveys: npsSurveys })),
        ]);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[ai-sync] snapshot inicial:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  // Polling: pega agendamentos criados pela IA pendentes e grava no Supabase
  useEffect(() => {
    if (!clinicId || !isAiBackendConfigured()) return;

    let stopped = false;

    const tick = async () => {
      try {
        const res = await aiBackend.getAiPendingAppointments(clinicId);
        const items = res?.data ?? [];
        if (stopped || items.length === 0) return;

        for (const item of items) {
          if (stopped) break;
          try {
            const insertPayload: Record<string, unknown> = {
              clinic_id: clinicId,
              dentist_id: item.dentist_id,
              patient_id: item.patient_id,
              start_time: item.start_time,
              end_time: item.end_time,
              status: item.status ?? 'scheduled',
              notes: item.notes ?? null,
              procedure_id: item.procedure_id ?? null,
            };
            // patient_id é obrigatório no Supabase; pular se IA ainda não vinculou
            if (!insertPayload.patient_id) continue;

            const { data: inserted, error } = await supabase
              .from('appointments')
              .insert(insertPayload as any)
              .select('id')
              .single();
            if (error || !inserted) {
              if (import.meta.env.DEV) console.warn('[ai-sync] insert appointment falhou:', error?.message);
              continue;
            }
            await silent(aiBackend.confirmAiAppointmentSync(clinicId, item.id, inserted.id));
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[ai-sync] processar item IA:', err);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[ai-sync] polling:', err);
      }

      // NPS: respostas (notas 0–10) captadas pela IA → grava em nps_responses
      try {
        const npsRes = await aiBackend.getNpsPendingResults(clinicId);
        const results = npsRes?.data ?? [];
        for (const r of results) {
          if (stopped) break;
          try {
            const { data: inserted, error } = await supabase
              .from('nps_responses')
              .insert({
                clinic_id: clinicId,
                survey_id: r.survey_id ?? null,
                appointment_id: r.appointment_id ?? null,
                patient_id: r.patient_id ?? null,
                patient_phone: r.patient_phone ?? null,
                score: r.score,
                comment: r.comment ?? null,
                category: r.category ?? null,
                status: 'answered',
                answered_at: r.answered_at ?? new Date().toISOString(),
              } as any)
              .select('id')
              .single();
            if (error || !inserted) {
              if (import.meta.env.DEV) console.warn('[ai-sync] insert nps falhou:', error?.message);
              continue;
            }
            await silent(aiBackend.confirmNpsResultSync(clinicId, r.id, inserted.id));
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[ai-sync] processar nps:', err);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[ai-sync] polling nps:', err);
      }
    };

    // Primeira execução imediata + intervalo
    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [clinicId]);

  // Helper exposto para forçar sync de availability após mutations
  const refreshAvailability = useCallback(async () => {
    if (!clinicId || !isAiBackendConfigured()) return;
    try {
      const availability = await buildAvailabilitySlots(clinicId);
      await silent(aiBackend.syncAvailability({ clinic_id: clinicId, availability }));
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[ai-sync] refreshAvailability:', err);
    }
  }, [clinicId]);

  return { refreshAvailability };
}