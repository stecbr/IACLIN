import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, FileText, Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'appointment' | 'financial' | 'document';
  title: string;
  description: string;
  date: string;
  icon: typeof Calendar;
  color: string;
  status?: string;
}

export function PatientTimeline({ patientId }: { patientId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const [aptRes, txRes, docRes] = await Promise.all([
        supabase.from('appointments').select('id, start_time, status, notes, procedures(name)').eq('patient_id', patientId).order('start_time', { ascending: false }).limit(50),
        supabase.from('financial_transactions').select('id, due_date, description, category, amount, type, status').eq('patient_id', patientId).order('due_date', { ascending: false }).limit(50),
        supabase.from('documents').select('id, created_at, name, category').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
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
          status: a.status,
        });
      });

      (txRes.data ?? []).forEach((t: any) => {
        timeline.push({
          id: `tx-${t.id}`,
          type: 'financial',
          title: t.description ?? t.category,
          description: `R$ ${Number(t.amount).toFixed(2).replace('.', ',')} • ${t.type === 'income' ? 'Receita' : 'Despesa'}`,
          date: t.due_date,
          icon: DollarSign,
          color: t.type === 'income' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10',
          status: t.status,
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

      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return timeline;
    },
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/20">
        <Clock className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-1">
        {events.map((event, i) => (
          <div
            key={event.id}
            className="relative flex gap-4 py-3 group animate-fade-in"
            style={{ animationDelay: `${Math.min(i * 50, 500)}ms`, animationFillMode: 'backwards' }}
          >
            {/* Dot */}
            <div className={`absolute -left-4.5 top-4 h-7 w-7 rounded-full flex items-center justify-center ${event.color} ring-4 ring-background z-10`}>
              <event.icon className="h-3.5 w-3.5" />
            </div>

            {/* Card */}
            <div className="flex-1 ml-4 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors group-hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                </div>
                <time className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                  {format(new Date(event.date), "dd MMM yyyy", { locale: ptBR })}
                </time>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
