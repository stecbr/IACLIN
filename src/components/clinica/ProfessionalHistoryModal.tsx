import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, User } from 'lucide-react';

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  completed: { label: 'Concluída',   variant: 'default' },
  finished:  { label: 'Concluída',   variant: 'default' },
  done:      { label: 'Concluída',   variant: 'default' },
  scheduled: { label: 'Agendada',    variant: 'secondary' },
  confirmed: { label: 'Confirmada',  variant: 'secondary' },
  waiting:   { label: 'Aguardando',  variant: 'outline' },
  cancelled: { label: 'Cancelada',   variant: 'destructive' },
};

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
        .select('id, start_time, status, patients(full_name), procedures(name)')
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

  const totalConsultas = (appointments as any[]).filter(
    (a) => ['completed', 'finished', 'done'].includes(a.status)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Histórico de consultas · {dentistName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Últimos 12 meses · {totalConsultas} consulta(s) concluída(s)
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
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
              return (
                <div key={key} className="rounded-xl border border-border/60 overflow-hidden">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/40">
                    <span className="text-sm font-semibold capitalize">{label}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{items.length} consulta(s)</span>
                      {concluded > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {concluded} concluída(s)
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border/40">
                    {(items as any[]).map((apt) => {
                      const statusInfo = STATUS_LABEL[apt.status] ?? { label: apt.status, variant: 'outline' as const };
                      return (
                        <div key={apt.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(parseISO(apt.start_time), 'dd/MM HH:mm', { locale: ptBR })}
                            </span>
                            <span className="font-medium text-sm truncate">
                              {apt.patients?.full_name ?? '—'}
                            </span>
                            {apt.procedures?.name && (
                              <span className="text-xs text-muted-foreground truncate hidden sm:block">
                                · {apt.procedures.name}
                              </span>
                            )}
                          </div>
                          <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">
                            {statusInfo.label}
                          </Badge>
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
