import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TimelineEvent {
  id: string;
  type: 'appointment' | 'clinical';
  title: string;
  description: string;
  date: string;
  icon: typeof Calendar;
  color: string;
  status?: string;
  href?: string;
  doctorName?: string | null;
}

export function PatientTimeline({ patientId }: { patientId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const [aptRes, recRes] = await Promise.all([
        supabase.from('appointments').select('id, start_time, status, notes, dentist_id, procedures(name)').eq('patient_id', patientId).order('start_time', { ascending: false }).limit(50),
        supabase.from('clinical_records')
          .select('id, appointment_id, created_at, status, diagnosis, hypotheses, dentist_id, procedure_duration_seconds, clinical_record_procedures(id), clinical_record_requests(id, kind)')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const timeline: TimelineEvent[] = [];

      // Fetch doctor names in one go
      const doctorIds = Array.from(new Set([
        ...(aptRes.data ?? []).map((a: any) => a.dentist_id),
        ...(recRes.data ?? []).map((r: any) => r.dentist_id),
      ].filter(Boolean)));
      const doctorMap: Record<string, string> = {};
      if (doctorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', doctorIds);
        (profs ?? []).forEach((p: any) => { doctorMap[p.id] = p.full_name; });
      }

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
          doctorName: a.dentist_id ? doctorMap[a.dentist_id] : null,
        });
      });

      (recRes.data ?? []).forEach((r: any) => {
        const hyps = Array.isArray(r.hypotheses) ? r.hypotheses.length : 0;
        const procs = (r.clinical_record_procedures ?? []).length;
        const reqs = (r.clinical_record_requests ?? []).length;
        const presc = (r.clinical_record_requests ?? []).filter((x: any) => x.kind === 'prescription').length;
        const exams = (r.clinical_record_requests ?? []).filter((x: any) => x.kind === 'lab_exam' || x.kind === 'imaging_exam').length;
        const parts: string[] = [];
        if (hyps) parts.push(`${hyps} hipótese${hyps > 1 ? 's' : ''}`);
        if (procs) parts.push(`${procs} procedimento${procs > 1 ? 's' : ''}`);
        if (presc) parts.push(`${presc} prescriç${presc > 1 ? 'ões' : 'ão'}`);
        if (exams) parts.push(`${exams} exame${exams > 1 ? 's' : ''}`);
        const desc = parts.length > 0 ? parts.join(' · ') : (r.diagnosis ?? `Status: ${r.status}`);
        const durationLabel = r.procedure_duration_seconds && r.procedure_duration_seconds > 0
          ? `⏱ ${Math.floor(r.procedure_duration_seconds / 60) > 0 ? Math.floor(r.procedure_duration_seconds / 60) + 'min' : r.procedure_duration_seconds + 's'}`
          : '';
        const fullDesc = durationLabel ? `${desc} · ${durationLabel}` : desc;
        timeline.push({
          id: `rec-${r.id}`,
          type: 'clinical',
          title: r.status === 'completed' ? 'Atendimento finalizado' : 'Atendimento em andamento',
          description: fullDesc,
          date: r.created_at,
          icon: Stethoscope,
          color: 'text-primary bg-primary/10',
          href: r.appointment_id ? `/atendimento/${r.appointment_id}` : undefined,
          doctorName: r.dentist_id ? doctorMap[r.dentist_id] : null,
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
            className="relative flex gap-4 py-3 pl-10 group animate-fade-in"
            style={{ animationDelay: `${Math.min(i * 50, 500)}ms`, animationFillMode: 'backwards' }}
          >
            {/* Dot */}
            <div className={`absolute left-0 top-4 h-7 w-7 rounded-full flex items-center justify-center ${event.color} ring-4 ring-background z-10`}>
              <event.icon className="h-3.5 w-3.5" />
            </div>

            {/* Card */}
            {event.href ? (
              <Link to={event.href} className="flex-1 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors group-hover:shadow-sm block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    {event.doctorName && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5">Dr(a). {event.doctorName}</p>
                    )}
                  </div>
                  <time className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    {format(new Date(event.date), "dd MMM yyyy", { locale: ptBR })}
                  </time>
                </div>
              </Link>
            ) : (
              <div className="flex-1 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors group-hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    {event.doctorName && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5">Dr(a). {event.doctorName}</p>
                    )}
                  </div>
                  <time className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    {format(new Date(event.date), "dd MMM yyyy", { locale: ptBR })}
                  </time>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
