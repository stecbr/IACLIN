import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Detects "solo practitioner" mode: the user is the owner of their clinic
 * AND the only member. Used to adapt UI copy and show the solo banner.
 */
export function useSoloMode() {
  const { isClinicOwner, currentClinicId, clinics } = useAuth();

  const { data: memberCount = 0 } = useQuery({
    queryKey: ['solo-mode-member-count', currentClinicId],
    enabled: !!currentClinicId && isClinicOwner,
    queryFn: async () => {
      const { count } = await supabase
        .from('clinic_members')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId!);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const isSolo =
    isClinicOwner && clinics.length === 1 && memberCount === 1;

  return { isSolo, memberCount };
}
