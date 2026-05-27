import { useMemo, useState } from 'react';
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
  Undo2,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  connected?: boolean;
}

function toConvId(clinicId: string, phone: string): string {
  const raw = `${clinicId}:${phone}`;
  // base64url
  const b64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(raw)))
    : Buffer.from(raw, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  connected = true,
}: Props) {
  const qc = useQueryClient();
  const [openConversation, setOpenConversation] = useState<Conversation | null>(null);
  const { data: conversations = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ai-conversations', clinicId],
    queryFn: () => fetchConversations(clinicId),
    enabled: !!clinicId && isAiBackendConfigured() && connected,
    refetchInterval: connected ? 5000 : false,
  });

  const takeoverMutation = useMutation({
    mutationFn: (phone: string) =>
      aiBackend.takeoverConversation(clinicId, toConvId(clinicId, phone)),
    onSuccess: () => {
      toast.success('Atendimento assumido — a IA ficou em modo silencioso para esta conversa');
      qc.invalidateQueries({ queryKey: ['ai-conversations', clinicId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível assumir o atendimento'),
  });

  const releaseMutation = useMutation({
    mutationFn: (phone: string) =>
      aiBackend.releaseConversation(clinicId, toConvId(clinicId, phone)),
    onSuccess: () => {
      toast.success('Conversa devolvida para a IA');
      qc.invalidateQueries({ queryKey: ['ai-conversations', clinicId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível devolver para a IA'),
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Atualizando a cada 5s
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
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
                    onOpen={() => setOpenConversation(c)}
                    onTakeover={
                      allowTakeover ? () => takeoverMutation.mutate(c.patient_phone) : undefined
                    }
                    onRelease={
                      allowTakeover ? () => releaseMutation.mutate(c.patient_phone) : undefined
                    }
                    takingOver={
                      takeoverMutation.isPending &&
                      takeoverMutation.variables === c.patient_phone
                    }
                    releasing={
                      releaseMutation.isPending &&
                      releaseMutation.variables === c.patient_phone
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <ConversationThreadDialog
        clinicId={clinicId}
        conversation={openConversation}
        onClose={() => setOpenConversation(null)}
      />
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
  onOpen,
  onTakeover,
  onRelease,
  takingOver,
  releasing,
}: {
  conversation: Conversation;
  onOpen?: () => void;
  onTakeover?: () => void;
  onRelease?: () => void;
  takingOver?: boolean;
  releasing?: boolean;
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
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/50"
    >
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
              onClick={(e) => {
                e.stopPropagation();
                onTakeover();
              }}
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
          {onRelease && isHuman && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onRelease();
              }}
              disabled={releasing}
            >
              {releasing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Undo2 className="h-3 w-3" />
              )}
              Devolver para IA
            </Button>
          )}
        </div>
      </div>
    </button>
  );
}

function ConversationThreadDialog({
  clinicId,
  conversation,
  onClose,
}: {
  clinicId: string;
  conversation: Conversation | null;
  onClose: () => void;
}) {
  const convId = conversation ? toConvId(clinicId, conversation.patient_phone) : null;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-conversation-messages', clinicId, convId],
    queryFn: () => aiBackend.getConversationMessages(clinicId, convId!),
    enabled: !!conversation && !!convId && isAiBackendConfigured(),
    refetchInterval: conversation ? 5000 : false,
  });

  const messages = data?.data ?? [];

  return (
    <Dialog open={!!conversation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {conversation?.patient_name || conversation?.patient_phone || 'Conversa'}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>{conversation?.patient_phone}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-3">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="ml-auto h-16 w-2/3" />
              <Skeleton className="h-16 w-1/2" />
            </div>
          ) : isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {(error as Error)?.message || 'Não foi possível carregar as mensagens.'}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma mensagem nesta conversa.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => {
                const inbound = m.direction === 'inbound';
                const isHuman = m.sender === 'human';
                return (
                  <div
                    key={m.id ?? i}
                    className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        inbound
                          ? 'bg-muted text-foreground'
                          : isHuman
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] opacity-80">
                        {inbound ? (
                          <>
                            <User className="h-3 w-3" />
                            Paciente
                          </>
                        ) : isHuman ? (
                          <>
                            <User className="h-3 w-3" />
                            {m.agent_name || 'Atendente'}
                          </>
                        ) : (
                          <>
                            <Bot className="h-3 w-3" />
                            IA
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {m.at ? format(new Date(m.at), 'dd/MM HH:mm', { locale: ptBR }) : ''}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
