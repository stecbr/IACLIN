import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Settings2,
  Activity,
  MessageSquare,
  Wifi,
  WifiOff,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Loader2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';

interface AiConfigRow {
  enabled: boolean;
  custom_prompt: string | null;
  updated_at: string;
}

export default function SecretariaIAPainel() {
  const { currentClinicId } = useAuth();
  const backendConfigured = isAiBackendConfigured();

  // Status WhatsApp
  const statusQuery = useQuery({
    queryKey: ['ai-whatsapp-status', currentClinicId],
    enabled: !!currentClinicId && backendConfigured,
    queryFn: () => aiBackend.getWhatsAppStatus(currentClinicId!),
    refetchInterval: backendConfigured ? 15000 : false,
    retry: 1,
  });

  // Configuração da IA
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['ai-secretary-config', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_secretary_config' as any)
        .select('enabled, custom_prompt, updated_at')
        .eq('clinic_id', currentClinicId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AiConfigRow) ?? null;
    },
  });

  // Notificações recentes (proxy para "atividade" da IA)
  const { data: notifications, isLoading: loadingNotifs } = useQuery({
    queryKey: ['ai-recent-notifications', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, type')
        .eq('clinic_id', currentClinicId!)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const isConnected = !!statusQuery.data?.connected;
  const aiEnabled = !!config?.enabled;
  const promptLength = config?.custom_prompt?.length ?? 0;
  const lastUpdated = config?.updated_at
    ? formatDistanceToNow(new Date(config.updated_at), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/secretaria-ia">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel da IA</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o desempenho e configure sua secretária virtual.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Wifi className="h-3.5 w-3.5" /> WhatsApp
            </CardDescription>
            <CardTitle className="text-base">
              {!backendConfigured ? (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Não configurado
                </Badge>
              ) : statusQuery.isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : isConnected ? (
                <Badge className="gap-1 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                  <Wifi className="h-3 w-3" /> Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <WifiOff className="h-3 w-3" /> Desconectado
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Estado da IA
            </CardDescription>
            <CardTitle className="text-base">
              {loadingConfig ? (
                <Skeleton className="h-6 w-20" />
              ) : aiEnabled ? (
                <Badge className="gap-1 bg-success/15 text-success border border-success/30 hover:bg-success/20">
                  <CheckCircle2 className="h-3 w-3" /> Ativa
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <PauseCircle className="h-3 w-3" /> Pausada
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" /> Instruções
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {loadingConfig ? <Skeleton className="h-7 w-16" /> : `${promptLength}`}
            </CardTitle>
            <p className="text-xs text-muted-foreground">caracteres no prompt</p>
          </CardHeader>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" /> Última atualização
            </CardDescription>
            <CardTitle className="text-base">
              {loadingConfig ? (
                <Skeleton className="h-6 w-28" />
              ) : lastUpdated ? (
                <span className="text-sm font-medium text-foreground">{lastUpdated}</span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Atividade recente + Configurações avançadas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-xl shadow-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Atividade recente</CardTitle>
            </div>
            <CardDescription>
              Últimos eventos da clínica que a IA pode acompanhar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingNotifs ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Loader2 className="h-5 w-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade recente.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[320px] pr-3">
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg border border-border/60 bg-background p-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {n.title}
                          </p>
                          {n.message && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {n.message}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {n.type}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground/80 mt-2">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Configurações avançadas</CardTitle>
            </div>
            <CardDescription>
              Ajustes que vamos liberar aos poucos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { title: 'Horários de resposta automática', desc: 'Definir janela de atendimento da IA.' },
              { title: 'Encaminhamento humano', desc: 'Transferir para atendente em palavras-chave.' },
              { title: 'Modelos de mensagem', desc: 'Templates para confirmação, lembrete e retorno.' },
              { title: 'Limites e segurança', desc: 'Restrições de tópicos e palavras proibidas.' },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-dashed border-border/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Em breve
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
