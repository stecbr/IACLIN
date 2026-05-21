import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight list of patients (id + full_name) for the given clinic.
 * Used to populate patient pickers in transaction dialogs.
 */
export function useClinicPatients(clinicId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['clinic-patients-light', clinicId],
    enabled: !!clinicId && (opts?.enabled ?? true),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('clinic_id', clinicId!)
        .order('full_name', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
    staleTime: 60_000,
  });
}