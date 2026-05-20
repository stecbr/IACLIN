import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export interface PatientPersonalization {
  patient_id: string;
  color: string | null;
  tag: string | null;
  is_favorite: boolean;
}

const EMPTY: PatientPersonalization = {
  patient_id: '',
  color: null,
  tag: null,
  is_favorite: false,
};

export function usePatientPersonalizations(patientIds: string[]) {
  const { user } = useAuth();
  const ids = useMemo(() => Array.from(new Set(patientIds)).sort(), [patientIds]);

  const query = useQuery({
    queryKey: ['patient-personalizations', user?.id, ids],
    enabled: !!user && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_personalizations')
        .select('patient_id, color, tag, is_favorite')
        .eq('user_id', user!.id)
        .in('patient_id', ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, PatientPersonalization>();
    (query.data ?? []).forEach((r: any) => m.set(r.patient_id, r));
    return m;
  }, [query.data]);

  return { map, isLoading: query.isLoading };
}

export function usePatientPersonalization(patientId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['patient-personalization', user?.id, patientId],
    enabled: !!user && !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_personalizations')
        .select('patient_id, color, tag, is_favorite')
        .eq('user_id', user!.id)
        .eq('patient_id', patientId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PatientPersonalization | null) ?? { ...EMPTY, patient_id: patientId! };
    },
  });

  const mutate = useMutation({
    mutationFn: async (patch: Partial<Pick<PatientPersonalization, 'color' | 'tag' | 'is_favorite'>>) => {
      if (!user || !patientId) throw new Error('not ready');
      const current = query.data ?? { ...EMPTY, patient_id: patientId };
      const next = {
        user_id: user.id,
        patient_id: patientId,
        color: patch.color !== undefined ? patch.color : current.color,
        tag: patch.tag !== undefined ? patch.tag : current.tag,
        is_favorite: patch.is_favorite !== undefined ? patch.is_favorite : current.is_favorite,
      };
      const { error } = await supabase
        .from('patient_personalizations')
        .upsert(next, { onConflict: 'user_id,patient_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-personalization', user?.id, patientId] });
      qc.invalidateQueries({ queryKey: ['patient-personalizations'] });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      if (!user || !patientId) return;
      await supabase
        .from('patient_personalizations')
        .delete()
        .eq('user_id', user.id)
        .eq('patient_id', patientId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-personalization', user?.id, patientId] });
      qc.invalidateQueries({ queryKey: ['patient-personalizations'] });
    },
  });

  return {
    data: query.data ?? { ...EMPTY, patient_id: patientId ?? '' },
    isLoading: query.isLoading,
    update: mutate.mutate,
    clear: clear.mutate,
    isSaving: mutate.isPending || clear.isPending,
  };
}

export const PERSONALIZATION_COLORS: { label: string; value: string }[] = [
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Violeta', value: '#8B5CF6' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Âmbar', value: '#F59E0B' },
  { label: 'Vermelho', value: '#EF4444' },
];