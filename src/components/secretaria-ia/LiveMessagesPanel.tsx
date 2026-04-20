import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, User, MessageSquare, Activity, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppMessage {
  id: string;
  clinic_id: string;
  patient_phone: string;
  patient_name: string | null;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  handled_by: 'ai' | 'human' | 'system';
  status: string;
  created_at: string;
}

interface Props {
  clinicId: string;
}

export function LiveMessagesPanel({ clinicId }: Props) {
  const [liveMessages, setLiveMessages] = useState<WhatsAppMessage[]>([]);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Carga inicial: últimas 100 mensagens
  const { data: initial, isLoading } = useQuery({
    queryKey: ['whatsapp-messages-initial', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_messages' as any)
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data as unknown) as WhatsAppMessage[]) ?? [];
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (initial) setLiveMessages([...initial].reverse());
  }, [initial]);

  // Realtime subscription
  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel(`whatsapp-messages-${clinicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          const msg = payload.new as WhatsAppMessage;
          setLiveMessages((prev) => [...prev, msg].slice(-200));
          requestAnimationFrame(() => {
            feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId]);

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const last24 = liveMessages.filter((m) => new Date(m.created_at).getTime() >= todayMs);
    const inbound = last24.filter((m) => m.direction === 'inbound').length;
    const outbound = last24.filter((m) => m.direction === 'outbound').length;
    const aiHandled = last24.filter((m) => m.direction === 'outbound' && m.handled_by === 'ai').length;
    const humanHandled = last24.filter((m) => m.handled_by === 'human').length;
    const uniquePatients = new Set(last24.map((m) => m.patient_phone)).size;
    const aiRate = outbound > 0 ? Math.round((aiHandled / outbound) * 100) : 0;

    // Distribuição por hora (últimas 24h)
    const byHour: number[] = Array(24).fill(0);
    last24.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      byHour[h] += 1;
    });
    const maxHour = Math.max(...byHour, 1);

    return { inbound, outbound, aiHandled, humanHandled, uniquePatients, aiRate, byHour, maxHour };
  }, [liveMessages]);

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Mensagens hoje"
          value={metrics.inbound + metrics.outbound}
          hint={`${metrics.inbound} recebidas · ${metrics.outbound} enviadas`}
          loading={isLoading}
        />
        <MetricCard
          icon={<Bot className="h-4 w-4" />}
          label="Resolvidas pela IA"
          value={`${metrics.aiRate}%`}
          hint={`${metrics.aiHandled} de ${metrics.outbound} respostas`}
          loading={isLoading}
        />
        <MetricCard
          icon={<User className="h-4 w-4" />}
          label="Pacientes únicos"
          value={metrics.uniquePatients}
          hint="conversas ativas hoje"
          loading={isLoading}
        />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Encaminhadas"
          value={metrics.humanHandled}
          hint="para atendimento humano"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gráfico por hora */}
        <Card className="rounded-xl shadow-sm lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Atividade por hora</CardTitle>
            </div>
            <CardDescription>Mensagens nas últimas 24h</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="flex h-40 items-end gap-1">
                {metrics.byHour.map((count, h) => (
                  <div
                    key={h}
                    className="group relative flex-1 rounded-t bg-primary/20 transition-all hover:bg-primary/40"
                    style={{ height: `${(count / metrics.maxHour) * 100}%`, minHeight: '2px' }}
                    title={`${h}h: ${count} msgs`}
                  >
                    {h % 6 === 0 && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                        {h}h
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feed ao vivo */}
        <Card className="rounded-xl shadow-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Feed ao vivo</CardTitle>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Tempo real
              </Badge>
            </div>
            <CardDescription>
              Mensagens conforme chegam no WhatsApp da clínica
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[420px] w-full" />
            ) : liveMessages.length === 0 ? (
              <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Clock className="h-6 w-6 opacity-40" />
                Nenhuma mensagem ainda. Quando os pacientes começarem a conversar, aparecerão aqui em tempo real.
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <div ref={feedRef} className="space-y-3">
                  {liveMessages.map((m) => (
                    <MessageRow key={m.id} message={m} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
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

function MessageRow({ message }: { message: WhatsAppMessage }) {
  const isInbound = message.direction === 'inbound';
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR });
  return (
    <div className={`flex gap-3 ${isInbound ? '' : 'flex-row-reverse'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isInbound ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'
        }`}
      >
        {isInbound ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`flex max-w-[75%] flex-col gap-1 ${isInbound ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {isInbound ? message.patient_name || message.patient_phone : 'IA'}
          </span>
          {!isInbound && message.handled_by === 'human' && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              Humano
            </Badge>
          )}
          <span>{time}</span>
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isInbound
              ? 'bg-muted text-foreground'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}