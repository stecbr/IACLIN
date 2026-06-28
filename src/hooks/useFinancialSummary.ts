import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MonthlySummary {
  month: string;
  revenue_particular: number;
  revenue_insurance_received: number;
  revenue_insurance_invoiced: number;
  card_fees: number;
  glosas_accepted: number;
  commissions_paid: number;
  commissions_pending: number;
  operational_expenses: number;
  operational_pending: number;
  net_result: number;
}

export interface FinancialSummary {
  period: { start: string; end: string };
  monthly: MonthlySummary[];
  totals: Omit<MonthlySummary, 'month'>;
}

interface Params {
  clinicId: string | null | undefined;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  dentistId?: string | null;
  enabled?: boolean;
}

function toNum(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '0');
  return Number.isFinite(n) ? n : 0;
}

function normalizeMonthly(row: any): MonthlySummary {
  return {
    month: String(row?.month ?? ''),
    revenue_particular: toNum(row?.revenue_particular),
    revenue_insurance_received: toNum(row?.revenue_insurance_received),
    revenue_insurance_invoiced: toNum(row?.revenue_insurance_invoiced),
    card_fees: toNum(row?.card_fees),
    glosas_accepted: toNum(row?.glosas_accepted),
    commissions_paid: toNum(row?.commissions_paid),
    commissions_pending: toNum(row?.commissions_pending),
    operational_expenses: toNum(row?.operational_expenses),
    operational_pending: toNum(row?.operational_pending),
    net_result: toNum(row?.net_result),
  };
}

export function useFinancialSummary({
  clinicId, startDate, endDate, dentistId, enabled = true,
}: Params) {
  return useQuery({
    queryKey: ['financial-summary', clinicId, startDate, endDate, dentistId ?? null],
    enabled: !!clinicId && enabled,
    queryFn: async (): Promise<FinancialSummary> => {
      const { data, error } = await (supabase.rpc as any)('get_clinic_financial_summary', {
        _clinic_id: clinicId,
        _start: startDate,
        _end: endDate,
        _dentist_id: dentistId ?? null,
      });
      if (error) throw error;
      const raw: any = data ?? {};
      const monthly = Array.isArray(raw.monthly) ? raw.monthly.map(normalizeMonthly) : [];
      const t = raw.totals ?? {};
      const totals = normalizeMonthly({ month: '', ...t });
      const { month: _ignored, ...totalsNoMonth } = totals;
      return {
        period: raw.period ?? { start: startDate, end: endDate },
        monthly,
        totals: totalsNoMonth,
      };
    },
  });
}