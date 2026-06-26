import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  patientIds: string[];
}

export function PatientPendingBudgetsBanner({ patientIds }: Props) {
  const { data: pending = [] } = useQuery({
    queryKey: ['patient-budgets-pending', patientIds],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_plans')
        .select('id, title, total_cost, status, patient_id, patients(clinic_id, clinics(name, phone))')
        .in('patient_id', patientIds)
        .eq('status', 'awaiting_payment')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (pending.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-2"
    >
      {pending.map((p: any) => {
        const clinicName = p.patients?.clinics?.name ?? 'sua clínica';
        return (
          <div
            key={p.id}
            className="rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/80 dark:bg-orange-950/30 px-4 py-3 flex items-start gap-3"
          >
            <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-orange-700 dark:text-orange-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                Orçamento aprovado · pagamento pendente
              </p>
              <p className="text-sm text-orange-900/90 dark:text-orange-100/90 mt-0.5">
                {p.title} — <span className="font-semibold">R$ {Number(p.total_cost).toFixed(2).replace('.', ',')}</span>
              </p>
              <p className="text-xs text-orange-800/80 dark:text-orange-300/80 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Vá até a recepção de <span className="font-medium">{clinicName}</span> para validar e realizar o pagamento.
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}