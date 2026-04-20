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
  MessageCircle,
  Settings2,
  Activity,
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
  const [promptOpen, setPromptOpen] = useState(false);
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
            toast.success('WhatsApp conectado!');
          }
        } catch {
          // ignora erros transitórios durante o polling
        }
      }, 5000);
    },
    onError: (e: any) =>
      toast.error(e.message ?? 'Não foi possível iniciar a conexão com o WhatsApp'),
  });

  const handleQrClose = (open: boolean) => {
    setQrModalOpen(open);
    if (!open) stopPolling();
  };

  const isConnected = !!statusQuery.data?.connected;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card WhatsApp */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Conexão WhatsApp</CardTitle>
                <CardDescription>
                  Status da conexão com o WhatsApp da clínica
                </CardDescription>
              </div>
              {!backendConfigured ? (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Não configurado
                </Badge>
              ) : statusQuery.isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : statusQuery.isError ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Offline
                </Badge>
              ) : isConnected ? (
                <Badge className="gap-1 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                  <Wifi className="h-3 w-3" /> Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <WifiOff className="h-3 w-3" /> Desconectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!backendConfigured && (
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                Backend da Secretária IA não configurado.
              </div>
            )}
            {backendConfigured && statusQuery.isError && (
              <p className="text-sm text-muted-foreground">
                Não foi possível conectar ao serviço da IA. Verifique sua internet
                e tente novamente.
              </p>
            )}
            {backendConfigured && !statusQuery.isError && (
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? 'Tudo certo! Sua IA está pronta para responder pacientes.'
                  : 'Conecte o WhatsApp da clínica para a IA começar a atender.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !currentClinicId || !backendConfigured}
                variant={isConnected ? 'outline' : 'default'}
                className="gap-2"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isConnected ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                {isConnected ? 'Reconectar' : 'Conectar WhatsApp'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card Ativar/Desativar */}
        <Card>
          <CardHeader>
            <CardTitle>Status da secretária</CardTitle>
            <CardDescription>Ative para que a IA responda automaticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="enabled-switch" className="text-base">
                  {enabled ? 'Ativa' : 'Pausada'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? 'A IA está respondendo aos pacientes'
                    : 'Nenhuma resposta automática será enviada'}
                </p>
              </div>
              <Switch
                id="enabled-switch"
                checked={enabled}
                onCheckedChange={toggleEnabled}
                disabled={loadingConfig || saveConfig.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações: abrir prompt e ir para painel */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setPromptOpen((v) => !v)}
          variant={promptOpen ? 'outline' : 'default'}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {promptOpen ? 'Fechar instruções' : 'Configurar instruções da IA'}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${promptOpen ? 'rotate-180' : ''}`}
          />
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/secretaria-ia/painel">
            <LayoutDashboard className="h-4 w-4" />
            Abrir painel da IA
          </Link>
        </Button>
      </div>

      {/* Card System Prompt — colapsável */}
      {promptOpen && (
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
                  <Button
                    onClick={() => saveConfig.mutate({ custom_prompt: prompt, enabled })}
                    disabled={saveConfig.isPending || loadingConfig || !isDirty}
                    className="gap-2"
                  >
                    {saveConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
