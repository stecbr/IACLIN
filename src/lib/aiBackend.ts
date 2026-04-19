// Cliente HTTP para o backend Node.js da Secretária IA (Evolution API + IA)
// URL configurável via VITE_AI_BACKEND_URL (default: http://localhost:3333)

const BASE_URL =
  (import.meta.env.VITE_AI_BACKEND_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://bitter-oranges-battle.loca.lt';

export interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instance_name: string | null;
}

export interface WhatsAppConnectResponse {
  qr_code: string; // base64
}

export interface ConversationTestResponse {
  reply: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
};

export const AI_BACKEND_URL = BASE_URL;
