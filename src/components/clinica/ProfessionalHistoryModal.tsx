import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, User } from 'lucide-react';

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  completed: { label: 'Concluída',   variant: 'default' },
  finished:  { label: 'Concluída',   variant: 'default' },
  done:      { label: 'Concluída',   variant: 'default' },
  scheduled: { label: 'Agendada',    variant: 'secondary' },
  confirmed: { label: 'Confirmada',  variant: 'secondary' },
  waiting:   { label: 'Aguardando',  variant: 'outline' },
  cancelled: { label: 'Cancelada',   variant: 'destructive' },
};

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string;
  dentistUserId: string;
  dentistName: string;
}

export function ProfessionalHistoryModal({ open, onOpenChange, clinicId, dentistUserId, dentistName }: Props) {
  const rangeStart = subMonths(startOfMonth(new Date()), 11);
  const rangeEnd = endOfMonth(new Date());

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['professional-history', clinicId, dentistUserId],
    enabled: open && !!clinicId && !!dentistUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, patients(full_name), procedures(name)')
        .eq('clinic_id', clinicId)
        .eq('dentist_id', dentistUserId)
        .gte('start_time', rangeStart.toISOString())
        .lte('start_time', rangeEnd.toISOString())
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group by month (descending)
  const byMonth = useMemo(() => {
    const map = new Map<string, { label: string; items: typeof appointments }>();
    for (const apt of appointments as any[]) {
      const key = format(parseISO(apt.start_time), 'yyyy-MM');
      if (!map.has(key)) {
        map.set(key, {
          label: format(parseISO(apt.start_time), 'MMMM yyyy', { locale: ptBR }),
          items: [],
        });
      }
      map.get(key)!.items.push(apt);
    }
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [appointments]);

  const totalConcluidas = (appointments as any[]).filter(
    (a) => ['completed', 'finished', 'done'].includes(a.status)
  ).length;

  const totalMinutos = (appointments as any[]).reduce((sum: number, a: any) => {
    if (!a.end_time || !a.start_time) return sum;
    const mins = differenceInMinutes(parseISO(a.end_time), parseISO(a.start_time));
    return sum + (mins > 0 ? mins : 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary shrink-0" />
              Histórico de consultas · {dentistName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Últimos 12 meses</span>
            <span className="text-border">·</span>
            <span><strong className="text-foreground">{totalConcluidas}</strong> concluída(s)</span>
            {totalMinutos > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <strong className="text-foreground">{fmtDuration(totalMinutos)}</strong> em atendimento
                </span>
              </>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : byMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma consulta nos últimos 12 meses</p>
            </div>
          ) : (
            byMonth.map(({ key, label, items }) => {
              const concluded = (items as any[]).filter((a) =>
                ['completed', 'finished', 'done'].includes(a.status)
              ).length;
              const monthMinutes = (items as any[]).reduce((sum: number, a: any) => {
                if (!a.end_time || !a.start_time) return sum;
                const mins = differenceInMinutes(parseISO(a.end_time), parseISO(a.start_time));
                return sum + (mins > 0 ? mins : 0);
              }, 0);

              return (
                <div key={key} className="rounded-xl border border-border/60 overflow-hidden">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/40">
                    <span className="text-sm font-semibold capitalize">{label}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{items.length} consulta(s)</span>
                      {concluded > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {concluded} concluída(s)
                        </Badge>
                      )}
                      {monthMinutes > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDuration(monthMinutes)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-[140px_1fr_1fr_80px_90px] gap-2 px-4 py-2 bg-muted/20 border-b border-border/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Data / Hora</span>
                    <span>Paciente</span>
                    <span>Procedimento</span>
                    <span className="text-center">Duração</span>
                    <span className="text-right">Status</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border/40">
                    {(items as any[]).map((apt) => {
                      const statusInfo = STATUS_LABEL[apt.status] ?? { label: apt.status, variant: 'outline' as const };
                      const durationMins = apt.start_time && apt.end_time
                        ? differenceInMinutes(parseISO(apt.end_time), parseISO(apt.start_time))
                        : 0;

                      return (
                        <div
                          key={apt.id}
                          className="grid grid-cols-[140px_1fr_1fr_80px_90px] gap-2 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                            {format(parseISO(apt.start_time), 'dd/MM  HH:mm', { locale: ptBR })}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {apt.patients?.full_name ?? '—'}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {apt.procedures?.name ?? '—'}
                          </span>
                          <span className="text-xs text-muted-foreground text-center tabular-nums">
                            {durationMins > 0 ? fmtDuration(durationMins) : '—'}
                          </span>
                          <div className="flex justify-end">
                            <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">
                              {statusInfo.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
