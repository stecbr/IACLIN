import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WeekdayRow, type WeekdayTemplate } from './WeekdayRow';
import type { BreakItem } from './BreaksEditor';
import type { AvailabilityMode } from './ModeSelector';

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function defaultRow(weekday: number): WeekdayTemplate {
  const weekend = weekday === 0 || weekday === 6;
  return {
    weekday,
    is_active: !weekend,
    start_time: '08:00',
    end_time: '18:00',
    breaks: weekend ? [] : [{ start: '12:00', end: '13:00', label: 'Almoço' }],
    mode: 'particular',
    accepted_plan_ids: [],
  };
}

interface Props {
  userId: string;
  clinicId: string | null;
  scopeIsPersonal: boolean;
}

export function WeeklyTemplateTab({ userId, clinicId, scopeIsPersonal }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['schedule-template', userId, clinicId ?? 'personal'];

  const { data: rows, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('professional_schedule_template' as any)
        .select('*')
        .eq('user_id', userId);
      q = clinicId ? q.eq('clinic_id', clinicId) : q.is('clinic_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['clinic-insurance-plans-for-template', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const [template, setTemplate] = useState<WeekdayTemplate[]>(() =>
    Array.from({ length: 7 }, (_, i) => defaultRow(i)),
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!rows) return;
    const byDay = new Map<number, any>(rows.map((r) => [r.weekday, r]));
    const next = Array.from({ length: 7 }, (_, i) => {
      const r = byDay.get(i);
      if (!r) return defaultRow(i);
      return {
        weekday: i,
        is_active: r.is_active,
        start_time: String(r.start_time).slice(0, 5),
        end_time: String(r.end_time).slice(0, 5),
        breaks: (r.breaks ?? []) as BreakItem[],
        mode: r.mode as AvailabilityMode,
        accepted_plan_ids: r.accepted_plan_ids ?? [],
      };
    });
    setTemplate(next);
    setDirty(false);
  }, [rows]);

  const updateRow = (idx: number, next: WeekdayTemplate) => {
    setTemplate((prev) => prev.map((r, i) => (i === idx ? next : r)));
    setDirty(true);
  };

  const replicateMonday = () => {
    const monday = template[1];
    if (!monday.is_active) {
      toast.error('Ative segunda-feira primeiro');
      return;
    }
    setTemplate((prev) =>
      prev.map((r, i) =>
        i >= 1 && i <= 5 ? { ...monday, weekday: i } : r,
      ),
    );
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      // delete existing for this scope and reinsert
      let del = supabase.from('professional_schedule_template' as any).delete().eq('user_id', userId);
      del = clinicId ? del.eq('clinic_id', clinicId) : del.is('clinic_id', null);
      const { error: delErr } = await del;
      if (delErr) throw delErr;

      const toInsert = template.map((r) => ({
        user_id: userId,
        clinic_id: clinicId,
        weekday: r.weekday,
        is_active: r.is_active,
        start_time: r.start_time + ':00',
        end_time: r.end_time + ':00',
        breaks: r.breaks,
        mode: scopeIsPersonal ? 'particular' : r.mode,
        accepted_plan_ids: scopeIsPersonal ? [] : r.accepted_plan_ids,
      }));
      const { error } = await supabase.from('professional_schedule_template' as any).insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Padrão semanal salvo');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const scopeLabel = useMemo(
    () => (scopeIsPersonal ? 'Modo Pessoal (Particular)' : 'Clínica selecionada'),
    [scopeIsPersonal],
  );

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Padrão semanal
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define os horários que se repetem toda semana — {scopeLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={replicateMonday} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Replicar Segunda em dias úteis
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background/50">
        <div className="hidden md:grid grid-cols-[110px_auto_1fr_auto] gap-3 px-3 py-2 border-b text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          <span>Dia</span>
          <span>Horário</span>
          <span>Intervalos</span>
          <span>{scopeIsPersonal ? '' : 'Modo'}</span>
        </div>
        <div className="px-3">
          {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => (
            <WeekdayRow
              key={dayIdx}
              label={WEEKDAY_LABELS[dayIdx]}
              value={template[dayIdx]}
              onChange={(v) => updateRow(dayIdx, v)}
              availablePlans={plans}
              scopeIsPersonal={scopeIsPersonal}
            />
          ))}
        </div>
      </div>

      {!scopeIsPersonal && (
        <p className="text-[11px] text-muted-foreground">
          <strong>Particular</strong>: apenas atendimentos privados. <strong>Plano</strong>: apenas convênios selecionados. <strong>Ambos</strong>: aceita os dois.
        </p>
      )}
    </Card>
  );
}