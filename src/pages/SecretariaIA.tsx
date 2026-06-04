import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wifi,
  WifiOff,
  Save,
  QrCode,
  Loader2,
  AlertCircle,
  Check,
  CircleDot,
  LayoutDashboard,
  ArrowRight,
  Activity,
  BookOpen,
  Bot,
  MessageSquare,
  UserCog,
  Zap,
  Phone,
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
import { aiBackend, isAiBackendConfigured, AI_BACKEND_URL } from '@/lib/aiBackend';
import { LiveMessagesPanel } from '@/components/secretaria-ia/LiveMessagesPanel';
import { useAiContext } from '@/hooks/useAiContext';
import { KnowledgeSourcePanel } from '@/components/secretaria-ia/KnowledgeSourcePanel';
import { HandoffPanel } from '@/components/secretaria-ia/HandoffPanel';
import { OverviewMetrics } from '@/components/secretaria-ia/OverviewMetrics';
import { KnowledgeShortcuts } from '@/components/secretaria-ia/KnowledgeShortcuts';
import { AutomationsPanel } from '@/components/secretaria-ia/AutomationsPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  | 'endereco'
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
    key: 'endereco',
    label: 'Endereço da clínica',
    heading: 'ENDEREÇO DA CLÍNICA',
    description: 'A IA informa este endereço quando o paciente pedir a localização.',
    placeholder:
      'Ex: Av. Paulista, 1000 — Bela Vista, São Paulo/SP. Próximo ao metrô Trianon-MASP.',
    rows: 3,
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
  endereco: '',
  exemplos: '',
};

// Reconstrói o objeto de seções a partir de um prompt salvo. Usa os
// cabeçalhos (SAUDAÇÃO:, OBJETIVO: ...) como delimitadores. Se o prompt
// não seguir esse formato, joga tudo em "objetivo" como texto livre.
// Tenta identificar qual personalidade um corpo de texto representa,
// comparando com o conteúdo dos templates conhecidos (ignorando o heading).
function matchPersonality(body: string): string {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const target = norm(body);
  if (!target) return '';
  const found = PERSONALITY_OPTIONS.find(
    (o) => norm(o.template.replace(/^\s*PERSONALIDADE:\s*/i, '')) === target,
  );
  return found?.value ?? '';
}

