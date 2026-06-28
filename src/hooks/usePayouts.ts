import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingByDentistRow {
  dentist_id: string;
  full_name: string | null;
  count: number;
  total: number;
  oldest_date: string | null;
}

/**
 * Aggregates open (pending, not yet bundled into a payout) commissions
 * per dentist for the given clinic.
 */
export function usePendingByDentist(clinicId: string | null | undefined) {
  return useQuery({
    queryKey: ['payouts-open', clinicId],
    enabled: !!clinicId,
    queryFn: async (): Promise<PendingByDentistRow[]> => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, amount, due_date, created_at, dentist_id')
        .eq('clinic_id', clinicId!)
        .eq('type', 'expense')
        .eq('category', 'commission')
        .eq('status', 'pending')
        .is('payout_id', null);
      if (error) throw error;

      const map = new Map<string, PendingByDentistRow>();
      const ids = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (!r.dentist_id) return;
        ids.add(r.dentist_id);
        const cur = map.get(r.dentist_id) ?? {
          dentist_id: r.dentist_id,
          full_name: null,
          count: 0,
          total: 0,
          oldest_date: null,
        };
        cur.count += 1;
        cur.total += Number(r.amount) || 0;
        const dt = r.due_date ?? r.created_at?.slice(0, 10) ?? null;
        if (dt && (!cur.oldest_date || dt < cur.oldest_date)) cur.oldest_date = dt;
        map.set(r.dentist_id, cur);
      });

      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(ids));
        (profs ?? []).forEach((p: any) => {
          const row = map.get(p.id);
          if (row) row.full_name = p.full_name;
        });
      }

      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
  });
}

export function usePayoutHistory(clinicId: string | null | undefined) {
  return useQuery({
    queryKey: ['payout-history', clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('commission_payouts')
        .select('*')
        .eq('clinic_id', clinicId!)
        .order('paid_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.dentist_id).filter(Boolean)));
      let nameById: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids);
        (profs ?? []).forEach((p: any) => { nameById[p.id] = p.full_name ?? '—'; });
      }
      return rows.map((r) => ({ ...r, dentist_name: nameById[r.dentist_id] ?? '—' }));
    },
  });
}

/**
 * History of payouts for the current professional, within one clinic.
 */
export function useMyPayouts(clinicId: string | null | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-payouts', clinicId, userId],
    enabled: !!clinicId && !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('commission_payouts')
        .select('*')
        .eq('clinic_id', clinicId!)
        .eq('dentist_id', userId!)
        .order('paid_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}