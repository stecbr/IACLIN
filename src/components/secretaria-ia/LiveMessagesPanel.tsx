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
  Search,
  X,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AI_BACKEND_URL, aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';

// ── Estado da conversa vindo do backend (state machine) ──────────────────────

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  welcome:           { label: 'Início',            color: 'bg-slate-100 text-slate-600' },
  identify_user:     { label: 'Identificando',      color: 'bg-yellow-100 text-yellow-700' },
  choose_specialty:  { label: 'Especialidade',      color: 'bg-blue-100 text-blue-700' },
  choose_location:   { label: 'Localização',        color: 'bg-blue-100 text-blue-700' },
  choose_insurance:  { label: 'Convênio',           color: 'bg-blue-100 text-blue-700' },
  choose_doctor:     { label: 'Profissional',       color: 'bg-blue-100 text-blue-700' },
  choose_time:       { label: 'Horário',            color: 'bg-indigo-100 text-indigo-700' },
  confirm_schedule:  { label: 'Confirmando',        color: 'bg-orange-100 text-orange-700' },
  scheduled:         { label: 'Agendado ✓',         color: 'bg-green-100 text-green-700' },
  reschedule:        { label: 'Remarcando',         color: 'bg-purple-100 text-purple-700' },
  cancel:            { label: 'Cancelando',         color: 'bg-red-100 text-red-700' },
  human_handoff:     { label: 'Humano',             color: 'bg-amber-100 text-amber-700' },
  faq:               { label: 'Dúvida',             color: 'bg-slate-100 text-slate-600' },
  idle:              { label: 'Inativo',            color: 'bg-slate-100 text-slate-400' },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  clinic_id: string;
  patient_phone: string;
  patient_name: string | null;
  status: string;
  conversation_state?: string;
  message_count: number;
  last_message: {
    direction: 'inbound' | 'outbound';
    text: string;
    at: string;
  } | null;
  last_message_at: string | null;
}

type FilterStatus = 'all' | 'ai' | 'human' | 'scheduled';

interface Props {
  clinicId: string;
  showMetrics?: boolean;
  allowTakeover?: boolean;
  connected?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toConvId(clinicId: string, phone: string): string {
  const raw = `${clinicId}:${phone}`;
  const b64 = btoa(
    Array.from(new TextEncoder().encode(raw), (b) => String.fromCharCode(b)).join('')
  );
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

// ── Componente principal ─────────────────────────────────────────────────────

export function LiveMessagesPanel({
  clinicId,
  showMetrics = true,
  allowTakeover = false,
  connected = true,
}: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

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
      toast.success('Atendimento assumido — IA em modo silencioso para esta conversa');
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
    const handoff = conversations.filter(
      (c) => c.status === 'human' || c.status === 'handoff'
    ).length;
    return { activeToday: activeToday.length, totalMessages, uniquePatients, handoff };
  }, [conversations]);

  const filtered = useMemo(() => {
    let list = [...conversations].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.patient_phone.includes(q) ||
          (c.patient_name ?? '').toLowerCase().includes(q)
      );
    }

    if (filterStatus === 'ai') {
      list = list.filter((c) => c.status !== 'human' && c.status !== 'handoff');
    } else if (filterStatus === 'human') {
      list = list.filter((c) => c.status === 'human' || c.status === 'handoff');
    } else if (filterStatus === 'scheduled') {
      list = list.filter((c) => c.conversation_state === 'scheduled');
    }

