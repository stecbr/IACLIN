import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, X, FileText, Activity, Stethoscope, ClipboardList, Pill, FileSignature, AlertCircle, CalendarClock, User, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  in_progress: 'Em Atendimento',
  completed: 'Concluída',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const requestKindLabels: Record<string, { label: string; icon: any }> = {
  exam: { label: 'Exame', icon: ClipboardList },
  prescription: { label: 'Receita', icon: Pill },
  certificate: { label: 'Atestado', icon: FileSignature },
  referral: { label: 'Encaminhamento', icon: FileText },
};

function EmptyValue() {
  return <span className="text-muted-foreground/60 italic text-sm">Não informado</span>;
}

function Section({ icon: Icon, title, count, children }: { icon: any; title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {title}
          {typeof count === 'number' && count > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">({count})</span>
          )}
        </h3>
      </div>
      <div className="pl-9">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? <p className="text-sm text-foreground">{value}</p> : <EmptyValue />}
    </div>
  );
}

export function AttendanceSummaryModal({ appointmentId, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-summary', appointmentId],
    enabled: !!appointmentId && open,
    queryFn: async () => {
      const [aptRes, recRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, patients(full_name, date_of_birth, phone), procedures(name, color), clinics(name)')
          .eq('id', appointmentId!)
          .maybeSingle(),
        supabase
          .from('clinical_records')
          .select('*, clinical_record_procedures(*, procedures(name, code)), clinical_record_requests(*)')
          .eq('appointment_id', appointmentId!)
          .maybeSingle(),
      ]);

      let dentistName: string | null = null;
      if (aptRes.data?.dentist_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', aptRes.data.dentist_id)
          .maybeSingle();
        dentistName = prof?.full_name ?? null;
      }

      return {
        appointment: aptRes.data,
        record: recRes.data,
        dentistName,
      };
    },
  });

  const apt = data?.appointment as any;
  const rec = data?.record as any;

  const initials = (apt?.patients?.full_name ?? '')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const vitals = (rec?.vital_signs ?? {}) as Record<string, any>;
  const hypotheses = Array.isArray(rec?.hypotheses) ? rec.hypotheses : [];
  const procs = (rec?.clinical_record_procedures ?? []) as any[];
  const requests = (rec?.clinical_record_requests ?? []) as any[];
  const totalProcedures = procs.reduce((s, p) => s + Number(p.price ?? 0), 0);

  const hasAnyVitals = Object.values(vitals).some((v) => v !== undefined && v !== null && v !== '');
  const status = apt?.status;
  const statusLabel = statusLabels[status] ?? status;

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 print:max-w-none print:shadow-none print:border-0">
        <DialogHeader className="px-6 pt-6 pb-4 print:hidden">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Resumo do atendimento
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !apt ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">Consulta não encontrada.</div>
        ) : !rec ? (
          <div className="px-6 pb-6">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Sem registro clínico ainda</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  O profissional ainda não publicou o resumo desta consulta.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-8rem)] px-6 pb-2">
            {/* Patient header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-foreground truncate">
                    {apt.patients?.full_name ?? 'Paciente'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {data?.dentistName && (
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" /> {data.dentistName}
                      </span>
                    )}
                    {apt.clinics?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {apt.clinics.name}
                      </span>
                    )}
                    <span>
                      {format(parseISO(apt.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
              <Badge className={`${statusColors[status] ?? 'bg-muted'} flex-shrink-0`}>
                {statusLabel}
              </Badge>
            </div>

            <div className="space-y-6 py-5">
              {/* Avaliação */}
              <Section icon={User} title="Avaliação">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Queixa principal" value={rec.chief_complaint} />
                  <Field label="Duração dos sintomas" value={rec.symptom_duration} />
                  <div className="sm:col-span-2">
                    <Field label="História da doença atual" value={rec.history_present_illness} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Exame físico" value={rec.physical_exam} />
                  </div>
                </div>
              </Section>

              <Separator />

              {/* Sinais vitais */}
              <Section icon={Activity} title="Sinais vitais">
                {hasAnyVitals ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {vitals.bp && <Field label="PA" value={`${vitals.bp} mmHg`} />}
                    {vitals.hr && <Field label="FC" value={`${vitals.hr} bpm`} />}
                    {vitals.rr && <Field label="FR" value={`${vitals.rr} irpm`} />}
                    {vitals.temp && <Field label="Temperatura" value={`${vitals.temp} °C`} />}
                    {vitals.spo2 && <Field label="SatO₂" value={`${vitals.spo2}%`} />}
                    {vitals.glucose && <Field label="Glicemia" value={`${vitals.glucose} mg/dL`} />}
                    {vitals.weight && <Field label="Peso" value={`${vitals.weight} kg`} />}
                    {vitals.height && <Field label="Altura" value={`${vitals.height} cm`} />}
                  </div>
                ) : (
                  <EmptyValue />
                )}
              </Section>

              <Separator />

              {/* Diagnóstico */}
              <Section icon={Stethoscope} title="Diagnóstico">
                <div className="space-y-3">
                  {hypotheses.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Hipóteses diagnósticas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hypotheses.map((h: any, i: number) => (
                          <Badge key={i} variant="secondary" className="font-normal">
                            {h.text}
                            {h.cid && <span className="ml-1 text-muted-foreground">· {h.cid}</span>}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Field label="Hipóteses diagnósticas" value={null} />
                  )}
                  <Field label="Diagnóstico" value={rec.diagnosis} />
                  <Field label="Gravidade" value={rec.severity} />
                </div>
              </Section>

              <Separator />

              {/* Conduta */}
              <Section icon={CalendarClock} title="Conduta">
                <div className="space-y-3">
                  <Field label="Plano de tratamento" value={rec.treatment_plan} />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field
                      label="Retorno previsto"
                      value={
                        rec.follow_up_date
                          ? format(parseISO(rec.follow_up_date), "dd/MM/yyyy", { locale: ptBR })
                          : null
                      }
                    />
                    <Field label="Motivo do retorno" value={rec.follow_up_reason} />
                  </div>
                </div>
              </Section>

              {/* Solicitações */}
              {requests.length > 0 && (
                <>
                  <Separator />
                  <Section icon={ClipboardList} title="Solicitações" count={requests.length}>
                    <div className="space-y-2">
                      {requests.map((r: any) => {
                        const meta = requestKindLabels[r.kind] ?? { label: r.kind, icon: FileText };
                        const Icon = meta.icon;
                        const fields = Object.entries(r.payload ?? {}).filter(([, v]) => v && String(v).trim());
                        return (
                          <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                              <p className="text-xs font-medium text-foreground">{meta.label}</p>
                            </div>
                            {fields.length > 0 ? (
                              <div className="space-y-1 pl-5">
                                {fields.map(([k, v]) => (
                                  <p key={k} className="text-xs text-muted-foreground">
                                    <span className="capitalize">{k}:</span>{' '}
                                    <span className="text-foreground">{String(v)}</span>
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 italic pl-5">Sem detalhes</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                </>
              )}

              {/* Procedimentos */}
              {procs.length > 0 && (
                <>
                  <Separator />
                  <Section icon={Stethoscope} title="Procedimentos realizados" count={procs.length}>
                    <div className="space-y-1.5">
                      {procs.map((p: any) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{p.procedures?.name ?? 'Procedimento'}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.tooth_number ? `Dente ${p.tooth_number}` : null}
                              {p.tooth_number && p.surface ? ' · ' : null}
                              {p.surface ? `Face ${p.surface}` : null}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-foreground tabular-nums">
                            {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground">Total</p>
                        <p className="text-base font-semibold text-foreground tabular-nums">
                          {totalProcedures.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  </Section>
                </>
              )}

              <Separator />

              {/* Evolução */}
              <Section icon={FileText} title="Evolução / Anotações">
                {rec.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{rec.notes}</p>
                ) : (
                  <EmptyValue />
                )}
              </Section>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border bg-background print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2" disabled={!rec}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="default" size="sm" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
