import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { PatientTimelineMulti } from '@/components/patient/PatientTimelineMulti';

export default function PatientHistory() {
  const { user } = useAuth();

  const { data: patientIds = [], isLoading } = useQuery({
    queryKey: ['patient-ids', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('patients')
        .select('id')
        .eq('patient_user_id', user!.id);
      return (data ?? []).map((p) => p.id);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Histórico clínico</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Linha do tempo das suas consultas, atendimentos e documentos.
            </p>
          </div>
        </div>
      </motion.div>

      <Card>
        <CardContent className="p-5">
          {patientIds.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Você ainda não tem prontuário em nenhuma clínica.
            </div>
          ) : (
            <PatientTimelineMulti patientIds={patientIds} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
