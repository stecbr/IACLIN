import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  userId: string;
}

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90];

export function DurationSettingsTab({ userId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['professional-settings', userId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_settings' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [leadHours, setLeadHours] = useState(1);

  useEffect(() => {
    if (data) {
      setDuration(data.default_slot_duration ?? 30);
      setBuffer(data.buffer_minutes ?? 0);
      setLeadHours(data.min_lead_hours ?? 1);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        default_slot_duration: duration,
        buffer_minutes: buffer,
        min_lead_hours: leadHours,
      };
      const { error } = await supabase
        .from('professional_settings' as any)
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações salvas');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <Card className="p-5 space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Duração e ritmo das consultas</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Duração padrão da consulta</Label>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`h-9 px-3 rounded-md text-sm border transition-colors ${
                duration === d
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {d} min
            </button>
          ))}
          <Input
            type="number"
            min={5}
            max={240}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 30)}
            className="h-9 w-24 text-sm"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cada slot de agenda será dividido nesta duração.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">Intervalo entre consultas (buffer)</Label>
          <Input
            type="number"
            min={0}
            max={60}
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value) || 0)}
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">
            Minutos de respiro entre uma consulta e outra.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Antecedência mínima</Label>
          <Input
            type="number"
            min={0}
            max={168}
            value={leadHours}
            onChange={(e) => setLeadHours(Number(e.target.value) || 0)}
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">
            Horas mínimas antes do horário para agendar.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Salvar configurações
        </Button>
      </div>
    </Card>
  );
}