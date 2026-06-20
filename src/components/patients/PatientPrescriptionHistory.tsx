import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pill } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MedEntry {
  date: string;
  medications: string[];
  doctor?: string | null;
}

export function PatientPrescriptionHistory({ patientId }: { patientId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['patient-rx-history', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinical_records')
        .select('created_at, dentist_id, clinical_record_requests(kind, payload), profiles!clinical_records_dentist_id_fkey(full_name)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;

      const result: MedEntry[] = [];
      for (const r of (data ?? []) as any[]) {
        const reqs: any[] = r.clinical_record_requests ?? [];
        const meds: string[] = [];

        for (const req of reqs) {
          if (req.kind === 'prescription') {
            const items: any[] = Array.isArray(req.payload) ? req.payload : [];
            for (const it of items) {
              const med = [it.medication, it.concentration].filter(Boolean).join(' ');
              if (med) meds.push(med);
            }
          } else if (req.kind === 'doc_prescription') {
            const items: any[] = req.payload?.items ?? [];
            for (const it of items) {
              if (it.medication) meds.push(it.medication);
            }
          }
        }

        if (meds.length > 0) {
          result.push({
            date: r.created_at,
            medications: [...new Set(meds)],
            doctor: r.profiles?.full_name ?? null,
          });
        }
      }
      return result;
    },
    enabled: !!patientId,
  });

  if (isLoading || entries.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t border-border/50">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Pill className="h-3.5 w-3.5" />
        Histórico de Medicações Prescritas
      </p>
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-[72px] shrink-0">
              {format(parseISO(e.date), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {e.medications.map((m, j) => (
                <Badge key={j} variant="secondary" className="text-xs font-normal">
                  {m}
                </Badge>
              ))}
              {e.doctor && (
                <span className="text-xs text-muted-foreground">· Dr(a). {e.doctor}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
