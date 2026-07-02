import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from './useRoleAccess';
import { supabase } from '@/integrations/supabase/client';
import { getSpecialtyFamily, type SpecialtyFamily } from '@/lib/specialtyFamily';

const ROLE_BASE_LABEL: Record<string, string> = {
  admin:     'IACLINADMIN',
  secretary: 'Secretário(a)',
  auxiliary: 'Auxiliar Adm',
  owner:     'IACLINADMIN',
  operator:  'Operadora',
  patient:   'Paciente',
};

const DENTIST_FAMILY_LABEL: Record<string, string> = {
  odonto:    'IACLINDENTAL',
  psi:       'Psicólogo(a)',
  aesthetic: 'Esteticista',
  nutrition: 'Nutricionista',
  physio:    'Fisioterapeuta',
  podology:  'Podólogo(a)',
  medical:   'IACLINMEDICO',
  generic:   'IACLINMEDICO',
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

  const meta = (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
  const userType = meta.user_type as string | undefined;
  const isProfessionalSignup = typeof userType === 'string' && userType.startsWith('profissional');

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
    enabled: !!user?.id && !!currentClinicId && (isDentist || isProfessionalSignup),
  });

  if (isDentist || isProfessionalSignup) {
    const metaSpecialty = meta.specialty as string | undefined;
    const specialty = memberSpecialty ?? metaSpecialty ?? null;
    // Fallback seguro: quando a especialidade ainda não está salva, só assume
    // 'odonto' se a categoria da clínica ativa confirmar; caso contrário usa
    // 'generic' (IACLINMEDICO) para não vazar contexto odontológico para
    // médicos, fisios, podólogos, etc.
    const family: SpecialtyFamily = specialty
      ? getSpecialtyFamily(specialty)
      : (clinicCategory === 'odonto' ? 'odonto' : 'generic');
    return {
      label: DENTIST_FAMILY_LABEL[family] ?? 'IACLINMEDICO',
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