    return list;
  }, [conversations, search, filterStatus]);

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
            Clique em uma conversa para ver o histórico completo ao lado
          </CardDescription>

          {/* Busca + filtros */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {(['all', 'ai', 'human', 'scheduled'] as FilterStatus[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filterStatus === f ? 'default' : 'outline'}
                  className="h-8 px-3 text-xs"
                  onClick={() => setFilterStatus(f)}
                >
                  {{ all: 'Todos', ai: 'IA', human: 'Humano', scheduled: 'Agendados' }[f]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className={`flex ${selected ? 'divide-x' : ''}`}>
              {/* Lista de conversas */}
              <div className={selected ? 'w-[42%] min-w-[260px]' : 'w-full'}>
                {filtered.length === 0 ? (
                  <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground p-4">
                    <Clock className="h-6 w-6 opacity-40" />
                    {search || filterStatus !== 'all'
                      ? 'Nenhuma conversa encontrada para este filtro.'
                      : 'Nenhuma conversa ainda. Quando os pacientes começarem a conversar, aparecerão aqui.'}
                  </div>
                ) : (
                  <ScrollArea className={selected ? 'h-[540px]' : 'h-[420px]'}>
                    <div className="divide-y">
                      {filtered.map((c) => (
                        <ConversationRow
                          key={c.id}
                          conversation={c}
                          selected={selected?.id === c.id}
                          compact={!!selected}
                          onOpen={() => setSelected(c)}
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
              </div>

              {/* Painel lateral — histórico da conversa selecionada */}
              {selected && (
                <div className="flex flex-1 flex-col">
                  <ConversationThread
                    clinicId={clinicId}
                    conversation={selected}
                    onClose={() => setSelected(null)}
                    allowTakeover={allowTakeover}
                    onTakeover={() => takeoverMutation.mutate(selected.patient_phone)}
                    onRelease={() => releaseMutation.mutate(selected.patient_phone)}
                    takingOver={
                      takeoverMutation.isPending &&
                      takeoverMutation.variables === selected.patient_phone
                    }
                    releasing={
                      releaseMutation.isPending &&
                      releaseMutation.variables === selected.patient_phone
                    }
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  icon, label, value, hint, loading,
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

// ── ConversationRow ──────────────────────────────────────────────────────────

function ConversationRow({
  conversation,
  selected,
  compact,
  onOpen,
  onTakeover,
  onRelease,
  takingOver,
  releasing,
}: {
  conversation: Conversation;
  selected?: boolean;
  compact?: boolean;
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
  const convState = conversation.conversation_state;
  const stateInfo = convState ? STATE_LABELS[convState] : null;

  const statusBadge = isHuman ? (
    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Humano</Badge>
  ) : (
    <Badge variant="outline" className="h-4 border-primary/40 px-1.5 text-[10px] text-primary">IA</Badge>
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full gap-3 p-3 text-left transition-colors hover:bg-muted/40 focus:outline-none focus:ring-inset focus:ring-2 focus:ring-ring/50 ${
        selected ? 'bg-muted/60' : ''
      }`}
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
          <div className="flex shrink-0 items-center gap-1.5">
            {statusBadge}
            <span className="text-xs text-muted-foreground">{time}</span>
            {selected && <ChevronRight className="h-3.5 w-3.5 text-primary" />}
          </div>
        </div>

        {/* Etapa da conversa */}
        {stateInfo && (
          <span className={`w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium ${stateInfo.color}`}>
            {stateInfo.label}
          </span>
        )}

        {last ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            <span className={isInbound ? '' : 'text-primary/70'}>
              {isInbound ? '' : '→ '}
            </span>
            {last.text}
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Sem mensagens</p>
        )}

        {!compact && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="text-[11px] text-muted-foreground">
              {conversation.message_count} mensagens
            </div>
            {onTakeover && !isHuman && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); onTakeover(); }}
                disabled={takingOver}
              >
                {takingOver ? <Loader2 className="h-3 w-3 animate-spin" /> : <HandHelping className="h-3 w-3" />}
                Assumir
              </Button>
            )}
            {onRelease && isHuman && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); onRelease(); }}
                disabled={releasing}
              >
                {releasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                Devolver IA
              </Button>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ── ConversationThread (painel lateral) ──────────────────────────────────────

function ConversationThread({
  clinicId,
  conversation,
  onClose,
  allowTakeover,
  onTakeover,
  onRelease,
  takingOver,
  releasing,
}: {
  clinicId: string;
  conversation: Conversation;
  onClose: () => void;
  allowTakeover?: boolean;
  onTakeover?: () => void;
  onRelease?: () => void;
  takingOver?: boolean;
  releasing?: boolean;
}) {
  const convId = toConvId(clinicId, conversation.patient_phone);
  const isHuman =
    conversation.status === 'human' || conversation.status === 'handoff';
  const convState = conversation.conversation_state;
  const stateInfo = convState ? STATE_LABELS[convState] : null;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-conversation-messages', clinicId, convId],
    queryFn: () => aiBackend.getConversationMessages(clinicId, convId),
    enabled: !!convId && isAiBackendConfigured(),
    refetchInterval: 5000,
  });

  const messages = data?.data ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Header do painel */}
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {conversation.patient_name || conversation.patient_phone}
            </p>
            {stateInfo && (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${stateInfo.color}`}>
                {stateInfo.label}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{conversation.patient_phone}</p>
          <p className="text-xs text-muted-foreground">{conversation.message_count} mensagens</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {allowTakeover && !isHuman && onTakeover && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={onTakeover}
              disabled={takingOver}
            >
              {takingOver ? <Loader2 className="h-3 w-3 animate-spin" /> : <HandHelping className="h-3 w-3" />}
              Assumir
            </Button>
          )}
          {allowTakeover && isHuman && onRelease && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={onRelease}
              disabled={releasing}
            >
              {releasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
              Devolver IA
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mensagens */}
      <ScrollArea className="h-[480px] flex-1 px-4 py-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="ml-auto h-14 w-2/3" />
            <Skeleton className="h-14 w-1/2" />
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
          <div className="flex flex-col gap-2">
            {messages.map((m, i) => {
              const inbound = m.direction === 'inbound';
              const byHuman = m.sender === 'human';
              return (
                <div key={m.id ?? i} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                      inbound
                        ? 'bg-muted text-foreground'
                        : byHuman
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    <div className="mb-0.5 flex items-center gap-1.5 text-[10px] opacity-75">
                      {inbound ? (
                        <><User className="h-3 w-3" />Paciente</>
                      ) : byHuman ? (
                        <><User className="h-3 w-3" />{m.agent_name || 'Atendente'}</>
                      ) : (
                        <><Bot className="h-3 w-3" />IA</>
                      )}
                      <span>·</span>
                      <span>{m.at ? format(new Date(m.at), 'HH:mm', { locale: ptBR }) : ''}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
