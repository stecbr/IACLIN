import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Loader2, Building2, Users } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Specialty } from './SpecialtyStep';

interface DateStepProps {
  specialty: Specialty;
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
  onBack: () => void;
}

// removed: dayKey (now using professional_availability)

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateStep({ specialty, selectedDate, onSelect, onBack }: DateStepProps) {
  const [date, setDate] = useState<Date | undefined>(selectedDate ?? undefined);
  const [preview, setPreview] = useState<{ clinics: number; pros: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!date) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    (async () => {
      const dateKey = toLocalDateStr(date);
      const weekday = date.getDay();

      // Find members with this specialty (admins are typically clinic owners
      // working solo — we include them so they can be booked at their own clinic).
      const { data: members } = await supabase
        .from('clinic_members')
        .select('id, user_id, clinic_id, is_owner')
        .filter('specialty', 'eq', specialty.id)
        .in('role', ['dentist', 'admin']);

      if (!members || members.length === 0) {
        if (!cancelled) { setPreview({ clinics: 0, pros: 0 }); setLoadingPreview(false); }
        return;
      }

      const userIds = [...new Set(members.map((m: any) => m.user_id))];
      const clinicIds = [...new Set(members.map((m: any) => m.clinic_id))];

      const [{ data: tpls }, { data: blocks }] = await Promise.all([
        supabase
          .from('professional_schedule_template' as any)
          .select('user_id, clinic_id, mode, is_active')
          .in('user_id', userIds)
          .in('clinic_id', clinicIds)
          .eq('weekday', weekday)
          .eq('is_active', true),
        supabase
          .from('professional_blocked_dates')
          .select('user_id, clinic_id, blocked_date')
          .in('user_id', userIds)
          .eq('blocked_date', dateKey),
      ]);

      const blockedKeys = new Set<string>(
        ((blocks ?? []) as any[]).map((b) => `${b.user_id}|${b.clinic_id ?? ''}`),
      );

      const activeUsers = new Set<string>();
      const activeClinics = new Set<string>();
      for (const t of (tpls ?? []) as any[]) {
        const matched = (members as any[]).find(
          (m) => m.user_id === t.user_id && m.clinic_id === t.clinic_id,
        );
        if (!matched) continue;
        // Owner of the clinic: only "particular" days are bookable by patients.
        // Member (vinculado): only "plano" days.
        const expected = matched.is_owner ? 'particular' : 'plano';
        if (t.mode !== expected) continue;
        // Skip if the user blocked this date (globally or for that clinic).
        if (
          blockedKeys.has(`${t.user_id}|${t.clinic_id}`) ||
          blockedKeys.has(`${t.user_id}|`)
        ) continue;
        activeUsers.add(t.user_id);
        activeClinics.add(t.clinic_id);
      }

      if (!cancelled) {
        setPreview({ clinics: activeClinics.size, pros: activeUsers.size });
        setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, specialty]);

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    setDate(d);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Quando você quer ser atendido?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha o dia da consulta para <span className="font-medium text-foreground">{specialty.name}</span>.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr] items-start">
        <Card className="p-2 w-fit mx-auto md:mx-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            disabled={(d) => d < today || d.getDay() === 0}
            initialFocus
            locale={ptBR}
            className="pointer-events-auto"
          />
        </Card>

        <div className="space-y-3">
          {date ? (
            <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Data selecionada
                  </p>
                  <p className="font-semibold text-foreground capitalize mt-0.5">
                    {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-background/60 border border-border p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                        <Building2 className="h-3 w-3" /> Clínicas
                      </div>
                      <p className="text-xl font-bold">
                        {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : preview?.clinics ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background/60 border border-border p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                        <Users className="h-3 w-3" /> Profissionais
                      </div>
                      <p className="text-xl font-bold">
                        {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : preview?.pros ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 border-dashed text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Selecione uma data no calendário ao lado.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Domingos e datas passadas indisponíveis.
              </p>
            </Card>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button
          disabled={!date || (preview?.clinics === 0)}
          onClick={() => date && onSelect(date)}
        >
          Ver profissionais disponíveis
        </Button>
      </div>
    </div>
  );
}
