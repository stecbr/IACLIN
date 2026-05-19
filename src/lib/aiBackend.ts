// Cliente HTTP para o backend Node.js da Secretária IA (Evolution API + IA)
// URL configurada exclusivamente via VITE_AI_BACKEND_URL.
// Sem fallback: se a variável não estiver definida, as chamadas falham
// imediatamente com mensagem clara — em vez de tentar uma URL inexistente.

// URL do backend externo da Secretária IA.
// Prioridade: variável de ambiente VITE_AI_BACKEND_URL > fallback hardcoded.
const DEFAULT_AI_BACKEND_URL = 'https://iaclin.stec-apps.com';
const RAW_URL = (import.meta.env.VITE_AI_BACKEND_URL as string | undefined)?.trim() || DEFAULT_AI_BACKEND_URL;
const BASE_URL = RAW_URL ? RAW_URL.replace(/\/$/, '') : null;

const NOT_CONFIGURED_MSG =
  'Backend da Secretária IA não configurado.';

export const AI_BACKEND_URL = BASE_URL;
export const isAiBackendConfigured = () => !!BASE_URL;

export interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instance_name: string | null;
  phone?: string | null;
  phone_number?: string | null;
  number?: string | null;
}

export interface WhatsAppConnectResponse {
  qr_code: string | null; // base64 (null quando já conectado)
  connected?: boolean;
  status?: string;
  instance_name?: string;
}

export interface ConversationTestResponse {
  reply: string;
}

// ============================================================
// Sync types — payloads enviados ao backend externo da IA
// ============================================================

export interface SyncProcedure {
  id: string;
  name: string;
  duration_min: number;
  category: string;
}

export interface SyncInsurancePlan {
  id: string;
  name: string;
  code: string | null;
}

export interface SyncRoom {
  id: string;
  name: string;
}

export interface SyncDoctor {
  user_id: string;
  full_name: string;
  role: string;
  specialty: string | null;
  active?: boolean;
}

export interface SyncConfigPayload {
  clinic_id: string;
  business_hours: Record<string, unknown> | null;
  procedures: SyncProcedure[];
  insurance_plans: SyncInsurancePlan[];
  rooms: SyncRoom[];
  doctors: SyncDoctor[];
}

export interface SyncDoctorsBatchPayload {
  clinic_id: string;
  doctors: Required<SyncDoctor>[];
}

export interface SyncDoctorPayload {
  clinic_id: string;
  user_id: string;
  full_name: string;
  role: string;
  specialty: string | null;
  active: boolean;
}

export interface SyncPatientAppointmentRef {
  id: string;
  start_time: string;
  status: string;
  procedure_name: string | null;
}

export interface SyncPatientAnamnese {
  allergies: string | null;
  medications: string | null;
  notes: string | null;
}

export interface SyncPatientPayload {
  id: string;
  clinic_id: string;
  account_id: string | null;
  full_name: string;
  phone: string | null;
  balance: number;
  last_appointment: SyncPatientAppointmentRef | null;
  next_appointment: SyncPatientAppointmentRef | null;
  anamnese: SyncPatientAnamnese | null;
}

