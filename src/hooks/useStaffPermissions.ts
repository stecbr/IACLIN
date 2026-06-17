import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { STAFF_PERMISSION_DEFAULTS, type StaffPermissions } from '@/components/settings/StaffPermissionsDialog';

export function useStaffPermissions() {
  const { user, currentClinicId, clinicRole } = useAuth();
  const isStaff = (clinicRole as string) === 'secretary' || (clinicRole as string) === 'auxiliary';

  const { data: permissions = null } = useQuery({
    queryKey: ['staff-permissions', user?.id, currentClinicId],
    enabled: !!user && !!currentClinicId && isStaff,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('clinic_members')
        .select('permissions, role')
        .eq('user_id', user!.id)
        .eq('clinic_id', currentClinicId!)
        .maybeSingle();
      if (!data) return null;
      const stored = (data as any).permissions as StaffPermissions | null;
      if (stored) return stored;
      return STAFF_PERMISSION_DEFAULTS[(data as any).role as string] ?? STAFF_PERMISSION_DEFAULTS.secretary;
    },
  });

  const roleKey = (clinicRole as string) ?? 'secretary';
  const fallback = STAFF_PERMISSION_DEFAULTS[roleKey] ?? STAFF_PERMISSION_DEFAULTS.secretary;

  return {
    isStaff,
    permissions: isStaff ? (permissions ?? fallback) : null,
  };
}
