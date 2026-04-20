import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Save,
  QrCode,
  Loader2,
  AlertCircle,
  Check,
  CircleDot,
  Sparkles,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';
import { LiveMessagesPanel } from '@/components/secretaria-ia/LiveMessagesPanel';

interface AiConfigRow {
  id: string;
  clinic_id: string;
  custom_prompt: string;
  enabled: boolean;
}

const PERSONALITY_OPTIONS: { value: string; label: string; template: string }[] = [
  {
    value: 'acolhedora',
    label: 'Acolhedora e empática',
    template:
      '\n\nPERSONALIDADE:\nSeja acolhedora, gentil e empática. Demonstre cuidado genuíno com o paciente em cada resposta.\n',
  },
  {
    value: 'profissional',
    label: 'Profissional e objetiva',
    template:
      '\n\nPERSONALIDADE:\nSeja profissional, clara e direta. Priorize objetividade sem perder a cordialidade.\n',
  },
  {
    value: 'descontraida',
    label: 'Descontraída e próxima',
    template:
      '\n\nPERSONALIDADE:\nSeja descontraída, próxima e informal. Converse como uma amiga, mantendo respeito e profissionalismo.\n',
  },
  {
    value: 'formal',
    label: 'Formal e cerimoniosa',
    template:
      '\n\nPERSONALIDADE:\nSeja formal e cerimoniosa. Use tratamento respeitoso (senhor/senhora) e linguagem cuidadosa.\n',
  },
];

