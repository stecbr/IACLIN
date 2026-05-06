import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getSpecialtyProfile, type SpecialtyProfile } from '@/lib/specialtyProfile';

/**
 * Resolves the active professional's specialty profile based on
 * `clinic_members.specialty` for the current clinic.
 * Falls back to the 'generic' profile while loading or when missing.
 */
export function useSpecialtyProfile(): { profile: SpecialtyProfile; isLoading: boolean; specialty: string | null } {
  const { user, currentClinicId } = useAuth();

  const { data: specialty = null, isLoading } = useQuery({
    queryKey: ['active-specialty', user?.id, currentClinicId],
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
    enabled: !!user?.id && !!currentClinicId,
  });

  return { profile: getSpecialtyProfile(specialty), isLoading, specialty };
}