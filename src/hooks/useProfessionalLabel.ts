import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from './useRoleAccess';
import { supabase } from '@/integrations/supabase/client';
import { getSpecialtyFamily, type SpecialtyFamily } from '@/lib/specialtyFamily';

const ROLE_BASE_LABEL: Record<string, string> = {
  admin:     'Admin',
  secretary: 'Secretária',
  owner:     'Admin',
  operator:  'Operadora',
  patient:   'Paciente',
};

const DENTIST_FAMILY_LABEL: Record<string, string> = {
  odonto:    'Dentista',
  psi:       'Psicólogo(a)',
  aesthetic: 'Esteticista',
  nutrition: 'Nutricionista',
  physio:    'Fisioterapeuta',
  podology:  'Podólogo(a)',
  medical:   'Médico',
  generic:   'Médico',
};

export interface ProfessionalLabelResult {
  label: string;
  family: SpecialtyFamily | null;
  roleKey: string;
  isOdonto: boolean;
}

export function useProfessionalLabel(): ProfessionalLabelResult {
  const { user, currentClinicId, clinicRole, clinicCategory } = useAuth();
  const { effectiveRole } = useRoleAccess();

  const roleKey = clinicRole ?? effectiveRole ?? '';
  const isDentist = effectiveRole === 'dentist';

  // Same queryKey as AppSidebar — React Query deduplicates the network request
  const { data: memberSpecialty = null } = useQuery({
    queryKey: ['member-specialty', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user?.id || !currentClinicId) return null;
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      return data?.specialty ?? null;
    },
    enabled: !!user?.id && !!currentClinicId && isDentist,
  });

  if (isDentist) {
    const family: SpecialtyFamily = memberSpecialty
      ? getSpecialtyFamily(memberSpecialty)
      : (clinicCategory === 'medico' ? 'generic' : 'odonto');
    return {
      label: DENTIST_FAMILY_LABEL[family] ?? 'Médico',
      family,
      roleKey,
      isOdonto: family === 'odonto',
    };
  }

  return {
    label: ROLE_BASE_LABEL[roleKey] ?? roleKey,
    family: null,
    roleKey,
    isOdonto: false,
  };
}
