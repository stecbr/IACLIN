import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CalendarX, X } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/holidays';

interface Props {
  userId: string;
  clinicId: string | null;
}

export function BlockedDatesDialog({ userId, clinicId }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const qc = useQueryClient();
  const queryKey = ['blocked-dates', userId, clinicId ?? 'personal'];

  const { data: blocked = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('professional_blocked_dates' as any)
        .select('id, blocked_date, reason')
        .eq('user_id', userId)
        .order('blocked_date');
      q = clinicId ? q.eq('clinic_id', clinicId) : q.is('clinic_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const blockedSet = new Set(blocked.map((b) => b.blocked_date));

  const add = useMutation({
    mutationFn: async () => {
      if (!picked) return;
      const dateStr = toLocalDateStr(picked);
      if (blockedSet.has(dateStr)) {
        toast.error('Esta data já está bloqueada');
        return;
      }
      const { error } = await supabase.from('professional_blocked_dates' as any).insert({
        user_id: userId,
        clinic_id: clinicId,
        blocked_date: dateStr,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Data bloqueada');
      setPicked(undefined);
      setReason('');
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('professional_blocked_dates' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bloqueio removido');
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarX className="h-3.5 w-3.5" /> Bloquear datas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bloquear datas na agenda</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecione um dia que ficará indisponível (tanto para particular quanto para plano).
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={picked}
                onSelect={setPicked}
                locale={ptBR}
                disabled={(d) => d < startOfDay(new Date())}
                modifiers={{ blocked: (d) => blockedSet.has(toLocalDateStr(d)) }}
                modifiersClassNames={{ blocked: 'bg-destructive/15 text-destructive' }}
                className="pointer-events-auto"
              />
            </div>
            <Input
              placeholder="Motivo (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!picked || add.isPending}
              onClick={() => add.mutate()}
            >
              Bloquear data
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Datas bloqueadas ({blocked.length})
            </p>
            <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
              {blocked.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-6 text-center">
                  Nenhuma data bloqueada
                </p>
              )}
              {blocked.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border bg-background/50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {format(new Date(b.blocked_date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </div>
                    {b.reason && (
                      <div className="text-[11px] text-muted-foreground truncate">{b.reason}</div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="border-destructive/40 text-destructive text-[10px]"
                  >
                    Bloqueado
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => remove.mutate(b.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
