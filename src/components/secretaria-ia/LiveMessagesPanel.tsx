import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  User,
  MessageSquare,
  Activity,
  Clock,
  Users,
  HandHelping,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AI_BACKEND_URL, aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';

interface Conversation {
  id: string;
  clinic_id: string;
  patient_phone: string;
  patient_name: string | null;
  status: string;
  message_count: number;
  last_message: {
    direction: 'inbound' | 'outbound';
    text: string;
    at: string;
  } | null;
  last_message_at: string | null;
}

interface Props {
  clinicId: string;
  showMetrics?: boolean;
  allowTakeover?: boolean;
}

async function fetchConversations(clinicId: string): Promise<Conversation[]> {
  if (!AI_BACKEND_URL) throw new Error('Backend da Secretária IA não configurado.');
  const res = await fetch(`${AI_BACKEND_URL}/api/clinics/${clinicId}/conversations`, {
    headers: { 'bypass-tunnel-reminder': 'true' },
  });
  if (!res.ok) throw new Error(`Backend IA respondeu ${res.status}`);
  const json = await res.json();
  return (json?.data ?? []) as Conversation[];
}

export function LiveMessagesPanel({
  clinicId,
  showMetrics = true,
  allowTakeover = false,
}: Props) {
  const qc = useQueryClient();
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['ai-conversations', clinicId],
    queryFn: () => fetchConversations(clinicId),
    enabled: !!clinicId && isAiBackendConfigured(),
    refetchInterval: 5000,
  });

  const takeoverMutation = useMutation({
    mutationFn: (conversationId: string) =>
      aiBackend.takeoverConversation(clinicId, conversationId),
    onSuccess: () => {
      toast.success('Atendimento assumido — a IA ficou em modo silencioso para esta conversa');
      qc.invalidateQueries({ queryKey: ['ai-conversations', clinicId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível assumir o atendimento'),
  });

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const activeToday = conversations.filter((c) => {
      const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      return t >= todayMs;
    });

    const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0);
    const uniquePatients = new Set(conversations.map((c) => c.patient_phone)).size;
    const handoff = conversations.filter((c) => c.status === 'human' || c.status === 'handoff').length;

    return {
      activeToday: activeToday.length,
      totalMessages,
      uniquePatients,
      handoff,
    };
  }, [conversations]);

  // Mais recentes primeiro
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
  }, [conversations]);

  return (
    <div className="space-y-6">
      {showMetrics && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Mensagens totais"
          value={metrics.totalMessages}
          hint={`em ${conversations.length} conversas`}
          loading={isLoading}
        />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Conversas hoje"
          value={metrics.activeToday}
          hint="com atividade nas últimas 24h"
          loading={isLoading}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Pacientes únicos"
          value={metrics.uniquePatients}
          hint="contatos distintos"
          loading={isLoading}
        />
        <MetricCard
          icon={<User className="h-4 w-4" />}
          label="Em atendimento humano"
          value={metrics.handoff}
          hint="encaminhadas pela IA"
          loading={isLoading}
        />
      </div>
      )}

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Conversas ao vivo</CardTitle>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Atualizando a cada 5s
            </Badge>
          </div>
          <CardDescription>
            Última mensagem de cada conversa do WhatsApp da clínica
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : sorted.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Clock className="h-6 w-6 opacity-40" />
              Nenhuma conversa ainda. Quando os pacientes começarem a conversar, aparecerão aqui.
            </div>
          ) : (
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-3">
                {sorted.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    onTakeover={
                      allowTakeover ? () => takeoverMutation.mutate(c.id) : undefined
                    }
                    takingOver={takeoverMutation.isPending && takeoverMutation.variables === c.id}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ConversationRow({
  conversation,
  onTakeover,
  takingOver,
}: {
  conversation: Conversation;
  onTakeover?: () => void;
  takingOver?: boolean;
}) {
  const last = conversation.last_message;
  const isInbound = last?.direction === 'inbound';
  const time = last?.at
    ? format(new Date(last.at), 'dd/MM HH:mm', { locale: ptBR })
    : conversation.last_message_at
    ? format(new Date(conversation.last_message_at), 'dd/MM HH:mm', { locale: ptBR })
    : '';

  const status = conversation.status;
  const isHuman = status === 'human' || status === 'handoff';
  const isClosed = status === 'closed' || status === 'ended' || status === 'finished';
  const statusBadge = isHuman ? (
    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Humano</Badge>
  ) : isClosed ? (
    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">Encerrado</Badge>
  ) : (
    <Badge variant="outline" className="h-4 border-primary/40 px-1.5 text-[10px] text-primary">IA</Badge>
  );

  return (
    <div className="flex gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isInbound ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'
        }`}
      >
        {isInbound ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {conversation.patient_name || conversation.patient_phone}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {statusBadge}
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
        </div>
        {last ? (
          <div className="flex items-start gap-2">
            <Badge
              variant="outline"
              className={`h-4 shrink-0 px-1.5 text-[10px] ${
                isInbound ? '' : 'border-primary/40 text-primary'
              }`}
            >
              {isInbound ? 'Paciente' : 'IA'}
            </Badge>
            <p className="line-clamp-2 text-sm text-muted-foreground">{last.text}</p>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">Sem mensagens</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {conversation.message_count} mensagens
          </div>
          {onTakeover && !isHuman && !isClosed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={onTakeover}
              disabled={takingOver}
            >
              {takingOver ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <HandHelping className="h-3 w-3" />
              )}
              Assumir atendimento
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
