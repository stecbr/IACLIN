import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReturnPreset {
  id: string;
  label: string;
  days: number;
}

const RETURN_PRESETS: ReturnPreset[] = [
  { id: '7d', label: '7 dias', days: 7 },
  { id: '15d', label: '15 dias', days: 15 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '60d', label: '60 dias', days: 60 },
  { id: '90d', label: '90 dias', days: 90 },
  { id: '6m', label: '6 meses', days: 180 },
  { id: '1y', label: '1 ano', days: 365 },
];

const SLOT_HOURS = [8, 9, 10, 11, 14, 15, 16, 17];
const SLOT_DURATION_MIN = 30;

/**
 * Returns the next free 30-minute slot for the dentist starting from `fromDate`,
 * looking at SLOT_HOURS each day, skipping busy intervals from `appointments`.
 * Looks ahead up to 30 days.
 */
function findNextFreeSlot(
  fromDate: Date,
  busy: Array<{ start: Date; end: Date }>,
): Date | null {
  const now = new Date();
  const start = fromDate < now ? new Date(now.getTime() + 60 * 60 * 1000) : new Date(fromDate);

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const day = new Date(start);
    day.setDate(day.getDate() + dayOffset);
    // skip weekends
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const hour of SLOT_HOURS) {
      const slotStart = new Date(day);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MIN * 60 * 1000);
      if (slotStart < now) continue;
      // on day 0, only consider slots after `start`
      if (dayOffset === 0 && slotStart < start) continue;

      const overlaps = busy.some((b) => slotStart < b.end && slotEnd > b.start);
      if (!overlaps) return slotStart;
    }
  }
  return null;
}

export function QuickReturn() {
  const { user, currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState<string>('');
  const [presetId, setPresetId] = useState<string>('30d');
  const [reminder, setReminder] = useState(true);
  const [creating, setCreating] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ['quick-return-patients', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .eq('clinic_id', currentClinicId)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      return data ?? [];
    },
    enabled: !!currentClinicId,
  });

  const preset = RETURN_PRESETS.find((p) => p.id === presetId) ?? RETURN_PRESETS[2];

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + preset.days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [preset.days]);

  const { data: busyAppointments = [] } = useQuery({
    queryKey: ['quick-return-busy', user?.id, targetDate.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];
      const lookEnd = new Date(targetDate);
      lookEnd.setDate(lookEnd.getDate() + 30);
      const { data } = await supabase
        .from('appointments')
        .select('start_time, end_time, status')
        .eq('dentist_id', user.id)
        .gte('start_time', targetDate.toISOString())
        .lte('start_time', lookEnd.toISOString())
        .neq('status', 'cancelled');
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const busyIntervals = useMemo(
    () =>
      busyAppointments.map((a) => ({
        start: new Date(a.start_time),
        end: new Date(a.end_time),
      })),
    [busyAppointments],
  );

  const suggestedSlot = useMemo(
    () => findNextFreeSlot(targetDate, busyIntervals),
    [targetDate, busyIntervals],
  );

  const patient = patients.find((p) => p.id === patientId);

  const createReturn = async () => {
    if (!patientId || !suggestedSlot || !user?.id || !currentClinicId) return;
    setCreating(true);
    try {
      const end = new Date(suggestedSlot.getTime() + SLOT_DURATION_MIN * 60 * 1000);
      const { error } = await supabase.from('appointments').insert({
        patient_id: patientId,
        dentist_id: user.id,
        clinic_id: currentClinicId,
        start_time: suggestedSlot.toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled',
        label: 'Retorno',
        send_confirmation: reminder,
      });
      if (error) throw error;
      toast.success('Retorno agendado', {
        description: `${patient?.full_name} em ${format(suggestedSlot, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
      });
      queryClient.invalidateQueries({ queryKey: ['quick-return-busy'] });
      setPatientId('');
    } catch (err) {
      toast.error('Não consegui agendar agora', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> Paciente
        </Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o paciente" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Voltar em</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {RETURN_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                presetId === p.id
                  ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40 text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card className={cn('border-2', suggestedSlot ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent' : 'border-dashed')}>
        <CardContent className="p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Próximo horário sugerido</p>
          {suggestedSlot ? (
            <>
              <div className="flex items-center gap-3 mt-2">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold capitalize">
                    {format(suggestedSlot, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-lg text-primary font-semibold">
                    às {format(suggestedSlot, 'HH:mm')}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Janela de {SLOT_DURATION_MIN} minutos · você pode ajustar depois na agenda.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Sem horários livres encontrados nos próximos 30 dias. Ajuste pela agenda manualmente.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Lembrar paciente 24h antes</p>
          <p className="text-xs text-muted-foreground">Marca o agendamento para envio automático de confirmação.</p>
        </div>
        <Switch checked={reminder} onCheckedChange={setReminder} />
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!patientId || !suggestedSlot || creating}
        onClick={createReturn}
      >
        {creating ? <Check className="h-5 w-5 animate-pulse" /> : <CalendarPlus className="h-5 w-5" />}
        Agendar retorno
      </Button>
    </div>
  );
}