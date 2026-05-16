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
import { useAiContext } from '@/hooks/useAiContext';
import { KnowledgeSourcePanel } from '@/components/secretaria-ia/KnowledgeSourcePanel';

interface AiConfigRow {
  id: string;
  clinic_id: string | null;
  ai_tenant_id: string | null;
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

// Seções independentes do prompt. Cada uma tem um placeholder de exemplo
// que aparece somente quando o campo está vazio e some assim que o usuário
// começa a escrever.
type PromptSectionKey =
  | 'saudacao'
  | 'objetivo'
  | 'regras'
  | 'restricoes'
  | 'exemplos';

const PROMPT_SECTIONS: {
  key: PromptSectionKey;
  label: string;
  heading: string;
  description: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: 'saudacao',
    label: 'Saudação',
    heading: 'SAUDAÇÃO',
    description: 'Mensagem inicial que a IA envia ao paciente.',
    placeholder:
      'Ex: Olá! Sou a secretária virtual da clínica. Como posso ajudar você hoje?',
    rows: 3,
  },
  {
    key: 'objetivo',
    label: 'Objetivo',
    heading: 'OBJETIVO',
    description: 'O que a IA deve fazer no atendimento.',
    placeholder:
      'Ex: Agendar consultas, confirmar presenças e tirar dúvidas dos pacientes.',
    rows: 3,
  },
  {
    key: 'regras',
    label: 'Regras',
    heading: 'REGRAS',
    description: 'Como a IA deve se comportar durante a conversa.',
    placeholder:
      '- Sempre confirmar nome completo do paciente\n- Oferecer no máximo 3 opções de horário\n- Encaminhar urgências para o telefone da clínica',
    rows: 4,
  },
  {
    key: 'restricoes',
    label: 'Restrições',
    heading: 'RESTRIÇÕES',
    description: 'O que a IA NUNCA deve fazer.',
    placeholder:
      '- Nunca dar diagnósticos\n- Nunca prometer valores sem confirmar com a clínica',
    rows: 4,
  },
  {
    key: 'exemplos',
    label: 'Exemplos',
    heading: 'EXEMPLOS DE RESPOSTA',
    description: 'Pares de pergunta e resposta modelo.',
    placeholder:
      'Paciente: Vocês atendem convênio X?\nResposta: Sim! Atendemos o convênio X. Posso já verificar um horário para você?',
    rows: 4,
  },
];

type SectionsState = Record<PromptSectionKey, string>;

const EMPTY_SECTIONS: SectionsState = {
  saudacao: '',
  objetivo: '',
  regras: '',
  restricoes: '',
  exemplos: '',
};

// Reconstrói o objeto de seções a partir de um prompt salvo. Usa os
// cabeçalhos (SAUDAÇÃO:, OBJETIVO: ...) como delimitadores. Se o prompt
// não seguir esse formato, joga tudo em "objetivo" como texto livre.
function parsePromptToSections(raw: string): SectionsState {
  const result: SectionsState = { ...EMPTY_SECTIONS };
  if (!raw || !raw.trim()) return result;

  // Migração: remove blocos legados (HORÁRIOS / URGÊNCIAS) que agora
  // vêm direto do sistema. Tudo até a próxima seção conhecida ou fim do texto.
  raw = raw.replace(
    /(HORÁRIOS DE ATENDIMENTO|URGÊNCIAS):[\s\S]*?(?=\n(?:SAUDAÇÃO|OBJETIVO|REGRAS|RESTRIÇÕES|EXEMPLOS DE RESPOSTA):|$)/g,
    '',
  );

  const headingByKey: Record<PromptSectionKey, string> = {
    saudacao: 'SAUDAÇÃO',
    objetivo: 'OBJETIVO',
    regras: 'REGRAS',
    restricoes: 'RESTRIÇÕES',
    exemplos: 'EXEMPLOS DE RESPOSTA',
  };

  const headings = Object.entries(headingByKey) as [PromptSectionKey, string][];
  const pattern = new RegExp(
    `(${headings.map(([, h]) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):`,
    'g'
  );

  const matches: { key: PromptSectionKey; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(raw)) !== null) {
    const found = headings.find(([, h]) => h === m![1]);
    if (found) {
      matches.push({ key: found[0], start: m.index, end: m.index + m[0].length });
    }
  }

  if (matches.length === 0) {
    result.objetivo = raw.trim();
    return result;
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = raw.slice(cur.end, next ? next.start : raw.length).trim();
    result[cur.key] = body;
  }
  return result;
}

