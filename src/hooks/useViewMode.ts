import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getViewMode, setViewMode as persistViewMode, VIEW_MODE_EVENT, type ViewMode } from '@/lib/viewMode';

export interface UseViewModeResult {
  /** Current effective mode (defaults to 'manager' for admins/owners, 'consult' for dentists). */
  viewMode: ViewMode;
  /** True when the toggle should be shown — owner has both manager and consult sides. */
  canSwitch: boolean;
  /** True when the owner already has specialty + registration filled in on this clinic. */
  hasProfessionalProfile: boolean;
  setViewMode: (mode: ViewMode) => void;
  toggle: () => void;
  /** Refetch the professional profile (call after saving in the dialog). */
  refreshProfile: () => void;
}

export function useViewMode(): UseViewModeResult {
  const { user, currentClinicId, clinicRole, isClinicOwner } = useAuth();
  const normalizedRole = (clinicRole as string) === 'owner' ? 'admin' : clinicRole;

  // An owner / admin can switch into "consult" view. A dentist with owner flag
  // can switch back into "manager" view of their own clinic.
  const canSwitch =
    !!user?.id &&
    !!currentClinicId &&
    (normalizedRole === 'admin' || (normalizedRole === 'dentist' && isClinicOwner));

  const defaultMode: ViewMode = normalizedRole === 'dentist' ? 'consult' : 'manager';

  const [stored, setStored] = useState<ViewMode | null>(() =>
    getViewMode(user?.id, currentClinicId)
  );

  useEffect(() => {
    setStored(getViewMode(user?.id, currentClinicId));
  }, [user?.id, currentClinicId]);

  useEffect(() => {
    const onChange = () => setStored(getViewMode(user?.id, currentClinicId));
    window.addEventListener(VIEW_MODE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(VIEW_MODE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [user?.id, currentClinicId]);

  const { data: profileRow, refetch } = useQuery({
    queryKey: ['view-mode-member-profile', user?.id, currentClinicId],
    enabled: !!user?.id && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty, registration_number')
        .eq('user_id', user!.id)
        .eq('clinic_id', currentClinicId!)
        .maybeSingle();
      return data ?? null;
    },
  });

  const hasProfessionalProfile =
    !!profileRow?.specialty && !!String(profileRow?.registration_number ?? '').trim();

  const viewMode: ViewMode = stored ?? defaultMode;

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      if (!user?.id || !currentClinicId) return;
      persistViewMode(user.id, currentClinicId, mode);
      setStored(mode);
    },
    [user?.id, currentClinicId]
  );

  const toggle = useCallback(() => {
    setViewMode(viewMode === 'manager' ? 'consult' : 'manager');
  }, [viewMode, setViewMode]);

  return {
    viewMode,
    canSwitch,
    hasProfessionalProfile,
    setViewMode,
    toggle,
    refreshProfile: () => {
      refetch();
    },
  };
}