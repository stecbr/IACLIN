import { supabase } from '@/integrations/supabase/client';

export async function fetchClinicForDocs(clinicId: string | null) {
  if (!clinicId) return null;
  const { data } = await supabase
    .from('clinics')
    .select('name, phone, email, address, city, state, cnpj, logo_url')
    .eq('id', clinicId)
    .maybeSingle();
  return data;
}

export async function fetchDentistForDocs(userId: string, clinicId: string | null) {
  const [{ data: profile }, memberRes] = await Promise.all([
    supabase.from('profiles').select('full_name, signature_url').eq('id', userId).maybeSingle(),
    clinicId
      ? supabase
          .from('clinic_members')
          .select('specialty, registration_number')
          .eq('user_id', userId)
          .eq('clinic_id', clinicId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    full_name: profile?.full_name ?? 'Profissional',
    signature_url: profile?.signature_url ?? null,
    specialty: (memberRes.data as any)?.specialty ?? null,
    registration_number: (memberRes.data as any)?.registration_number ?? null,
  };
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Default to BR country code if no country prefix
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}