export default function SecretariaIA() {
  const { currentClinicId } = useAuth();
  const qc = useQueryClient();
  const backendConfigured = isAiBackendConfigured();

  // ---------- Configuração (Supabase) ----------
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['ai-secretary-config', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_secretary_config' as any)
        .select('*')
        .eq('clinic_id', currentClinicId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AiConfigRow) ?? null;
    },
  });

  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [personality, setPersonality] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (config) {
      const p = config.custom_prompt ?? '';
      setPrompt(p);
      setSavedPrompt(p);
      setEnabled(config.enabled);
    }
  }, [config]);

  const PROMPT_CHIPS: { label: string; template: string }[] = [
    {
      label: 'Saudação',
      template:
        'SAUDAÇÃO:\n[Mensagem inicial que a IA envia ao paciente — ex: "Olá! Sou a secretária virtual da clínica. Como posso ajudar você hoje?"]\n',
    },
    {
      label: 'Objetivo',
      template:
        '\n\nOBJETIVO:\n[Descreva aqui o que a IA deve fazer no atendimento — ex: agendar consultas, confirmar presenças, tirar dúvidas]\n',
    },
    {
      label: 'Regras',
      template: '\n\nREGRAS:\n- [Regra 1]\n- [Regra 2]\n- [Regra 3]\n',
    },
    {
      label: 'Restrições',
      template:
        '\n\nRESTRIÇÕES:\n- [O que a IA NUNCA deve fazer]\n- [Outra restrição importante]\n',
    },
    {
      label: 'Exemplos',
      template:
        '\n\nEXEMPLOS DE RESPOSTA:\nPaciente: [pergunta comum]\nResposta: [como a IA deve responder]\n',
    },
    {
      label: 'Horários',
      template:
        '\n\nHORÁRIOS DE ATENDIMENTO:\n- Segunda a Sexta: 08h às 18h\n- Sábado: 08h às 12h\n',
    },
    {
      label: 'Urgências',
      template:
        '\n\nURGÊNCIAS:\n[Como a IA deve agir em casos urgentes — ex: encaminhar para o telefone X, orientar a procurar pronto-atendimento]\n',
    },
  ];

  const insertText = (template: string) => {
    const el = textareaRef.current;
    if (!el) {
      setPrompt((p) => p + template);
      return;
    }
    const start = el.selectionStart ?? prompt.length;
    const end = el.selectionEnd ?? prompt.length;
    const next = prompt.slice(0, start) + template + prompt.slice(end);
    setPrompt(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + template.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handlePersonalityChange = (value: string) => {
    setPersonality(value);
    const opt = PERSONALITY_OPTIONS.find((o) => o.value === value);
    if (opt) insertText(opt.template);
  };

  const isDirty = prompt !== savedPrompt;

  const saveConfig = useMutation({
    mutationFn: async (vars: { custom_prompt: string; enabled: boolean }) => {
      if (!currentClinicId) throw new Error('Clínica não selecionada');
      const { error } = await supabase
        .from('ai_secretary_config' as any)
        .upsert(
          {
            clinic_id: currentClinicId,
            custom_prompt: vars.custom_prompt,
            enabled: vars.enabled,
          },
          { onConflict: 'clinic_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Instruções salvas com sucesso');
      setSavedPrompt(prompt);
      qc.invalidateQueries({ queryKey: ['ai-secretary-config', currentClinicId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const toggleEnabled = (next: boolean) => {
    setEnabled(next);
    saveConfig.mutate({ custom_prompt: prompt, enabled: next });
  };

  // ---------- WhatsApp status ----------
  const statusQuery = useQuery({
    queryKey: ['ai-whatsapp-status', currentClinicId],
    enabled: !!currentClinicId && backendConfigured,
    queryFn: () => aiBackend.getWhatsAppStatus(currentClinicId!),
    refetchInterval: backendConfigured ? 15000 : false,
    retry: 1,
  });

  // ---------- Conexão WhatsApp ----------
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [shouldAutoAdvanceToTraining, setShouldAutoAdvanceToTraining] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const connectMutation = useMutation({
    mutationFn: () => aiBackend.connectWhatsApp(currentClinicId!),
    onSuccess: (data) => {
      // Caso 1: já está conectado — não abre modal
      if (data.connected) {
        qc.setQueryData(['ai-whatsapp-status', currentClinicId], {
          connected: true,
          status: data.status ?? 'connected',
          instance_name: data.instance_name ?? null,
        });
        setShouldAutoAdvanceToTraining(true);
        toast.success('WhatsApp já está conectado!');
        return;
      }
      // Caso 2: veio QR Code — abre modal e inicia polling
      if (data.qr_code) {
        setQrCode(data.qr_code);
        setQrModalOpen(true);
        stopPolling();
        pollRef.current = window.setInterval(async () => {
          try {
            const s = await aiBackend.getWhatsAppStatus(currentClinicId!);
            qc.setQueryData(['ai-whatsapp-status', currentClinicId], s);
            if (s.connected) {
              stopPolling();
              setQrModalOpen(false);
              setShouldAutoAdvanceToTraining(true);
              toast.success('WhatsApp conectado!');
            }
          } catch {
            // ignora erros transitórios durante o polling
          }
        }, 5000);
        return;
      }
      // Caso 3: sem QR e desconectado — erro amigável
      toast.error('Não foi possível gerar o QR Code. Tente novamente.');
    },
    onError: (e: any) =>
      toast.error(e.message ?? 'Não foi possível iniciar a conexão com o WhatsApp'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => aiBackend.disconnectWhatsApp(currentClinicId!),
    onSuccess: () => {
      qc.setQueryData(['ai-whatsapp-status', currentClinicId], {
        connected: false,
        status: 'disconnected',
        instance_name: null,
      });
      qc.invalidateQueries({ queryKey: ['ai-whatsapp-status', currentClinicId] });
      setQrCode(null);
      setShouldAutoAdvanceToTraining(false);
      setStep(1);
      toast.success('WhatsApp desconectado');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao desconectar'),
  });

  const handleQrClose = (open: boolean) => {
    setQrModalOpen(open);
    if (!open) stopPolling();
  };

  const isConnected = !!statusQuery.data?.connected;

  // ---------- Stepper ----------
  type Step = 1 | 2 | 3;
  const [step, setStep] = useState<Step>(1);

  // Avança automaticamente quando WhatsApp conectar
  useEffect(() => {
    if (isConnected && step === 1 && shouldAutoAdvanceToTraining) {
      setStep(2);
      setShouldAutoAdvanceToTraining(false);
    }
  }, [isConnected, shouldAutoAdvanceToTraining, step]);

  const promptCompleted = (savedPrompt?.length ?? 0) > 20;
  const canGoStep2 = isConnected;
  const canGoStep3 = isConnected && promptCompleted;

  const STEPS: { id: Step; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { id: 1, label: 'Conexão', icon: <QrCode className="h-4 w-4" />, enabled: true },
    { id: 2, label: 'Treinamento', icon: <Sparkles className="h-4 w-4" />, enabled: canGoStep2 },
    { id: 3, label: 'Painel', icon: <LayoutDashboard className="h-4 w-4" />, enabled: canGoStep3 },
  ];

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1.5">
          {STEPS.map((s) => {
            const active = step === s.id;
            const done = s.id < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => s.enabled && setStep(s.id)}
                disabled={!s.enabled}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : done
                    ? 'bg-background text-foreground hover:bg-accent'
                    : 'text-muted-foreground hover:bg-background/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : done
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                {active ? (
                  <>
                    {s.icon}
                    {s.label}
                  </>
                ) : (
                  s.icon
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ETAPA 1 — Conexão */}
      {step === 1 && (
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="space-y-1.5 text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Conexão WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Conecte o WhatsApp da sua clínica para ativar a Secretária IA.
            </p>
          </div>

          <Card className="rounded-xl shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  isConnected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'
                }`}
              >
                {isConnected ? <Wifi className="h-7 w-7" /> : <QrCode className="h-7 w-7" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">
                  {isConnected ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
                </h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  {!backendConfigured
                    ? 'Backend da Secretária IA não configurado.'
                    : isConnected
                    ? 'Tudo certo! Sua IA está pronta para receber pacientes.'
                    : 'Escaneie o QR Code com o WhatsApp da clínica para ativar o assistente.'}
                </p>
              </div>

              {/* Status badge */}
              {backendConfigured && (
                <div className="flex flex-col items-center gap-1">
                  {statusQuery.isLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : isConnected ? (
                    <>
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> WhatsApp Conectado
                      </Badge>
                      {statusQuery.data?.instance_name && (
                        <span className="text-xs text-muted-foreground">
                          Instância: {statusQuery.data.instance_name}
                        </span>
                      )}
                    </>
                  ) : statusQuery.isError ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" /> Offline
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <WifiOff className="h-3 w-3" /> Desconectado
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {isConnected ? (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="gap-2"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                      Desconectar
                    </Button>
                    <Button size="lg" onClick={() => setStep(2)} className="gap-2">
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending || !currentClinicId || !backendConfigured}
                    className="gap-2"
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {statusQuery.isError ? 'Tentar novamente' : 'Escanear QR Code'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ETAPA 2 — Treinamento */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Treinamento da IA</h1>
              <p className="text-sm text-muted-foreground">
                Defina como a Secretária IA deve se comportar nas conversas.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
              <Label htmlFor="enabled-switch" className="text-sm">
                {enabled ? 'IA Ativa' : 'IA Pausada'}
              </Label>
              <Switch
                id="enabled-switch"
                checked={enabled}
                onCheckedChange={toggleEnabled}
                disabled={loadingConfig || saveConfig.isPending}
              />
            </div>
          </div>

          <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>System prompt</CardTitle>
                <CardDescription>
                  Escreva livremente as instruções que definem o comportamento da IA.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {saveConfig.isPending ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                  </span>
                ) : saveConfig.isError ? (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-3 w-3" /> Erro ao salvar
                  </span>
                ) : isDirty ? (
                  <span className="flex items-center gap-1.5 text-warning">
                    <CircleDot className="h-3 w-3" /> Alterações não salvas
                  </span>
                ) : savedPrompt ? (
                  <span className="flex items-center gap-1.5 text-success">
                    <Check className="h-3 w-3" /> Salvo
                  </span>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingConfig ? (
              <Skeleton className="h-[420px] w-full" />
            ) : (
              <div className="space-y-4">
                {/* Personalidade */}
                <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                  <Label htmlFor="personality" className="text-sm">
                    Personalidade
                  </Label>
                  <Select value={personality} onValueChange={handlePersonalityChange}>
                    <SelectTrigger id="personality" className="sm:max-w-sm">
                      <SelectValue placeholder="Selecione um estilo de comunicação" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONALITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Chips */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => insertText(chip.template)}
                        disabled={saveConfig.isPending}
                        className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground/80 transition-all hover:border-primary/40 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/80">
                    Clique em um atalho para inserir um bloco de texto. O campo é livre — escreva como preferir.
                  </p>
                </div>

                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={saveConfig.isPending}
                  placeholder="Ex: Você é a secretária virtual da clínica. Sua função é agendar consultas, confirmar presenças e tirar dúvidas dos pacientes de forma acolhedora..."
                  className="min-h-[320px] font-mono text-[14px] leading-relaxed resize-y rounded-lg bg-muted/50 px-4 py-3 transition-colors focus-visible:bg-background"
                />

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">
                    {prompt.length} caracteres
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveConfig.mutate({ custom_prompt: prompt, enabled })}
                      disabled={saveConfig.isPending || loadingConfig || !isDirty}
                      variant="outline"
                      className="gap-2"
                    >
                      {saveConfig.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      onClick={() => {
                        if (isDirty) saveConfig.mutate({ custom_prompt: prompt, enabled });
                        setStep(3);
                      }}
                      disabled={!canGoStep3 && !isDirty}
                      className="gap-2"
                    >
                      Próximo: painel <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* ETAPA 3 — Painel ao vivo */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Painel da IA</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe em tempo real as mensagens recebidas no WhatsApp da clínica.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/secretaria-ia/painel">
                <LayoutDashboard className="h-4 w-4" />
                Configurações avançadas
              </Link>
            </Button>
          </div>
          {currentClinicId && <LiveMessagesPanel clinicId={currentClinicId} />}
        </div>
      )}

      {/* Modal QR Code */}
      <Dialog open={qrModalOpen} onOpenChange={handleQrClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho. Escaneie o
              QR Code abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="h-64 w-64 rounded-lg border bg-white p-2"
              />
            ) : (
              <Skeleton className="h-64 w-64" />
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Aguardando conexão...
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                stopPolling();
                setQrModalOpen(false);
                disconnectMutation.mutate();
              }}
              disabled={disconnectMutation.isPending || !currentClinicId}
              className="gap-2"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              Desconectar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
