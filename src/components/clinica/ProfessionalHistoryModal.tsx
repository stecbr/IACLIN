import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, differenceInMinutes, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, User, Search, X } from 'lucide-react';

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  completed: { label: 'Concluída',  variant: 'default' },
  finished:  { label: 'Concluída',  variant: 'default' },
  done:      { label: 'Concluída',  variant: 'default' },
  scheduled: { label: 'Agendada',   variant: 'secondary' },
  confirmed: { label: 'Confirmada', variant: 'secondary' },
  waiting:   { label: 'Aguardando', variant: 'outline' },
  cancelled: { label: 'Cancelada',  variant: 'destructive' },
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

  const [searchName, setSearchName] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const hasFilters = searchName.trim() || filterFrom || filterTo;

  const clearFilters = () => {
    setSearchName('');
    setFilterFrom('');
    setFilterTo('');
  };

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['professional-history', clinicId, dentistUserId],
    enabled: open && !!clinicId && !!dentistUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, patients(full_name)')
        .eq('clinic_id', clinicId)
        .eq('dentist_id', dentistUserId)
        .gte('start_time', rangeStart.toISOString())
        .lte('start_time', rangeEnd.toISOString())
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Apply filters client-side
  const filtered = useMemo(() => {
    let list = appointments as any[];
    const name = searchName.trim().toLowerCase();
    if (name) list = list.filter((a) => (a.patients?.full_name ?? '').toLowerCase().includes(name));
    if (filterFrom) {
      const from = new Date(filterFrom + 'T00:00:00');
      list = list.filter((a) => parseISO(a.start_time) >= from);
    }
    if (filterTo) {
      const to = new Date(filterTo + 'T23:59:59');
      list = list.filter((a) => parseISO(a.start_time) <= to);
    }
    return list;
  }, [appointments, searchName, filterFrom, filterTo]);

  // Group by month (descending)
  const byMonth = useMemo(() => {
    const map = new Map<string, { label: string; items: any[] }>();
    for (const apt of filtered) {
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
  }, [filtered]);

  const totalConcluidas = filtered.filter(
    (a: any) => ['completed', 'finished', 'done'].includes(a.status)
  ).length;

  const totalMinutos = filtered.reduce((sum: number, a: any) => {
    if (!a.end_time || !a.start_time) return sum;
    const mins = differenceInMinutes(parseISO(a.end_time), parseISO(a.start_time));
    return sum + (mins > 0 ? mins : 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 space-y-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary shrink-0" />
              Histórico de consultas · {dentistName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
            {hasFilters && (
              <>
                <span className="text-border">·</span>
                <span className="text-primary font-medium">{filtered.length} resultado(s) filtrado(s)</span>
              </>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Paciente</Label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="h-8 text-sm w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="h-8 text-sm w-36"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1.5 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
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
              <p className="text-sm font-medium">
                {hasFilters ? 'Nenhuma consulta encontrada para este filtro' : 'Nenhuma consulta nos últimos 12 meses'}
              </p>
              {hasFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-2 text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            byMonth.map(({ key, label, items }) => {
              const concluded = items.filter((a) =>
                ['completed', 'finished', 'done'].includes(a.status)
              ).length;
              const monthMinutes = items.reduce((sum: number, a: any) => {
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
                  <div className="grid grid-cols-[150px_1fr_90px_90px] gap-2 px-4 py-2 bg-muted/20 border-b border-border/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Data / Hora</span>
                    <span>Paciente</span>
                    <span className="text-center">Duração</span>
                    <span className="text-right">Status</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border/40">
                    {items.map((apt: any) => {
                      const statusInfo = STATUS_LABEL[apt.status] ?? { label: apt.status, variant: 'outline' as const };
                      const durationMins = apt.start_time && apt.end_time
                        ? differenceInMinutes(parseISO(apt.end_time), parseISO(apt.start_time))
                        : 0;

                      return (
                        <div
                          key={apt.id}
                          className="grid grid-cols-[150px_1fr_90px_90px] gap-2 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                            {format(parseISO(apt.start_time), 'dd/MM  HH:mm', { locale: ptBR })}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {apt.patients?.full_name ?? '—'}
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
