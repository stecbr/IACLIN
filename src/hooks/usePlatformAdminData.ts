/**
 * Busca dados da plataforma para o Super Admin via RPC functions
 * com SECURITY DEFINER — contornam o RLS completamente.
 *
 * Requer que a migration `20260527220000_superadmin_rpc.sql` tenha sido
 * executada no Supabase Dashboard → SQL Editor.
 */
import { supabase } from '@/integrations/supabase/client';
import type {
  PlatformStats, PlatformClinic, PlatformDoctor,
  PlatformPlan, PlatformCoupon, PlatformSubscription, PlatformPayment,
} from '@/types/superadmin';

// ── Subscriptions map (uma chamada para todos) ───────────────
async function fetchAllSubscriptions(): Promise<Map<string, PlatformSubscription>> {
  const { data, error } = await (supabase as any)
    .from('platform_subscriptions')
    .select('*');
  if (error) {
    console.error('[SuperAdmin] subs error:', error.message);
    return new Map();
  }
  const map = new Map<string, PlatformSubscription>();
  for (const s of (data ?? [])) {
    map.set(`${s.entity_type}:${s.entity_id}`, s as PlatformSubscription);
  }
  return map;
}

// ── Stats agregadas ──────────────────────────────────────────
async function fetchStats(): Promise<PlatformStats> {
  const [{ data: stats, error }, subsRes] = await Promise.all([
    (supabase as any).rpc('admin_get_stats'),
    (supabase as any).from('platform_subscriptions').select('status'),
  ]);
  if (error) {
    console.error('[SuperAdmin] admin_get_stats error:', error.message, error.code);
    throw error;
  }
  const s = (stats ?? {}) as Record<string, number>;
  const subs = (subsRes?.data ?? []) as Array<{ status: string }>;
  return {
    total_clinics:  s.total_clinics  ?? 0,
    total_doctors:  s.total_doctors  ?? 0,
    total_patients: s.total_patients ?? 0,
    active_subs:    subs.filter(x => x.status === 'active').length,
    trial_subs:     subs.filter(x => x.status === 'trial').length,
    overdue_subs:   subs.filter(x => x.status === 'overdue').length,
  };
}

// ── Lista de clínicas ────────────────────────────────────────
async function fetchClinics(): Promise<PlatformClinic[]> {
  const [{ data, error }, subsMap] = await Promise.all([
    (supabase as any).rpc('admin_get_clinics'),
    fetchAllSubscriptions(),
  ]);
  if (error) {
    console.error('[SuperAdmin] admin_get_clinics error:', error.message, error.code);
    throw error;
  }
  const clinics: any[] = Array.isArray(data) ? data : [];
  return clinics.map((c: any) => ({
    id:           c.id,
    name:         c.name,
    category:     c.category,
    city:         c.city,
    state:        c.state,
    email:        c.email,
    phone:        c.phone,
    created_at:   c.created_at,
    member_count: c.member_count ?? 0,
    subscription: subsMap.get(`clinic:${c.id}`) ?? null,
  }));
}

// ── Lista de médicos / profissionais ─────────────────────────
async function fetchDoctors(): Promise<PlatformDoctor[]> {
  const [{ data, error }, subsMap] = await Promise.all([
    (supabase as any).rpc('admin_get_doctors'),
    fetchAllSubscriptions(),
  ]);
  if (error) {
    console.error('[SuperAdmin] admin_get_doctors error:', error.message, error.code);
    throw error;
  }
  const doctors: any[] = Array.isArray(data) ? data : [];
  return doctors.map((m: any) => {
    const doctorSub = subsMap.get(`doctor:${m.user_id}`) ?? null;
    const clinicSub = m.clinic_id ? (subsMap.get(`clinic:${m.clinic_id}`) ?? null) : null;
    const subscription = doctorSub ?? clinicSub;
    const subscription_source = doctorSub ? 'doctor' : clinicSub ? 'clinic' : null;
    return {
      user_id:      m.user_id,
      full_name:    m.full_name    ?? null,
      specialty:    m.specialty   ?? null,
      registration: m.registration_number ?? null,
      role:         m.role,
      is_owner:     m.is_owner,
      clinic_id:    m.clinic_id   ?? null,
      clinic_name:  m.clinic_name ?? null,
      created_at:   m.created_at,
      subscription,
      subscription_source,
    };
  });
}

// ── Plans ───────────────────────────────────────────────────
async function fetchPlans(): Promise<PlatformPlan[]> {
  const { data, error } = await (supabase as any)
    .from('platform_plans')
    .select('*')
    .order('segment')
    .order('sort_order')
    .order('price_cents');
  if (error) throw error;
  return (data ?? []) as PlatformPlan[];
}

// ── Coupons ─────────────────────────────────────────────────
async function fetchCoupons(): Promise<PlatformCoupon[]> {
  const { data, error } = await (supabase as any)
    .from('platform_coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlatformCoupon[];
}

// ── Payments (todos) ────────────────────────────────────────
async function fetchPayments(): Promise<PlatformPayment[]> {
  const { data, error } = await (supabase as any)
    .from('platform_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as PlatformPayment[];
}

// ── Export unificado ─────────────────────────────────────────
export async function fetchAdminData<T>(
  type: 'stats' | 'clinics' | 'doctors' | 'plans' | 'coupons' | 'payments'
): Promise<T> {
  if (type === 'stats')    return fetchStats()    as Promise<T>;
  if (type === 'clinics')  return fetchClinics()  as Promise<T>;
  if (type === 'doctors')  return fetchDoctors()  as Promise<T>;
  if (type === 'plans')    return fetchPlans()    as Promise<T>;
  if (type === 'coupons')  return fetchCoupons()  as Promise<T>;
  if (type === 'payments') return fetchPayments() as Promise<T>;
  throw new Error(`Unknown type: ${type}`);
}
