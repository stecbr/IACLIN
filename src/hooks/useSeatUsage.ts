import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SeatUsage {
  used: number;
  limit: number | null;
  unlimited: boolean;
  available: number;
  has_subscription: boolean;
  status: string | null;
  plan_name: string | null;
}

/**
 * Retorna o uso de "assentos" de profissional (dentista/médico) da clínica,
 * comparando com o limite definido no plano contratado.
 * Quando o plano não define limite (`max_professionals = NULL`), `unlimited = true`.
 */
export function useSeatUsage(clinicId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['clinic-seat-usage', clinicId],
    enabled: !!clinicId,
    staleTime: 30_000,
    queryFn: async (): Promise<SeatUsage> => {
      const { data, error } = await supabase.rpc('get_clinic_seat_usage', {
        _clinic_id: clinicId as string,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<SeatUsage>;
      return {
        used: Number(d.used ?? 0),
        limit: d.limit ?? null,
        unlimited: Boolean(d.unlimited),
        available: Number(d.available ?? 0),
        has_subscription: Boolean(d.has_subscription),
        status: (d.status as string | null) ?? null,
        plan_name: (d.plan_name as string | null) ?? null,
      };
    },
  });

  return {
    usage: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
    isAtLimit: !!query.data && !query.data.unlimited && query.data.available <= 0,
  };
}