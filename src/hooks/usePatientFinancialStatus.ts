import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PatientFinancialStatus {
  paid: number;
  pending: number;
  overdue: number;
  total: number;
  status: 'up_to_date' | 'pending' | 'overdue';
  pendingCount: number;
  overdueCount: number;
}

function summarize(rows: any[]): PatientFinancialStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let paid = 0, pending = 0, overdue = 0, pendingCount = 0, overdueCount = 0;
  for (const r of rows) {
    if (r.type !== 'income') continue;
    const amount = Number(r.amount) || 0;
    if (r.status === 'paid') {
      paid += amount;
    } else if (r.status === 'pending' || r.status === 'overdue') {
      const due = r.due_date ? new Date(r.due_date + 'T00:00:00') : null;
      if (r.status === 'overdue' || (due && due < today)) {
        overdue += amount;
        overdueCount++;
      } else {
        pending += amount;
        pendingCount++;
      }
    }
  }
  const status: PatientFinancialStatus['status'] =
    overdue > 0 ? 'overdue' : pending > 0 ? 'pending' : 'up_to_date';
  return { paid, pending, overdue, total: paid + pending + overdue, status, pendingCount, overdueCount };
}

export function usePatientFinancialStatus(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patient-financial-status', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('amount, status, type, due_date')
        .eq('patient_id', patientId!);
      if (error) throw error;
      return summarize(data ?? []);
    },
  });
}

export function usePatientsFinancialStatusBulk(patientIds: string[]) {
  return useQuery({
    queryKey: ['patients-financial-status-bulk', [...patientIds].sort().join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('patient_id, amount, status, type, due_date')
        .in('patient_id', patientIds);
      if (error) throw error;
      const map = new Map<string, PatientFinancialStatus>();
      const byPatient = new Map<string, any[]>();
      for (const row of data ?? []) {
        if (!row.patient_id) continue;
        const list = byPatient.get(row.patient_id) ?? [];
        list.push(row);
        byPatient.set(row.patient_id, list);
      }
      for (const id of patientIds) {
        map.set(id, summarize(byPatient.get(id) ?? []));
      }
      return map;
    },
  });
}