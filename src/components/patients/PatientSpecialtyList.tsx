import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText } from 'lucide-react';

interface Props {
  patientId: string;
  /** Marker key inside SPECIALTY_DATA JSON to filter records (e.g. "mealplan", "anthropometry", "soap"). Optional. */
  filterKey?: string;
  emptyLabel: string;
  title?: string;
}

function parseSpecialtyData(notes: string | null): Record<string, any> | null {
  if (!notes) return null;
  const m = notes.match(/<!--SPECIALTY_DATA:(.+?)-->/s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function PatientSpecialtyList({ patientId, filterKey, emptyLabel }: Props) {
  const { data: records = [] } = useQuery({
    queryKey: ['patient-records-specialty', patientId, filterKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinical_records')
        .select('id, created_at, chief_complaint, diagnosis, notes, status')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = filterKey
    ? records.filter((r: any) => {
        const sd = parseSpecialtyData(r.notes);
        return sd && sd[filterKey];
      })
    : records;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((r: any) => {
        const sd = parseSpecialtyData(r.notes);
        const cleanNotes = r.notes?.replace(/<!--SPECIALTY_DATA:.+?-->/s, '').trim();
        return (
          <Card key={r.id} className="p-4 border-border/50">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">
                {r.chief_complaint || r.diagnosis || 'Atendimento'}
              </p>
              <span className="text-xs text-muted-foreground">
                {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {cleanNotes && <p className="text-xs text-muted-foreground line-clamp-2">{cleanNotes}</p>}
            {sd && filterKey && sd[filterKey] && (
              <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(sd[filterKey], null, 2)}
              </pre>
            )}
          </Card>
        );
      })}
    </div>
  );
}