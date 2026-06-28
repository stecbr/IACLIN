import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceTx {
  id: string;
  amount: number;
  description: string | null;
  notes: string | null;
  due_date: string;
  operator_id: string;
  insurance_invoice_period: string;
  insurance_invoice_status: string | null;
  status: string;
  created_at: string;
  appointment_id: string | null;
  patients: { full_name: string } | null;
  insurance_operators: { name: string } | null;
}

export interface InvoiceGroup {
  key: string;
  operator_id: string;
  operator_name: string;
  period: string;
  status: 'open' | 'invoiced' | 'paid' | 'reconciled';
  total: number;
  count: number;
  items: InvoiceTx[];
}

function normalizeStatus(s: string | null): InvoiceGroup['status'] {
  if (!s) return 'open';
  if (s === 'sent' || s === 'invoiced') return 'invoiced';
  if (s === 'paid') return 'paid';
  if (s === 'reconciled') return 'reconciled';
  return 'open';
}

export function useInsuranceInvoiceGroups(clinicId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ['insurance-invoices', clinicId, userId],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase
        .from('financial_transactions')
        .select('id, amount, description, notes, due_date, operator_id, insurance_invoice_period, insurance_invoice_status, status, created_at, appointment_id, patients(full_name), insurance_operators(name)')
        .not('operator_id', 'is', null)
        .not('insurance_invoice_period', 'is', null)
        .order('insurance_invoice_period', { ascending: false });
      if (clinicId) q = q.eq('clinic_id', clinicId);
      else q = q.eq('dentist_id', userId!);
      const { data, error } = await q;
      if (error) throw error;
      const txs = (data ?? []) as unknown as InvoiceTx[];
      const map = new Map<string, InvoiceGroup>();
      const order: Record<InvoiceGroup['status'], number> = { open: 0, invoiced: 1, paid: 2, reconciled: 3 };
      for (const t of txs) {
        if (!t.operator_id || !t.insurance_invoice_period) continue;
        const key = `${t.operator_id}__${t.insurance_invoice_period}`;
        const st = normalizeStatus(t.insurance_invoice_status);
        const g = map.get(key) ?? {
          key,
          operator_id: t.operator_id,
          operator_name: t.insurance_operators?.name ?? '—',
          period: t.insurance_invoice_period,
          status: st,
          total: 0, count: 0, items: [],
        };
        g.total += Number(t.amount) || 0;
        g.count += 1;
        g.items.push(t);
        if (order[st] < order[g.status]) g.status = st;
        map.set(key, g);
      }
      return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
    },
  });
}

export interface Glosa {
  id: string;
  clinic_id: string;
  operator_id: string;
  insurance_invoice_period: string;
  appointment_id: string | null;
  transaction_id: string | null;
  expected_amount: number;
  received_amount: number;
  glosa_amount: number;
  reason: string | null;
  status: 'identified' | 'accepted' | 'contested' | 'recovered';
  loss_transaction_id: string | null;
  created_at: string;
  insurance_operators?: { name: string } | null;
}

export function useInsuranceGlosas(clinicId: string | null) {
  return useQuery({
    queryKey: ['insurance-glosas', clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_glosas')
        .select('*, insurance_operators(name)')
        .eq('clinic_id', clinicId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Glosa[];
    },
  });
}

export function useUpdateGlosaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Glosa['status'] }) => {
      const { error } = await supabase
        .from('insurance_glosas')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-glosas'] });
    },
  });
}

export interface GlosaInput {
  appointment_id?: string | null;
  transaction_id?: string | null;
  glosa_amount: number;
  reason?: string | null;
  status: 'identified' | 'accepted' | 'contested';
}

export function useReconcileInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      clinic_id: string;
      operator_id: string;
      period: string;
      received_amount: number;
      payment_method?: string | null;
      notes?: string | null;
      glosas: GlosaInput[];
      create_loss_transaction?: boolean;
    }) => {
      const { data, error } = await (supabase.rpc as any)('reconcile_insurance_invoice', {
        _clinic_id: args.clinic_id,
        _operator_id: args.operator_id,
        _period: args.period,
        _received_amount: args.received_amount,
        _payment_method: args.payment_method ?? null,
        _notes: args.notes ?? null,
        _glosas: args.glosas as any,
        _create_loss_transaction: args.create_loss_transaction ?? true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-invoices'] });
      qc.invalidateQueries({ queryKey: ['insurance-glosas'] });
      qc.invalidateQueries({ queryKey: ['financial-transactions'] });
    },
  });
}

export function useMarkInvoiced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ insurance_invoice_status: 'invoiced' })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-invoices'] });
    },
  });
}
