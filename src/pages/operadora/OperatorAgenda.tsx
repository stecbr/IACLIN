import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Slot {
  id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  mode: string;
  full_name?: string | null;
}

export default function OperatorAgenda() {
  const { operatorId } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operatorId) return;
    (async () => {
      const { data: creds } = await supabase
        .from('operator_credentialings')
        .select('professional_user_id')
        .eq('operator_id', operatorId)
        .eq('status', 'approved');
      const userIds = [...new Set((creds ?? []).map((c) => c.professional_user_id))];
      if (userIds.length === 0) { setSlots([]); setLoading(false); return; }
      const today = format(new Date(), 'yyyy-MM-dd');
      const future = format(addDays(new Date(), 14), 'yyyy-MM-dd');
      const { data: avail } = await supabase
        .from('professional_availability')
        .select('id, user_id, work_date, start_time, end_time, mode')
        .in('user_id', userIds)
        .gte('work_date', today)
        .lte('work_date', future)
        .in('mode', ['plano', 'ambos'])
        .order('work_date', { ascending: true })
        .order('start_time', { ascending: true });
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', userIds);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setSlots(((avail ?? []) as Slot[]).map((s) => ({ ...s, full_name: pmap.get(s.user_id) ?? '—' })));
      setLoading(false);
    })();
  }, [operatorId]);

  const grouped = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.work_date] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agenda disponível</h1>
        <p className="text-sm text-muted-foreground">Horários liberados pelos profissionais credenciados (próximos 14 dias)</p>
      </div>
      {loading ? (
        <Card className="rounded-xl p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="rounded-xl p-12 text-center text-sm text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhum horário disponível no momento.
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <Card key={date} className="rounded-xl p-4">
              <div className="font-medium mb-3 capitalize">
                {format(new Date(date + 'T00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((s) => (
                  <div key={s.id} className="text-sm border border-border rounded-xl p-2">
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} · {s.mode === 'plano' ? 'Reservado p/ plano' : 'Particular + plano'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}