import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  STAFF_PERMISSION_DEFAULTS,
  normalizeStaffPermissions,
  type StaffPermissions,
} from '@/components/settings/StaffPermissionsDialog';

export function useStaffPermissions() {
  const { user, currentClinicId, clinicRole, isMembershipSuspended } = useAuth();
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
      return normalizeStaffPermissions((data as any).permissions, (data as any).role);
    },
  });

  const roleKey = (clinicRole as string) ?? 'secretary';
  const fallback = STAFF_PERMISSION_DEFAULTS[roleKey] ?? STAFF_PERMISSION_DEFAULTS.secretary;

  if (isStaff && isMembershipSuspended) {
    const allFalse = Object.keys(fallback).reduce(
      (acc, k) => ({ ...acc, [k]: false }),
      {} as StaffPermissions,
    );
    return { isStaff, permissions: allFalse };
  }

  return {
    isStaff,
    permissions: isStaff ? (permissions ?? fallback) : null,
  };
}
