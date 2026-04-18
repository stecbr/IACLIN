import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, FileText, Clock, Stethoscope } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'appointment' | 'document' | 'record';
  title: string;
  description: string;
  date: string;
  icon: typeof Calendar;
  color: string;
}

interface Props {
  patientIds: string[];
  limit?: number;
  compact?: boolean;
}

export function PatientTimelineMulti({ patientIds, limit, compact = false }: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['patient-timeline-multi', patientIds.sort().join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const [aptRes, docRes, recRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, start_time, status, notes, procedures(name)')
          .in('patient_id', patientIds)
          .order('start_time', { ascending: false })
          .limit(50),
        supabase
          .from('documents')
          .select('id, created_at, name, category')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('clinical_records')
          .select('id, created_at, diagnosis, notes, status')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const timeline: TimelineEvent[] = [];

      (aptRes.data ?? []).forEach((a: any) => {
        timeline.push({
          id: `apt-${a.id}`,
          type: 'appointment',
          title: a.procedures?.name ?? 'Consulta',
          description: a.notes ?? `Status: ${a.status}`,
          date: a.start_time,
          icon: Calendar,
          color: 'text-blue-500 bg-blue-500/10',
        });
      });

      (docRes.data ?? []).forEach((d: any) => {
        timeline.push({
          id: `doc-${d.id}`,
          type: 'document',
          title: d.name,
          description: d.category ?? 'Documento',
          date: d.created_at,
          icon: FileText,
          color: 'text-violet-500 bg-violet-500/10',
        });
      });

      (recRes.data ?? []).forEach((r: any) => {
        timeline.push({
          id: `rec-${r.id}`,
          type: 'record',
          title: r.diagnosis ?? 'Atendimento clínico',
          description: r.notes ?? `Status: ${r.status}`,
          date: r.created_at,
          icon: Stethoscope,
          color: 'text-emerald-500 bg-emerald-500/10',
        });
      });

      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return limit ? timeline.slice(0, limit) : timeline;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-border bg-muted/20">
        <Clock className="h-7 w-7 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8">
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

      <div className={compact ? 'space-y-0' : 'space-y-1'}>
        {events.map((event, i) => (
          <div
            key={event.id}
            className="relative flex gap-4 py-2.5 group animate-fade-in"
            style={{ animationDelay: `${Math.min(i * 50, 500)}ms`, animationFillMode: 'backwards' }}
          >
            <div
              className={`absolute -left-4.5 top-3.5 h-7 w-7 rounded-full flex items-center justify-center ${event.color} ring-4 ring-background z-10`}
            >
              <event.icon className="h-3.5 w-3.5" />
            </div>

            <div className="flex-1 ml-4 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors group-hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                </div>
                <time className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                  {format(new Date(event.date), 'dd MMM yyyy', { locale: ptBR })}
                </time>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