export interface SyncAvailabilitySlot {
  professional_id: string;
  day_of_week: number; // 0=domingo .. 6=sábado
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

export interface SyncAvailabilityPayload {
  clinic_id: string;
  availability: SyncAvailabilitySlot[];
}

export interface SyncAppointmentItem {
  id: string;
  dentist_id: string;
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
  status: string;
}

export interface SyncAppointmentsPayload {
  clinic_id: string;
  appointments: SyncAppointmentItem[];
}

export interface AiCreatedAppointment {
  id: string;
  clinic_id: string;
  dentist_id: string;
  patient_phone?: string | null;
  patient_name?: string | null;
  patient_id?: string | null;
  start_time: string;
  end_time: string;
  status?: string;
  procedure_id?: string | null;
  notes?: string | null;
  source?: string;
  sync_status?: string;
  [key: string]: unknown;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new Error(NOT_CONFIGURED_MSG);
  }
  // Timeout para evitar requisições penduradas quando o backend IA está fora.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Backend IA respondeu ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`
      );
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const aiBackend = {
  getWhatsAppStatus: (clinicId: string) =>
    request<WhatsAppStatus>(`/api/clinics/${clinicId}/whatsapp/status`),

  connectWhatsApp: (clinicId: string) =>
    request<WhatsAppConnectResponse>(`/api/clinics/${clinicId}/whatsapp/connect`, {
      method: 'POST',
    }),

  testConversation: (clinicId: string, patient_phone: string, message: string) =>
    request<ConversationTestResponse>(`/api/clinics/${clinicId}/conversation/test`, {
      method: 'POST',
      body: JSON.stringify({ patient_phone, message }),
    }),

  disconnectWhatsApp: (clinicId: string) =>
    request<{ success: boolean }>(`/api/clinics/${clinicId}/whatsapp/disconnect`, {
      method: 'DELETE',
    }),

  // ============================================================
  // Sync — envia snapshot dos dados da clínica para a Secretária IA
  // ============================================================

  /** 1. Sync da configuração geral da clínica */
  syncConfig: (payload: SyncConfigPayload) =>
    request<{ ok: boolean }>(`/api/sync/config`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 2a. Sync em lote de médicos (ao carregar a clínica) */
  syncDoctors: (payload: SyncDoctorsBatchPayload) =>
    request<{ ok: boolean }>(`/api/sync/doctors`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 2b. Sync individual de médico (add/edit/remove) */
  syncDoctor: (payload: SyncDoctorPayload) =>
    request<{ ok: boolean }>(`/api/sync/doctor`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 3a. Sync individual de paciente (criação/edição) */
  syncPatient: (payload: SyncPatientPayload) =>
    request<{ ok: boolean }>(`/api/sync/patient`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 3b. Sync em lote de pacientes (ao carregar a clínica) */
  syncPatients: (patients: SyncPatientPayload[]) =>
    request<{ ok: boolean }>(`/api/sync/patients`, {
      method: 'POST',
      body: JSON.stringify({ patients }),
    }),

  /** 4. Sync de disponibilidade dos profissionais */
  syncAvailability: (payload: SyncAvailabilityPayload) =>
    request<{ ok: boolean }>(`/api/sync/availability`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 5. Sync de agendamentos existentes (próximos 30 dias, status != cancelled) */
  syncAppointments: (payload: SyncAppointmentsPayload) =>
    request<{ ok: boolean }>(`/api/sync/appointments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 6a. Buscar agendamentos criados pela IA pendentes de sincronização */
  getAiPendingAppointments: (clinicId: string) =>
    request<{ ok: boolean; data: AiCreatedAppointment[] }>(
      `/api/clinics/${clinicId}/appointments?source=ai&sync_status=pending`,
    ),

  /** 6b. Confirmar ao backend que um agendamento da IA foi gravado no Supabase */
  confirmAiAppointmentSync: (
    clinicId: string,
    appointmentId: string,
    supabaseId: string,
  ) =>
    request<{ ok: boolean }>(
      `/api/clinics/${clinicId}/appointments/${appointmentId}/sync-confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ supabase_id: supabaseId }),
      },
    ),

  /** 7. Atualiza config da Secretária IA (prompt + enabled) no backend externo */
  updateAiConfig: (
    clinicId: string,
    payload: { custom_prompt: string; enabled: boolean },
  ) =>
    request<{ ok: boolean }>(`/api/data/ai_secretary_config/config-${clinicId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // ============================================================
  // Automações de mensagem (lembretes, NPS, retorno, etc.)
  // ============================================================
  listAutomations: (clinicId: string) =>
    request<{ ok?: boolean; data: AiAutomation[] } | AiAutomation[]>(
      `/api/clinics/${clinicId}/automations`,
    ),

  createAutomation: (clinicId: string, payload: AiAutomationInput) =>
    request<{ ok?: boolean; data?: AiAutomation } | AiAutomation>(
      `/api/clinics/${clinicId}/automations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  updateAutomation: (
    clinicId: string,
    automationId: string,
    payload: Partial<AiAutomationInput> & { enabled?: boolean },
  ) =>
    request<{ ok?: boolean; data?: AiAutomation } | AiAutomation>(
      `/api/clinics/${clinicId}/automations/${automationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  deleteAutomation: (clinicId: string, automationId: string) =>
    request<{ ok: boolean }>(`/api/clinics/${clinicId}/automations/${automationId}`, {
      method: 'DELETE',
    }),

  // ============================================================
  // Conversas — assumir manualmente (handoff humano)
  // ============================================================
  takeoverConversation: (clinicId: string, conversationId: string, agentName?: string) =>
    request<{ ok: boolean; conv_id?: string; phone?: string }>(
      `/api/clinics/${clinicId}/conversations/${conversationId}/takeover`,
      {
        method: 'POST',
        body: JSON.stringify(agentName ? { agent_name: agentName } : {}),
      },
    ),

  releaseConversation: (clinicId: string, conversationId: string) =>
    request<{ ok: boolean; conv_id?: string; phone?: string }>(
      `/api/clinics/${clinicId}/conversations/${conversationId}/takeover`,
      { method: 'DELETE' },
    ),
};

// ============================================================
// Tipos de automação
// ============================================================
export type AiAutomationType =
  | 'reminder'
  | 'return'
  | 'confirmation'
  | 'reschedule'
  | 'handoff';

export interface AiAutomation {
  id: string;
  clinic_id?: string;
  name: string;
  type: AiAutomationType;
  enabled: boolean;
  trigger: string;
  template: string;
  created_at?: string;
  updated_at?: string;
}

export interface AiAutomationInput {
  name: string;
  type: AiAutomationType;
  enabled: boolean;
  trigger: string;
  template: string;
}