function buildPromptFromSections(sections: SectionsState): string {
  return PROMPT_SECTIONS.map((s) => {
    const value = sections[s.key]?.trim();
    if (!value) return '';
    return `${s.heading}:\n${value}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

export default function SecretariaIA() {
  const { currentClinicId } = useAuth();
  const aiCtx = useAiContext();
  const isProfessional = aiCtx.kind === 'professional';
  const aiTenantId = aiCtx.aiTenantId;
  const qc = useQueryClient();
  // Em Phase 1.0 o backend externo só suporta clínica.
  const backendConfigured = isAiBackendConfigured() && aiCtx.backendSupported;

  // ---------- Configuração (Supabase) ----------
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['ai-secretary-config', aiCtx.kind, currentClinicId, aiTenantId],
    enabled: aiCtx.ready && (isProfessional ? !!aiTenantId : !!currentClinicId),
    queryFn: async () => {
      const q = supabase.from('ai_secretary_config' as any).select('*');
      const { data, error } = isProfessional
        ? await q.eq('ai_tenant_id', aiTenantId!).maybeSingle()
        : await q.eq('clinic_id', currentClinicId!).maybeSingle();
      if (error) throw error;
      return (data as unknown as AiConfigRow) ?? null;
    },
  });

  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [personality, setPersonality] = useState<string>('');
  const [sections, setSections] = useState<SectionsState>(EMPTY_SECTIONS);
  const [savedSections, setSavedSections] = useState<SectionsState>(EMPTY_SECTIONS);

  useEffect(() => {
    if (config) {
      const p = config.custom_prompt ?? '';
      setPrompt(p);
      setSavedPrompt(p);
      setEnabled(config.enabled);
      const parsed = parsePromptToSections(p);
      setSections(parsed);
      setSavedSections(parsed);
    }
  }, [config]);

  const updateSection = (key: PromptSectionKey, value: string) => {
    setSections((prev) => ({ ...prev, [key]: value }));
  };

  const handlePersonalityChange = (value: string) => {
    setPersonality(value);
  };

  const builtPrompt = (() => {
    const base = buildPromptFromSections(sections);
    const opt = PERSONALITY_OPTIONS.find((o) => o.value === personality);
    return opt ? `${base}${opt.template}` : base;
  })();

  const isDirty =
    JSON.stringify(sections) !== JSON.stringify(savedSections) ||
    builtPrompt !== savedPrompt;

  const saveConfig = useMutation({
    mutationFn: async (vars: { custom_prompt: string; enabled: boolean }) => {
      if (isProfessional) {
        if (!aiTenantId) throw new Error('Tenant da IA não resolvido');
        const { error } = await supabase
          .from('ai_secretary_config' as any)
          .upsert(
            {
              ai_tenant_id: aiTenantId,
              custom_prompt: vars.custom_prompt,
              enabled: vars.enabled,
            },
            { onConflict: 'ai_tenant_id' },
          );
        if (error) throw error;
      } else {
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
      }
    },
    onSuccess: (_data, vars) => {
      toast.success('Instruções salvas com sucesso');
      setSavedPrompt(vars.custom_prompt);
      setPrompt(vars.custom_prompt);
      setSavedSections(sections);
      qc.invalidateQueries({ queryKey: ['ai-secretary-config'] });
      // Sincroniza com o backend externo da Secretária IA — fire-and-forget
      // Phase 1.0: só dispara para clínica (backend externo ainda não conhece tenants profissionais).
      if (!isProfessional && currentClinicId && isAiBackendConfigured()) {
        console.log('[ai-sync] updateAiConfig vai disparar', { currentClinicId, isConfigured: isAiBackendConfigured(), custom_prompt: vars.custom_prompt?.slice(0, 50) });
        aiBackend
          .updateAiConfig(currentClinicId, {
            custom_prompt: vars.custom_prompt,
            enabled: vars.enabled,
          })
          .then(() => console.log('[ai-sync] updateAiConfig OK'))
          .catch((err) => console.error('[ai-sync] updateAiConfig ERRO:', err));
      }
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const toggleEnabled = (next: boolean) => {
    setEnabled(next);
    saveConfig.mutate({ custom_prompt: builtPrompt, enabled: next });
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

  // Liberado: o usuário pode navegar livremente entre as etapas
  // mesmo sem ter escaneado o QR Code do WhatsApp ainda.
  const canGoStep2 = true;
  const canGoStep3 = true;

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
              {isProfessional ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                    <QrCode className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Conexão WhatsApp — em breve</h3>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Sua Secretária IA pessoal já pode ser configurada. A conexão com o WhatsApp do
                      profissional será liberada na próxima etapa.
                    </p>
                  </div>
                  <Button size="lg" onClick={() => setStep(2)} className="gap-2">
                    Configurar instruções <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
              <>
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
              </>
              )}
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

                {/* Seções independentes */}
                <p className="text-xs text-muted-foreground/80">
                  Preencha as etapas abaixo. Os exemplos somem assim que você começar a digitar — campos vazios são ignorados ao salvar.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PROMPT_SECTIONS.map((s) => (
                    <div
                      key={s.key}
                      className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <Label htmlFor={`section-${s.key}`} className="text-sm font-medium">
                          {s.label}
                        </Label>
                        {sections[s.key].trim() && (
                          <span className="text-[10px] uppercase tracking-wide text-success">
                            preenchido
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      <Textarea
                        id={`section-${s.key}`}
                        value={sections[s.key]}
                        onChange={(e) => updateSection(s.key, e.target.value)}
                        disabled={saveConfig.isPending}
                        placeholder={s.placeholder}
                        rows={s.rows}
                        className="text-sm leading-relaxed resize-y rounded-md bg-background"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">
                    {builtPrompt.length} caracteres
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveConfig.mutate({ custom_prompt: builtPrompt, enabled })}
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
                        if (isDirty) saveConfig.mutate({ custom_prompt: builtPrompt, enabled });
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
          {currentClinicId && !isProfessional && <LiveMessagesPanel clinicId={currentClinicId} />}
          {isProfessional && (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                O painel ao vivo de mensagens será habilitado quando a conexão WhatsApp do
                profissional estiver disponível.
              </CardContent>
            </Card>
          )}
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
