import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, UserCog, Bot, Zap, ArrowRight, MessageSquare } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AI_BACKEND_URL, isAiBackendConfigured } from '@/lib/aiBackend';

interface Conversation {
  patient_phone: string;
  status: string;
  last_message_at: string | null;
}

async function fetchConversations(clinicId: string): Promise<Conversation[]> {
  if (!AI_BACKEND_URL) throw new Error('Backend da Secretária IA não configurado.');
  const res = await fetch(`${AI_BACKEND_URL}/api/clinics/${clinicId}/conversations`, {
    headers: { 'bypass-tunnel-reminder': 'true' },
  });
  if (!res.ok) throw new Error(`Backend IA respondeu ${res.status}`);
  const json = await res.json();
  const data = json?.data;
  return (Array.isArray(data) ? data : []) as Conversation[];
}

interface Props {
  clinicId: string | null | undefined;
  backendConfigured: boolean;
  onNavigate: (tab: string) => void;
}

const QUICK_LINKS: Array<{
  tab: string;
  label: string;
  description: string;
  icon: typeof Bot;
  soon?: boolean;
}> = [
  {
    tab: 'comportamento',
    label: 'Comportamento',
    description: 'Personalidade e instruções da IA',
    icon: Bot,
  },
  {
    tab: 'automacoes',
    label: 'Automações',
    description: 'Lembretes, NPS e mensagens automáticas',
    icon: Zap,
    soon: true,
  },
  {
    tab: 'handoff',
    label: 'Atendimento humano',
    description: 'Encaminhamento para a equipe',
    icon: UserCog,
  },
];

export function OverviewMetrics({ clinicId, backendConfigured, onNavigate }: Props) {
  const enabled = !!clinicId && backendConfigured && isAiBackendConfigured();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['ai-conversations', clinicId],
    queryFn: () => fetchConversations(clinicId as string),
    enabled,
    refetchInterval: 10000,
  });

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const activeToday = conversations.filter((c) => {
      const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      return t >= todayMs;
    }).length;
    const handoff = conversations.filter(
      (c) => c.status === 'human' || c.status === 'handoff',
    ).length;
    return { activeToday, handoff };
  }, [conversations]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Conversas hoje"
          value={metrics.activeToday}
          hint="com atividade nas últimas 24h"
          loading={isLoading && enabled}
          disabled={!enabled}
        />
        <MetricCard
          icon={<UserCog className="h-4 w-4" />}
          label="Em atendimento humano"
          value={metrics.handoff}
          hint="encaminhadas pela IA"
          loading={isLoading && enabled}
          disabled={!enabled}
        />
      </div>

      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
          <CardTitle className="text-base">Acesso rápido</CardTitle>
          <CardDescription>Pule direto para configurar cada parte da IA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 p-3 sm:grid-cols-3 sm:p-6">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.tab}
                type="button"
                onClick={() => onNavigate(link.tab)}
                className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 overflow-hidden"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{link.label}</span>
                    {link.soon && (
                      <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                        em breve
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{link.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  loading?: boolean;
  disabled?: boolean;
}

function MetricCard({ icon, label, value, hint, loading, disabled }: MetricCardProps) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-semibold tabular-nums">
            {disabled ? <span className="text-muted-foreground">—</span> : value}
          </div>
        )}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" /> {hint}
        </p>
      </CardContent>
    </Card>
  );
}