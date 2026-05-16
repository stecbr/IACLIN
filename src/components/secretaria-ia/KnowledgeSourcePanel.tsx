import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Users,
  ShieldCheck,
  DoorOpen,
  ExternalLink,
  Stethoscope,
  Globe,
  CalendarRange,
  Wallet,
  CheckCircle2,
  CircleSlash,
  Sparkles,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import type { BusinessHours } from '@/components/settings/ClinicHoursSection';

interface Props {
  clinicId: string;
}

const DAY_LABELS_SHORT: Record<keyof BusinessHours, string> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
};
const WEEKDAY_ORDER: (keyof BusinessHours)[] = ['mon','tue','wed','thu','fri','sat','sun'];

function summarizeHours(h: BusinessHours | null): { open: string[]; closed: string[] } {
  if (!h) return { open: [], closed: [] };
  const open: string[] = [];
  const closed: string[] = [];
  WEEKDAY_ORDER.forEach((d) => {
    if (h[d]?.enabled) open.push(`${DAY_LABELS_SHORT[d]} ${h[d].open}–${h[d].close}`);
    else closed.push(DAY_LABELS_SHORT[d]);
  });
  return { open, closed };
}

export function KnowledgeSourcePanel({ clinicId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-knowledge-source', clinicId],
    queryFn: async () => {
      const [clinic, members, plans, rooms, templates] = await Promise.all([
        supabase.from('clinics').select('business_hours, name').eq('id', clinicId).maybeSingle(),
        supabase.from('clinic_members').select('id, user_id, role, specialty').eq('clinic_id', clinicId),
        supabase.from('insurance_plans').select('id, name, type, is_active').eq('clinic_id', clinicId),
        supabase.from('clinic_rooms').select('id, name, is_active').eq('clinic_id', clinicId),
        supabase
          .from('professional_schedule_template')
          .select('user_id, weekday, start_time, end_time, mode, accepted_plan_ids, breaks, is_active')
          .eq('clinic_id', clinicId),
      ]);

      const memberIds = (members.data ?? []).map((m) => m.id);
      let extraSpecs: { clinic_member_id: string; specialty: string }[] = [];
      if (memberIds.length) {
        const { data: cms } = await supabase
          .from('clinic_member_specialties')
          .select('clinic_member_id, specialty')
          .in('clinic_member_id', memberIds);
        extraSpecs = cms ?? [];
      }

      // Specialties: union from clinic_members.specialty + clinic_member_specialties
      const specMap = new Map<string, Set<string>>(); // specialty -> userIds
      (members.data ?? []).forEach((m: any) => {
        if (m.specialty) {
          const set = specMap.get(m.specialty) ?? new Set();
          set.add(m.user_id);
          specMap.set(m.specialty, set);
        }
      });
      const memberById = new Map((members.data ?? []).map((m: any) => [m.id, m.user_id]));
      extraSpecs.forEach((s) => {
        const uid = memberById.get(s.clinic_member_id);
        if (!uid) return;
        const set = specMap.get(s.specialty) ?? new Set();
        set.add(uid as string);
        specMap.set(s.specialty, set);
      });
      const specialties = Array.from(specMap.entries())
        .map(([name, ids]) => ({ name, count: ids.size }))
        .sort((a, b) => b.count - a.count);

      // Plans
      const activePlans = (plans.data ?? []).filter((p: any) => p.is_active);
      const dental = activePlans.filter((p: any) => p.type === 'dental');
      const health = activePlans.filter((p: any) => p.type !== 'dental');

      // Templates → mode + availability
      const tpls = (templates.data ?? []).filter((t: any) => t.is_active);
      const modes = new Set(tpls.map((t: any) => t.mode));
      const weekdaysWithTpl = new Set(tpls.map((t: any) => t.weekday));
      const earliest = tpls.reduce<string | null>((acc, t: any) => (!acc || t.start_time < acc ? t.start_time : acc), null);
      const latest = tpls.reduce<string | null>((acc, t: any) => (!acc || t.end_time > acc ? t.end_time : acc), null);
      const breaksCount = tpls.reduce((acc, t: any) => acc + ((t.breaks as any[])?.length ?? 0), 0);
      const planIdsAccepted = new Set<string>();
      tpls.forEach((t: any) => (t.accepted_plan_ids ?? []).forEach((id: string) => planIdsAccepted.add(id)));

      return {
        hours: (clinic.data?.business_hours ?? null) as unknown as BusinessHours | null,
        members: members.data ?? [],
        plans: activePlans,
        dentalPlans: dental,
        healthPlans: health,
        rooms: (rooms.data ?? []).filter((r: any) => r.is_active),
        specialties,
        modes,
        templatesCount: tpls.length,
        weekdaysWithTpl: weekdaysWithTpl.size,
        earliest,
        latest,
        breaksCount,
        acceptedPlansInAgenda: planIdsAccepted.size,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const hoursSummary = summarizeHours(data?.hours ?? null);
  const modes = data?.modes ?? new Set<string>();
  const hasParticular = modes.has('particular') || modes.has('ambos');
  const hasConvenio = modes.has('convenio') || modes.has('ambos');
  const modeLabel = hasParticular && hasConvenio
    ? 'Particular e Convênio'
    : hasConvenio
      ? 'Somente Convênio'
      : hasParticular
        ? 'Somente Particular'
        : 'Não configurado';
  const onlineAgendaActive = (data?.templatesCount ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <Card className="rounded-xl border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Mapa operacional da Secretaria IA</CardTitle>
              <CardDescription className="mt-1">
                Tudo que a IA já sabe automaticamente sobre este workspace. Estes dados vêm direto do sistema —
                você não precisa repetir nada manualmente.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Modo de atendimento + Agenda online */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          icon={<Wallet className="h-4 w-4" />}
          title="Modo de atendimento"
          source="Vindo da disponibilidade"
        >
          <div className="flex items-center gap-3">
            <Badge variant={modeLabel === 'Não configurado' ? 'outline' : 'default'} className="text-sm py-1 px-3">
              {modeLabel}
            </Badge>
            {modes.size === 0 && (
              <span className="text-xs text-muted-foreground">Configure em Disponibilidade</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A IA usa isto para perguntar ao paciente se o atendimento será particular ou por convênio antes de oferecer horários.
          </p>
        </SectionCard>

        <SectionCard
          icon={<Globe className="h-4 w-4" />}
          title="Agenda online"
          source="Vindo da disponibilidade"
        >
          <div className="flex items-center gap-2">
            {onlineAgendaActive ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">Ativa no Marketplace</span>
                <Badge variant="secondary" className="ml-auto">{data?.templatesCount} regras</Badge>
              </>
            ) : (
              <>
                <CircleSlash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sem disponibilidade pública</span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A IA só oferece horários quando há disponibilidade configurada para a clínica.
          </p>
        </SectionCard>
      </div>

      {/* Especialidades */}
      <SectionCard
        icon={<Stethoscope className="h-4 w-4" />}
        title="Especialidades"
        source="Sincronizado da equipe"
        right={<Badge variant="secondary">{data?.specialties.length ?? 0}</Badge>}
      >
        {data && data.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.specialties.map((s) => (
              <div key={s.name} className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">· {s.count} profissional{s.count > 1 ? 'is' : ''}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint label="Nenhuma especialidade cadastrada" actionTo="/clinica/medicos" actionLabel="Gerenciar equipe" />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          A IA usa as especialidades para identificar o tipo de atendimento, filtrar profissionais e organizar o encaminhamento.
        </p>
      </SectionCard>

      {/* Convênios */}
      <SectionCard
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Convênios aceitos"
        source="Vindo da clínica"
        right={<Badge variant="secondary">{data?.plans.length ?? 0}</Badge>}
      >
        {data && data.plans.length > 0 ? (
          <div className="space-y-3">
            {data.healthPlans.length > 0 && (
              <PlanGroup label="Saúde" plans={data.healthPlans} />
            )}
            {data.dentalPlans.length > 0 && (
              <PlanGroup label="Odontológico" plans={data.dentalPlans} />
            )}
            {data.acceptedPlansInAgenda > 0 && (
              <p className="text-xs text-muted-foreground">
                {data.acceptedPlansInAgenda} convênio{data.acceptedPlansInAgenda > 1 ? 's' : ''} vinculado{data.acceptedPlansInAgenda > 1 ? 's' : ''} a horários da agenda.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Somente atendimento particular.</p>
            <p className="mt-1 text-xs text-muted-foreground">Nenhum convênio cadastrado para esta clínica.</p>
          </div>
        )}
      </SectionCard>

      {/* Disponibilidade */}
      <SectionCard
        icon={<CalendarRange className="h-4 w-4" />}
        title="Disponibilidade"
        source="Vindo da agenda"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Horário oficial da clínica" value={hoursSummary.open.length ? `${hoursSummary.open.length} dias abertos` : 'Não configurado'} />
          <Stat label="Dias com agenda ativa" value={`${data?.weekdaysWithTpl ?? 0} de 7`} />
          <Stat
            label="Janela de atendimento"
            value={data?.earliest && data?.latest ? `${data.earliest.slice(0,5)} – ${data.latest.slice(0,5)}` : '—'}
          />
          <Stat label="Pausas/intervalos" value={`${data?.breaksCount ?? 0}`} />
        </div>
        {hoursSummary.open.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hoursSummary.open.map((s) => (
              <Badge key={s} variant="outline" className="text-[11px] font-normal">{s}</Badge>
            ))}
          </div>
        )}
        <Separator className="my-3" />
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/availability"><ExternalLink className="h-3.5 w-3.5" /> Editar disponibilidade</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/settings"><ExternalLink className="h-3.5 w-3.5" /> Horário da clínica</Link>
          </Button>
        </div>
      </SectionCard>

      {/* Profissionais + Salas */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          icon={<Users className="h-4 w-4" />}
          title="Profissionais vinculados"
          source="Sincronizado da equipe"
          right={<Badge variant="secondary">{data?.members.length ?? 0}</Badge>}
        >
          {data && data.members.length > 0 ? (
            <ul className="space-y-1.5">
              {data.members.slice(0, 6).map((m: any) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border border-border/50 bg-background px-3 py-1.5 text-xs">
                  <span className="truncate">{m.specialty ?? 'Sem especialidade'}</span>
                  <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                </li>
              ))}
              {data.members.length > 6 && (
                <li className="text-xs text-muted-foreground">+ {data.members.length - 6} outros</li>
              )}
            </ul>
          ) : (
            <EmptyHint label="Nenhum profissional vinculado" actionTo="/clinica/medicos" actionLabel="Adicionar" />
          )}
        </SectionCard>

        <SectionCard
          icon={<DoorOpen className="h-4 w-4" />}
          title="Salas / consultórios"
          source="Vindo da clínica"
          right={<Badge variant="secondary">{data?.rooms.length ?? 0}</Badge>}
        >
          {data && data.rooms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {data.rooms.map((r: any) => (
                <Badge key={r.id} variant="outline" className="text-[11px] font-normal">{r.name}</Badge>
              ))}
            </div>
          ) : (
            <EmptyHint label="Nenhuma sala cadastrada" actionTo="/settings" actionLabel="Configurações" />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  icon, title, source, right, children,
}: { icon: React.ReactNode; title: string; source: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="rounded-xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2 text-foreground/70">{icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">{title}</CardTitle>
              {right}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Database className="h-3 w-3" /> {source}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function PlanGroup({ label, plans }: { label: string; plans: { id: string; name: string }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {plans.map((p) => (
          <Badge key={p.id} variant="secondary" className="text-[11px] font-normal">{p.name}</Badge>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ label, actionTo, actionLabel }: { label: string; actionTo: string; actionLabel: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-xs">
        <Link to={actionTo}><ExternalLink className="h-3 w-3" /> {actionLabel}</Link>
      </Button>
    </div>
  );
}