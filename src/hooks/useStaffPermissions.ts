import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const { data: permissions = null } = useQuery({
    queryKey: ['staff-permissions', user?.id, currentClinicId],
    enabled: !!user && !!currentClinicId && isStaff,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: 10000,
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

  // Realtime: refresh perms instantly when the admin updates this member's row.
  const setupRef = useRef<{ key: string; channel: any } | null>(null);
  useEffect(() => {
    if (!isStaff || !user?.id || !currentClinicId) return;
    const key = `${user.id}:${currentClinicId}`;
    if (setupRef.current?.key === key) return;

    let cancelled = false;
    let channel: any = null;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled || !data.session) return;

        channel = supabase
          .channel(`clinic_member_perms_${user.id}_${currentClinicId}_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'clinic_members',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              queryClient.invalidateQueries({
                queryKey: ['staff-permissions', user.id, currentClinicId],
              });
            },
          )
          .subscribe();

        if (cancelled) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
          return;
        }
        setupRef.current = { key, channel };
      } catch (err) {
        console.warn('[useStaffPermissions] realtime indisponível, usando polling', err);
      }
    })();

    return () => {
      cancelled = true;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      if (setupRef.current?.channel === channel) {
        setupRef.current = null;
      }
    };
  }, [isStaff, user?.id, currentClinicId, queryClient]);

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
