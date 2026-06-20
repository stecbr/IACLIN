// =============================================
// Tipos para a área do Super Admin da Plataforma
// =============================================

export type SubStatus = 'active' | 'trial' | 'overdue' | 'cancelled';
export type PlanSegment = 'clinic' | 'doctor' | 'operator';
export type BillingCycle = 'monthly' | 'yearly';
export type PaymentMethod = 'card' | 'pix' | 'manual';
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';
export type DiscountType = 'percent' | 'fixed';

export const SUB_STATUS_LABELS: Record<SubStatus, string> = {
  active: 'Ativo',
  trial: 'Em trial',
  overdue: 'Inadimplente',
  cancelled: 'Cancelado',
};

export const SEGMENT_LABELS: Record<PlanSegment, string> = {
  clinic: 'Clínicas',
  doctor: 'Médicos / Profissionais',
  operator: 'Operadoras',
};

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Cartão',
  pix: 'PIX',
  manual: 'Manual',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  failed: 'Falhou',
  refunded: 'Estornado',
};

export interface PlatformPlan {
  id: string;
  name: string;
  description: string | null;
  segment: PlanSegment;
  billing_cycle: BillingCycle;
  price_cents: number;
  currency: string;
  features: string[];
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
  max_professionals: number | null;
  extra_professional_price_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: string;
}

export interface PlatformSubscription {
  id: string;
  entity_type: PlanSegment;
  entity_id: string;
  plan_id: string | null;
  plan_name: string | null;
  billing_cycle: BillingCycle;
  status: SubStatus;
  payment_method: PaymentMethod;
  amount_cents: number;
  discount_type: DiscountType | null;
  discount_value: number | null;
  coupon_id: string | null;
  final_amount_cents: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  due_date: string | null;
  last_payment_at: string | null;
  last_payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformPayment {
  id: string;
  subscription_id: string;
  amount_cents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string | null;
  due_date: string | null;
  stripe_invoice_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
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
  subscription_source: 'doctor' | 'clinic' | null;
}

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
