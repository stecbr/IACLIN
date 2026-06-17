import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, FileText, Clock, Stethoscope, Pill, FlaskConical, ArrowRight, CalendarCheck, CalendarX, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ── Status maps ───────────────────────────────────────────────────────────────
const STATUS_PT: Record<string, string> = {
  scheduled:   'Agendada',
  confirmed:   'Confirmada',
  completed:   'Concluída',
  in_progress: 'Em atendimento',
  no_show:     'Faltou',
  cancelled:   'Cancelada',
};
const STATUS_STYLE: Record<string, string> = {
  scheduled:   'bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/30  dark:text-blue-400  dark:border-blue-800',
  confirmed:   'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
  completed:   'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  in_progress: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/30 dark:text-amber-400  dark:border-amber-800',
  no_show:     'bg-red-50    text-red-700    border-red-200    dark:bg-red-950/30   dark:text-red-400   dark:border-red-800',
  cancelled:   'bg-muted     text-muted-foreground border-border',
};

const CATEGORY_PT: Record<string, string> = {
  patient_exam: 'Exame enviado por você',
  prescription: 'Receita médica',
  image: 'Imagem médica',
  exam: 'Exame',
  lab_exam: 'Exame laboratorial',
  imaging_exam: 'Exame de imagem',
  medical_certificate: 'Atestado médico',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimelineEvent {
  id: string;
  type: 'appointment' | 'record' | 'document';
  date: string;
  title: string;
  status?: string;
  timeStr?: string;
  doctorName?: string;
  doctorAvatar?: string;
  specialty?: string;
  clinicName?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  followUp?: string;
  prescriptionCount?: number;
  examCount?: number;
  referralCount?: number;
  certificateCount?: number;
  docDescription?: string;
  notes?: string;
}

interface Props { patientIds: string[]; limit?: number; compact?: boolean; searchTerm?: string; }

export function PatientTimelineMulti({ patientIds, limit, compact = false, searchTerm }: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['patient-timeline-multi', patientIds.sort().join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const [aptRes, recRes, docRes] = await Promise.all([
        supabase.from('appointments')
          .select('id, start_time, status, notes, dentist_id, clinic_id')
          .in('patient_id', patientIds)
          .order('start_time', { ascending: false })
          .limit(60),
        supabase.from('clinical_records')
          .select('id, created_at, diagnosis, treatment_plan, follow_up_date, follow_up_reason, dentist_id, clinic_id, clinical_record_requests(id, kind, payload)')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase.from('documents')
          .select('id, created_at, name, category, file_url')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const apts  = aptRes.data ?? [];
      const recs  = recRes.data ?? [];
      const docs  = (docRes.data ?? []).filter((d: any) => !d.file_url?.startsWith('generated://'));

      // Fetch profiles (with avatar) + clinics
      const allDentistIds = [...new Set([
        ...apts.map((a: any) => a.dentist_id),
        ...recs.map((r: any) => r.dentist_id),
      ].filter(Boolean))];
      const allClinicIds = [...new Set([
        ...apts.map((a: any) => a.clinic_id),
        ...recs.map((r: any) => r.clinic_id),
      ].filter(Boolean))];

      const profMap   = new Map<string, any>();
      const clinicMap = new Map<string, any>();

      if (allDentistIds.length > 0) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id, full_name, specialty, avatar_url')
          .in('id', allDentistIds);
        (p ?? []).forEach((x: any) => profMap.set(x.id, x));
      }
      if (allClinicIds.length > 0) {
        const { data: c } = await supabase
          .from('clinics')
          .select('id, name')
          .in('id', allClinicIds);
        (c ?? []).forEach((x: any) => clinicMap.set(x.id, x));
      }

      const timeline: TimelineEvent[] = [];

      for (const a of apts as any[]) {
        const prof = a.dentist_id ? profMap.get(a.dentist_id) : null;
        const clin = a.clinic_id  ? clinicMap.get(a.clinic_id) : null;
        const specialty = prof?.specialty
          ? prof.specialty.charAt(0).toUpperCase() + prof.specialty.slice(1)
          : undefined;
        // Filter out marketplace booking notes (not clinically relevant)
        const notesClean = a.notes && !a.notes.toLowerCase().includes('marketplace')
          ? a.notes
          : undefined;
        timeline.push({
          id: `apt-${a.id}`,
          type: 'appointment',
          date: a.start_time,
          title: specialty ? `Consulta de ${specialty}` : 'Consulta',
          status: a.status,
          timeStr: format(new Date(a.start_time), "HH:mm'h'"),
          doctorName: prof?.full_name ?? undefined,
          doctorAvatar: prof?.avatar_url ?? undefined,
          specialty,
          clinicName: clin?.name ?? undefined,
          notes: notesClean,
        });
      }

      for (const r of recs as any[]) {
        const prof = r.dentist_id ? profMap.get(r.dentist_id) : null;
        const clin = r.clinic_id  ? clinicMap.get(r.clinic_id) : null;
        const reqs = r.clinical_record_requests ?? [];
        const rxCount   = reqs.filter((x: any) => ['prescription', 'doc_prescription'].includes(x.kind)).length;
        const examCount = reqs.filter((x: any) => ['lab_exam', 'imaging_exam', 'doc_exam_request'].includes(x.kind)).length;
        const refCount  = reqs.filter((x: any) => ['referral', 'doc_referral'].includes(x.kind)).length;
        const certCount = reqs.filter((x: any) => x.kind === 'doc_certificate').length;
        const specialty = prof?.specialty
          ? prof.specialty.charAt(0).toUpperCase() + prof.specialty.slice(1)
          : undefined;
        const followUp = r.follow_up_date
          ? `Retorno em ${format(parseISO(r.follow_up_date), "dd/MM/yyyy")}${r.follow_up_reason ? ' — ' + r.follow_up_reason : ''}`
          : undefined;
        timeline.push({
          id: `rec-${r.id}`,
          type: 'record',
          date: r.created_at,
          title: 'Atendimento clínico',
          doctorName: prof?.full_name ?? undefined,
          doctorAvatar: prof?.avatar_url ?? undefined,
          specialty,
          clinicName: clin?.name ?? undefined,
          diagnosis: r.diagnosis || undefined,
          treatmentPlan: r.treatment_plan || undefined,
          followUp,
          prescriptionCount: rxCount  > 0 ? rxCount  : undefined,
          examCount:         examCount > 0 ? examCount : undefined,
          referralCount:     refCount  > 0 ? refCount  : undefined,
          certificateCount:  certCount > 0 ? certCount : undefined,
        });
      }

      for (const d of docs as any[]) {
        const cat = (d.category ?? '').toLowerCase();
        timeline.push({
          id: `doc-${d.id}`,
          type: 'document',
          date: d.created_at,
          title: d.name,
          docDescription: CATEGORY_PT[cat] ?? 'Documento',
        });
      }

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

  // Filter by search term
  const q = searchTerm?.toLowerCase().trim() ?? '';
  const filtered = q
    ? events.filter(ev =>
        ev.doctorName?.toLowerCase().includes(q) ||
        ev.clinicName?.toLowerCase().includes(q) ||
        ev.specialty?.toLowerCase().includes(q) ||
        ev.title?.toLowerCase().includes(q) ||
        ev.diagnosis?.toLowerCase().includes(q)
      )
    : events;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-border bg-muted/20 gap-3">
        <Clock className="h-8 w-8 text-muted-foreground/50" />
        <div className="text-center">
          {q
            ? <><p className="text-sm font-medium text-muted-foreground">Nenhum resultado para "{searchTerm}"</p><p className="text-xs text-muted-foreground/70 mt-0.5">Tente buscar por outro médico, clínica ou especialidade</p></>
            : <><p className="text-sm font-medium text-muted-foreground">Nenhum evento registrado</p><p className="text-xs text-muted-foreground/70 mt-0.5">Suas consultas e atendimentos aparecerão aqui</p></>
          }
        </div>
      </div>
    );
  }

  // Group by month
  const grouped: { month: string; events: TimelineEvent[] }[] = [];
  for (const ev of filtered) {
    const monthKey = format(new Date(ev.date), 'MMMM yyyy', { locale: ptBR });
    const last = grouped[grouped.length - 1];
    if (last && last.month === monthKey) last.events.push(ev);
    else grouped.push({ month: monthKey, events: [ev] });
  }

  return (
    <div className={compact ? 'space-y-6' : 'space-y-8'}>
      {grouped.map(({ month, events: monthEvents }) => (
        <div key={month}>
          {/* Month header */}
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize shrink-0">
              {month}
            </p>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <div className="space-y-1">
            {monthEvents.map((event, idx) => {
              const isLast = idx === monthEvents.length - 1;
              const initials = event.doctorName
                ?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '';

              return (
                <div key={event.id} className="flex gap-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-background z-10 ${eventStyle(event)}`}>
                      <EventIcon event={event} />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border/40 mt-0.5 mb-0.5" />}
                  </div>

                  {/* Card */}
                  <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-3'}`}>
                    <div className="rounded-xl border border-border/60 bg-card hover:shadow-sm hover:border-border transition-all overflow-hidden">

                      {/* Card body */}
                      <div className="p-3.5 flex gap-3">
                        {/* Doctor avatar (appointments + records only) */}
                        {event.type !== 'document' && (
                          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-border">
                            <AvatarImage src={event.doctorAvatar} />
                            <AvatarFallback className={`text-xs font-semibold ${avatarColor(event)}`}>
                              {initials || <Stethoscope className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title + date */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <p className="text-sm font-semibold leading-snug">{event.title}</p>
                              {event.status && (
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${STATUS_STYLE[event.status] ?? STATUS_STYLE.scheduled}`}>
                                  {STATUS_PT[event.status] ?? event.status}
                                </span>
                              )}
                            </div>
                            <time className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5 font-medium">
                              {format(new Date(event.date), "dd MMM", { locale: ptBR })}
                              {event.timeStr && (
                                <span className="block text-right opacity-70">{event.timeStr}</span>
                              )}
                            </time>
                          </div>

                          {/* Doctor + clinic */}
                          {event.doctorName && (
                            <p className="text-xs font-medium text-foreground/80 mt-1">
                              Dr(a). {event.doctorName}
                              {event.specialty && (
                                <span className="text-muted-foreground font-normal"> · {event.specialty}</span>
                              )}
                            </p>
                          )}
                          {event.clinicName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {event.clinicName}
                            </p>
                          )}

                          {/* Notes (appointment) */}
                          {event.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{event.notes}"</p>
                          )}

                          {/* Diagnosis + treatment (records) */}
                          {event.diagnosis && (
                            <div className="mt-1.5 flex items-start gap-1.5">
                              <Stethoscope className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                              <p className="text-xs text-foreground/80">{event.diagnosis}</p>
                            </div>
                          )}
                          {event.treatmentPlan && (
                            <div className="flex items-start gap-1.5 mt-0.5">
                              <FileText className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                              <p className="text-xs text-muted-foreground">{event.treatmentPlan}</p>
                            </div>
                          )}

                          {/* Document category */}
                          {event.docDescription && (
                            <p className="text-xs text-muted-foreground mt-1">{event.docDescription}</p>
                          )}

                          {/* Record output chips */}
                          {(event.prescriptionCount || event.examCount || event.referralCount || event.certificateCount) ? (
                            <div className="flex gap-1.5 flex-wrap mt-2">
                              {event.prescriptionCount && (
                                <Chip color="emerald" icon={<Pill className="h-2.5 w-2.5" />}>
                                  {event.prescriptionCount} receita{event.prescriptionCount > 1 ? 's' : ''}
                                </Chip>
                              )}
                              {event.examCount && (
                                <Chip color="violet" icon={<FlaskConical className="h-2.5 w-2.5" />}>
                                  {event.examCount} exame{event.examCount > 1 ? 's' : ''}
                                </Chip>
                              )}
                              {event.referralCount && (
                                <Chip color="amber" icon={<ArrowRight className="h-2.5 w-2.5" />}>
                                  {event.referralCount} encaminhamento{event.referralCount > 1 ? 's' : ''}
                                </Chip>
                              )}
                              {event.certificateCount && (
                                <Chip color="sky" icon={<FileText className="h-2.5 w-2.5" />}>
                                  {event.certificateCount} atestado{event.certificateCount > 1 ? 's' : ''}
                                </Chip>
                              )}
                            </div>
                          ) : null}

                          {/* Follow-up */}
                          {event.followUp && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{event.followUp}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Chip({ color, icon, children }: { color: string; icon: React.ReactNode; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    violet:  'bg-violet-50  text-violet-700  border-violet-200  dark:bg-violet-950/30  dark:text-violet-400  dark:border-violet-800',
    amber:   'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-950/30   dark:text-amber-400   dark:border-amber-800',
    sky:     'bg-sky-50     text-sky-700     border-sky-200     dark:bg-sky-950/30     dark:text-sky-400     dark:border-sky-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors[color] ?? colors.violet}`}>
      {icon}{children}
    </span>
  );
}

function eventStyle(ev: TimelineEvent): string {
  if (ev.type === 'document') return 'bg-violet-500/15 text-violet-600';
  if (ev.type === 'record')   return 'bg-primary/10 text-primary';
  if (ev.status === 'completed' || ev.status === 'confirmed') return 'bg-emerald-500/15 text-emerald-600';
  if (ev.status === 'cancelled' || ev.status === 'no_show')  return 'bg-muted text-muted-foreground';
  return 'bg-blue-500/15 text-blue-600';
}

function avatarColor(ev: TimelineEvent): string {
  if (ev.type === 'record')   return 'bg-primary/10 text-primary';
  if (ev.status === 'completed' || ev.status === 'confirmed') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (ev.status === 'cancelled' || ev.status === 'no_show')  return 'bg-muted text-muted-foreground';
  return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
}

function EventIcon({ event }: { event: TimelineEvent }) {
  if (event.type === 'document') return <FileText className="h-3.5 w-3.5" />;
  if (event.type === 'record')   return <Stethoscope className="h-3.5 w-3.5" />;
  if (event.status === 'completed' || event.status === 'confirmed') return <CalendarCheck className="h-3.5 w-3.5" />;
  if (event.status === 'cancelled' || event.status === 'no_show')  return <CalendarX className="h-3.5 w-3.5" />;
  return <Calendar className="h-3.5 w-3.5" />;
}
