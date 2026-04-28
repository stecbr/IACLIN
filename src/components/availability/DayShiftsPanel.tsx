import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Clock, CalendarOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/holidays';
import type { HolidayInfo } from '@/lib/holidays';
import { syncClinicAvailability } from '@/hooks/useAiSync';

export interface Shift {
  id: string;
  start_time: string; // HH:MM:SS
  end_time: string;
  is_holiday_override: boolean;
}

interface DayShiftsPanelProps {
  date: Date;
  shifts: Shift[];
  clinicId: string;
  userId: string;
  holiday: HolidayInfo | null;
}

export function DayShiftsPanel({ date, shifts, clinicId, userId, holiday }: DayShiftsPanelProps) {
  const queryClient = useQueryClient();
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('12:00');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['professional-availability', clinicId, userId] });

  const addShift = useMutation({
    mutationFn: async () => {
      if (newEnd <= newStart) {
        throw new Error('O horário de fim deve ser maior que o de início.');
      }
      const { error } = await supabase.from('professional_availability').insert({
        clinic_id: clinicId,
        user_id: userId,
        work_date: toLocalDateStr(date),
        start_time: `${newStart}:00`,
        end_time: `${newEnd}:00`,
        is_holiday_override: !!holiday,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Turno adicionado');
      syncClinicAvailability(clinicId);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('professional_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Turno removido');
      syncClinicAvailability(clinicId);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Turnos do dia
        </p>
        <p className="text-lg font-semibold capitalize mt-0.5">
          {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
        {holiday && (
          <Badge variant="outline" className="mt-2 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3 w-3 mr-1" /> Feriado: {holiday.name}
          </Badge>
        )}
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <CalendarOff className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Nenhum turno cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                </span>
                {s.is_holiday_override && (
                  <Badge variant="outline" className="text-[10px] h-5 border-amber-500/40 text-amber-700 dark:text-amber-400">
                    Feriado
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeShift.mutate(s.id)}
                disabled={removeShift.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Adicionar novo turno</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[11px] text-muted-foreground">Início</label>
            <Input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-muted-foreground">Fim</label>
            <Input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            className="h-9 gap-1"
            onClick={() => addShift.mutate()}
            disabled={addShift.isPending}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </Card>
  );
}
