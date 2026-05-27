// =============================================
// Tipos para a área do Super Admin da Plataforma
// =============================================

export type SubStatus = 'active' | 'trial' | 'overdue' | 'cancelled';

export const SUB_STATUS_LABELS: Record<SubStatus, string> = {
  active: 'Ativo',
  trial: 'Em trial',
  overdue: 'Inadimplente',
  cancelled: 'Cancelado',
};

export const PLAN_OPTIONS = ['Básico', 'Profissional', 'Clínica', 'Enterprise'];

export interface PlatformSubscription {
  id: string;
  entity_type: 'clinic' | 'doctor';
  entity_id: string;
  plan_name: string;
  status: SubStatus;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformStats {
  total_clinics: number;
  total_doctors: number;
  total_patients: number;
  active_subs: number;
  trial_subs: number;
  overdue_subs: number;
}

export interface PlatformClinic {
  id: string;
  name: string;
  category: string;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  member_count: number;
  subscription: PlatformSubscription | null;
}

export interface PlatformDoctor {
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  registration: string | null;
  role: string;
  is_owner: boolean;
  clinic_id: string | null;
  clinic_name: string | null;
  created_at: string;
  subscription: PlatformSubscription | null;
}
