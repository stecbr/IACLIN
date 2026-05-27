/**
 * Busca dados da plataforma para o Super Admin via RPC functions
 * com SECURITY DEFINER — contornam o RLS completamente.
 *
 * Requer que a migration `20260527220000_superadmin_rpc.sql` tenha sido
 * executada no Supabase Dashboard → SQL Editor.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PlatformStats, PlatformClinic, PlatformDoctor } from '@/types/superadmin';

// ── Stats agregadas ──────────────────────────────────────────
async function fetchStats(): Promise<PlatformStats> {
  const { data, error } = await (supabase as any).rpc('admin_get_stats');
  if (error) {
    console.error('[SuperAdmin] admin_get_stats error:', error.message, error.code);
    throw error;
  }
  const s = (data ?? {}) as Record<string, number>;
  return {
    total_clinics:  s.total_clinics  ?? 0,
    total_doctors:  s.total_doctors  ?? 0,
    total_patients: s.total_patients ?? 0,
    active_subs:    0,
    trial_subs:     0,
    overdue_subs:   0,
  };
}

// ── Lista de clínicas ────────────────────────────────────────
async function fetchClinics(): Promise<PlatformClinic[]> {
  const { data, error } = await (supabase as any).rpc('admin_get_clinics');
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
    subscription: null,
  }));
}

// ── Lista de médicos / profissionais ─────────────────────────
async function fetchDoctors(): Promise<PlatformDoctor[]> {
  const { data, error } = await (supabase as any).rpc('admin_get_doctors');
  if (error) {
    console.error('[SuperAdmin] admin_get_doctors error:', error.message, error.code);
    throw error;
  }
  const doctors: any[] = Array.isArray(data) ? data : [];
  return doctors.map((m: any) => ({
    user_id:      m.user_id,
    full_name:    m.full_name    ?? null,
    specialty:    m.specialty   ?? null,
    registration: m.registration_number ?? null,
    role:         m.role,
    is_owner:     m.is_owner,
    clinic_id:    m.clinic_id   ?? null,
    clinic_name:  m.clinic_name ?? null,
    created_at:   m.created_at,
    subscription: null,
  }));
}

// ── Export unificado ─────────────────────────────────────────
export async function fetchAdminData<T>(type: 'stats' | 'clinics' | 'doctors'): Promise<T> {
  if (type === 'stats')   return fetchStats()   as Promise<T>;
  if (type === 'clinics') return fetchClinics() as Promise<T>;
  if (type === 'doctors') return fetchDoctors() as Promise<T>;
  throw new Error(`Unknown type: ${type}`);
}
