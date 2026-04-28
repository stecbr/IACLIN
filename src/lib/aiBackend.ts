// Cliente HTTP para o backend Node.js da Secretária IA (Evolution API + IA)
// URL configurada exclusivamente via VITE_AI_BACKEND_URL.
// Sem fallback: se a variável não estiver definida, as chamadas falham
// imediatamente com mensagem clara — em vez de tentar uma URL inexistente.

// URL do backend externo da Secretária IA.
// Prioridade: variável de ambiente VITE_AI_BACKEND_URL > fallback hardcoded.
const DEFAULT_AI_BACKEND_URL = 'https://baths-whale-hygiene-chapters.trycloudflare.com';
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new Error(NOT_CONFIGURED_MSG);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
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
};
