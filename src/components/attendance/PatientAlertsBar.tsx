import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, HeartPulse, Pill } from 'lucide-react';

interface Props {
  patientId: string;
}

/**
 * Faixa de Anamnese Rápida no topo do atendimento.
 * Mostra alergias, condições crônicas e medicações em uso de forma destacada.
 */
export function PatientAlertsBar({ patientId }: Props) {
  const { data } = useQuery({
    queryKey: ['attendance-alerts', patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('anamneses')
        .select('allergies, medications, medical_conditions')
        .eq('patient_id', patientId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId,
  });

  if (!data) return null;
  const { allergies, medications, medical_conditions } = data;
  if (!allergies && !medications && !medical_conditions) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allergies && (
        <Badge
          variant="outline"
          className="gap-1.5 border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 animate-pulse"
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="font-medium">Alergias:</span> {allergies}
        </Badge>
      )}
      {medical_conditions && (
        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        >
          <HeartPulse className="h-3 w-3" />
          <span className="font-medium">Condições:</span> {medical_conditions}
        </Badge>
      )}
      {medications && (
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
          <Pill className="h-3 w-3" />
          <span className="font-medium">Medicações:</span> {medications}
        </Badge>
      )}
    </div>
  );
}