function parsePromptToSections(raw: string): { sections: SectionsState; personality: string } {
  const result: SectionsState = { ...EMPTY_SECTIONS };
  if (!raw || !raw.trim()) return { sections: result, personality: '' };

  // Migração: remove blocos legados (HORÁRIOS / URGÊNCIAS) que agora
  // vêm direto do sistema. Tudo até a próxima seção conhecida ou fim do texto.
  raw = raw.replace(
    /(HORÁRIOS DE ATENDIMENTO|URGÊNCIAS):[\s\S]*?(?=\n(?:SAUDAÇÃO|OBJETIVO|REGRAS|RESTRIÇÕES|PERSONALIDADE|EXEMPLOS DE RESPOSTA):|$)/g,
    '',
  );

  const headingByKey: Record<PromptSectionKey, string> = {
    saudacao: 'SAUDAÇÃO',
    objetivo: 'OBJETIVO',
    regras: 'REGRAS',
    restricoes: 'RESTRIÇÕES',
    endereco: 'ENDEREÇO DA CLÍNICA',
    exemplos: 'EXEMPLOS DE RESPOSTA',
  };

  // PERSONALIDADE não é uma seção editável (vem do dropdown), mas precisa
  // ser reconhecida como delimitador para não vazar para dentro de outra seção.
  const headings = [
    ...(Object.entries(headingByKey) as [PromptSectionKey, string][]),
    ['__personalidade__' as const, 'PERSONALIDADE'] as const,
  ];
  const pattern = new RegExp(
    `(${headings.map(([, h]) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):`,
    'g'
  );

  const matches: { key: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(raw)) !== null) {
    const found = headings.find(([, h]) => h === m![1]);
    if (found) {
      matches.push({ key: found[0], start: m.index, end: m.index + m[0].length });
    }
  }

  if (matches.length === 0) {
    result.objetivo = raw.trim();
    return { sections: result, personality: '' };
  }

  let personality = '';
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = raw.slice(cur.end, next ? next.start : raw.length).trim();
    if (cur.key === '__personalidade__') {
      personality = matchPersonality(body);
    } else {
      result[cur.key as PromptSectionKey] = body;
    }
  }
  return { sections: result, personality };
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
  const [savedPersonality, setSavedPersonality] = useState<string>('');
  const [sections, setSections] = useState<SectionsState>(EMPTY_SECTIONS);
  const [savedSections, setSavedSections] = useState<SectionsState>(EMPTY_SECTIONS);

  useEffect(() => {
    if (config) {
      const p = config.custom_prompt ?? '';
      setPrompt(p);
      setSavedPrompt(p);
      setEnabled(config.enabled);
      const { sections: parsed, personality: parsedPersonality } = parsePromptToSections(p);
      setSections(parsed);
      setSavedSections(parsed);
      setPersonality(parsedPersonality);
      setSavedPersonality(parsedPersonality);
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
    personality !== savedPersonality;

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
      setSavedPersonality(personality);
      qc.invalidateQueries({ queryKey: ['ai-secretary-config'] });
      // Sincroniza com o backend externo da Secretária IA — fire-and-forget
      // Phase 1.0: só dispara para clínica (backend externo ainda não conhece tenants profissionais).
      if (!isProfessional && currentClinicId && isAiBackendConfigured()) {
        console.log('[ai-sync] updateAiConfig vai disparar', { currentClinicId, isConfigured: isAiBackendConfigured(), custom_prompt: vars.custom_prompt?.slice(0, 50) });
        // Raw fetch para logar status HTTP + body exatamente como o backend devolve
        const url = `${AI_BACKEND_URL}/api/data/ai_secretary_config/config-${currentClinicId}`;
        const body = JSON.stringify({ custom_prompt: vars.custom_prompt, enabled: vars.enabled });
        console.log('[ai-sync] PATCH →', url, body);
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
          body,
        })
          .then(async (res) => {
            const text = await res.text().catch(() => '');
            console.log('[ai-sync] PATCH ←', res.status, res.statusText, text.slice(0, 500));
            if (!res.ok) {
              toast.error(`Backend IA respondeu ${res.status} ao salvar config`);
            }
          })
          .catch((err) => {
            console.error('[ai-sync] PATCH falhou (network/timeout):', err);
            toast.error('Não consegui falar com o backend da IA (timeout/rede)');
          });
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
    mutationFn: async () => {
      // Não apagamos o histórico ao conectar — conversas anteriores (inclusive
      // as em atendimento humano) devem ser preservadas. Limpeza só manual.
      return aiBackend.connectWhatsApp(currentClinicId!);
    },
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
              // Re-busca conversas do backend (sem apagar histórico)
              qc.invalidateQueries({ queryKey: ['ai-conversations', currentClinicId] });
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
    mutationFn: async () => {
      // Preserva o histórico ao desconectar — não apaga conversas automaticamente.
      return aiBackend.disconnectWhatsApp(currentClinicId!);
    },
    onSuccess: () => {
      qc.setQueryData(['ai-whatsapp-status', currentClinicId], {
        connected: false,
        status: 'disconnected',
        instance_name: null,
      });
      qc.invalidateQueries({ queryKey: ['ai-whatsapp-status', currentClinicId] });
      // Preserva o histórico — apenas re-busca, sem apagar
      qc.invalidateQueries({ queryKey: ['ai-conversations', currentClinicId] });
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

  const STEPS: { id: Step; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { id: 1, label: 'Conexão', icon: <QrCode className="h-4 w-4" />, enabled: true },
    { id: 2, label: 'Painel', icon: <LayoutDashboard className="h-4 w-4" />, enabled: canGoStep2 },
    { id: 3, label: 'Conversas', icon: <MessageSquare className="h-4 w-4" />, enabled: true },
  ];

  // Aba ativa do hub (step 2). Mantida fora do unmount para não perder edição.
  const [activeTab, setActiveTab] = useState<string>('visao');

  // Restaura tab/step/scroll quando o usuário volta de um atalho de configuração.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('iaclin.secretariaIaRestore');
      if (!raw) return;
      const { tab, step: savedStep, scroll } = JSON.parse(raw) as {
        tab?: string; step?: 1 | 2 | 3; scroll?: number;
      };
      if (tab) setActiveTab(tab);
      if (savedStep) setStep(savedStep);
      sessionStorage.removeItem('iaclin.secretariaIaRestore');
      const y = typeof scroll === 'number' ? scroll : 0;
      requestAnimationFrame(() => {
        setTimeout(() => window.scrollTo({ top: y, behavior: 'auto' }), 60);
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém um snapshot do estado atual para que os atalhos possam restaurar.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        'iaclin.secretariaIaState',
        JSON.stringify({ tab: activeTab, step }),
      );
    } catch {}
  }, [activeTab, step]);

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
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : done
                    ? 'bg-background text-foreground hover:bg-accent'
                    : 'text-muted-foreground hover:bg-background/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : done
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                {s.icon}
                <span className={active ? 'inline' : 'hidden sm:inline'}>{s.label}</span>
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
              <div className="relative flex items-center justify-center">
                {connectMutation.isPending && (
                  <>
                    <span className="absolute inline-flex h-28 w-28 animate-ping rounded-full bg-emerald-500/20" />
                    <span className="absolute inline-flex h-24 w-24 animate-pulse rounded-full bg-emerald-500/10" />
                  </>
                )}
                <div
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-colors ${
                    isConnected
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                      : 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                  }`}
                >
                  <svg viewBox="0 0 32 32" className="h-12 w-12 text-white" fill="currentColor" aria-hidden="true">
                    <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.708.888.717 0 2.18-.515 2.45-1.318.144-.444.144-.717.144-.732 0-.43-1.318-.815-1.704-.93zM16.225 3C8.984 3 3 8.984 3 16.225a13.165 13.165 0 0 0 2.422 7.692L3.043 30.86l7.18-2.292a13.197 13.197 0 0 0 6.002 1.426c7.241 0 13.225-5.984 13.225-13.225S23.466 3 16.225 3zm0 23.948a10.65 10.65 0 0 1-5.45-1.492l-.387-.23-3.793 1.21 1.232-3.687-.247-.39a10.665 10.665 0 0 1-1.634-5.674c0-5.873 4.864-10.737 10.737-10.737S26.42 11.74 26.42 17.613c0 5.872-4.323 10.736-10.196 10.736z"/>
                  </svg>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">
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
                      {(() => {
                        const d = statusQuery.data as any;
                        const phone = d?.phone || d?.phone_number || d?.number || null;
                        if (!phone) return null;
                        return (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {phone}
                          </span>
                        );
                      })()}
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

      {/* ETAPA 2 — Painel (hub) */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Painel da Secretária IA</h1>
              <p className="text-sm text-muted-foreground">
                Configure o comportamento, veja o que a IA já sabe e acompanhe as conversas.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-lg border border-border/60 bg-card px-3 py-2 sm:self-auto">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
              <TabsTrigger value="visao" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Visão geral</span>
                <span className="sm:hidden">Visão</span>
              </TabsTrigger>
              <TabsTrigger value="comportamento" className="gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Comportamento</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
              <TabsTrigger value="conhecimento" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">O que a IA já sabe</span>
                <span className="sm:hidden">Sabe</span>
              </TabsTrigger>
              <TabsTrigger value="automacoes" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Automações</span>
                <span className="sm:hidden">Auto</span>
              </TabsTrigger>
              <TabsTrigger value="transferencia" className="gap-1.5">
                <UserCog className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Transferência</span>
                <span className="sm:hidden">Transfer</span>
              </TabsTrigger>
            </TabsList>

            {/* Visão geral */}
            <TabsContent value="visao" className="space-y-4">
              <OverviewMetrics
                clinicId={currentClinicId}
                backendConfigured={backendConfigured}
                onNavigate={setActiveTab}
              />
            </TabsContent>

            {/* Comportamento */}
            <TabsContent value="comportamento" className="space-y-4">
              <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Personalidade da IA</CardTitle>
                <CardDescription>
                  Defina como a IA se comunica, o que ela deve fazer e o que ela nunca pode fazer.
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
                {(() => {
                  const sectionByKey = Object.fromEntries(
                    PROMPT_SECTIONS.map((s) => [s.key, s]),
                  ) as Record<PromptSectionKey, (typeof PROMPT_SECTIONS)[number]>;
                  const renderSection = (key: PromptSectionKey) => {
                    const s = sectionByKey[key];
                    return (
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
                    );
                  };
                  return (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-4">
                          {renderSection('saudacao')}
                          {renderSection('regras')}
                        </div>
                        <div className="space-y-4">
                          {renderSection('objetivo')}
                          {renderSection('restricoes')}
                        </div>
                      </div>
                      {renderSection('endereco')}
                      {renderSection('exemplos')}
                    </div>
                  );
                })()}

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
                  </div>
                </div>
              </div>
            )}
          </CardContent>
              </Card>
            </TabsContent>

            {/* Conhecimento */}
            <TabsContent value="conhecimento" className="space-y-4">
              {currentClinicId && !isProfessional ? (
                <KnowledgeShortcuts clinicId={currentClinicId} />
              ) : (
                <Card className="rounded-xl shadow-sm">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Disponível apenas no contexto de clínica.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Automações */}
            <TabsContent value="automacoes" className="space-y-4">
              <AutomationsPanel clinicId={currentClinicId ?? null} />
            </TabsContent>

            {/* Transferência para atendente humano */}
            <TabsContent value="transferencia" className="space-y-4">
              <HandoffPanel />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ETAPA 3 — Conversas ao vivo */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Conversas</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe as conversas da Secretária IA no WhatsApp e assuma manualmente quando precisar.
            </p>
          </div>
          {!currentClinicId ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Selecione uma clínica para ver as conversas.
              </CardContent>
            </Card>
          ) : !isConnected ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <WifiOff className="h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm font-medium">WhatsApp desconectado</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Reconecte o WhatsApp na etapa Conexão para voltar a receber e ver as conversas.
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setStep(1)}>
                  Ir para Conexão
                </Button>
              </CardContent>
            </Card>
          ) : (
            <LiveMessagesPanel
              clinicId={currentClinicId}
              showMetrics
              allowTakeover
              connected={isConnected}
            />
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
