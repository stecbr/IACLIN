import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ShieldCheck, Stethoscope, CalendarRange, ArrowRight, Sparkles } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { BusinessHours } from '@/components/settings/ClinicHoursSection';

interface Props {
  clinicId: string;
}

const WEEKDAYS: (keyof BusinessHours)[] = ['mon','tue','wed','thu','fri','sat','sun'];

export function KnowledgeShortcuts({ clinicId }: Props) {
  const location = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ['ai-knowledge-shortcuts', clinicId],
    queryFn: async () => {
      const [clinic, plans, members, templates] = await Promise.all([
        supabase.from('clinics').select('business_hours').eq('id', clinicId).maybeSingle(),
        supabase.from('insurance_plans').select('id, is_active').eq('clinic_id', clinicId),
        supabase.from('clinic_members').select('id').eq('clinic_id', clinicId),
        supabase
          .from('professional_schedule_template')
          .select('weekday, is_active')
          .eq('clinic_id', clinicId),
      ]);

      const hours = (clinic.data?.business_hours ?? null) as unknown as BusinessHours | null;
      const openDays = hours
        ? WEEKDAYS.filter((d) => hours[d]?.enabled).length
        : 0;
      const activePlans = (plans.data ?? []).filter((p: any) => p.is_active).length;
      const memberCount = (members.data ?? []).length;
      const activeTemplates = (templates.data ?? []).filter((t: any) => t.is_active);
      const weekdaysWithAvail = new Set(activeTemplates.map((t: any) => t.weekday)).size;

      return { openDays, activePlans, memberCount, weekdaysWithAvail };
    },
  });

  const cards = [
    {
      icon: Clock,
      title: 'Horário de funcionamento',
      to: '/settings?section=clinic',
      action: 'Abrir horários',
      summary: isLoading
        ? null
        : data?.openDays
          ? `${data.openDays} ${data.openDays === 1 ? 'dia aberto' : 'dias abertos'}`
          : 'Não configurado',
    },
    {
      icon: ShieldCheck,
      title: 'Convênios',
      to: '/settings?section=insurance',
      action: 'Abrir convênios',
      summary: isLoading
        ? null
        : data?.activePlans
          ? `${data.activePlans} ${data.activePlans === 1 ? 'convênio' : 'convênios'}`
          : '0 convênios — somente particular',
    },
    {
      icon: Stethoscope,
      title: 'Profissionais',
      to: '/clinica/medicos',
      action: 'Abrir Equipe Médica',
      summary: isLoading
        ? null
        : data?.memberCount
          ? `${data.memberCount} ${data.memberCount === 1 ? 'profissional' : 'profissionais'}`
          : 'Nenhum profissional',
    },
    {
      icon: CalendarRange,
      title: 'Disponibilidade',
      to: '/disponibilidade',
      action: 'Abrir Disponibilidade',
      summary: isLoading
        ? null
        : data?.weekdaysWithAvail
          ? `${data.weekdaysWithAvail} de 7 dias com agenda`
          : 'Sem disponibilidade pública',
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">O que a IA já sabe</CardTitle>
              <CardDescription className="mt-1">
                A IA usa essas informações automaticamente. Clique em um card para ajustá-las.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              to={c.to}
              onClick={() => {
                try {
                  const stateRaw = sessionStorage.getItem('iaclin.secretariaIaState');
                  const state = stateRaw ? JSON.parse(stateRaw) : {};
                  sessionStorage.setItem(
                    'iaclin.secretariaIaRestore',
                    JSON.stringify({
                      tab: state.tab ?? 'visao',
                      step: state.step ?? 2,
                      scroll: window.scrollY,
                    }),
                  );
                  sessionStorage.setItem(
                    'iaclin.backNav',
                    JSON.stringify({
                      to: c.to,
                      from: location.pathname + location.search,
                      label: 'Voltar para Secretária IA',
                    }),
                  );
                } catch {}
              }}
              className="group rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.title}</p>
                  {c.summary === null ? (
                    <Skeleton className="mt-1 h-4 w-24" />
                  ) : (
                    <p className="mt-0.5 text-sm text-muted-foreground">{c.summary}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-xs text-primary opacity-80 group-hover:opacity-100">
                    {c.action} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}