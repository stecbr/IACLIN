import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  Save,
  QrCode,
  Loader2,
  AlertCircle,
  Check,
  CircleDot,
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
import { Input } from '@/components/ui/input';
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

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';
import { SuggestionsPanel, type ContextSuggestion } from '@/components/secretaria-ia/SuggestionsPanel';

interface AiConfigRow {
  id: string;
  clinic_id: string;
  custom_prompt: string;
  enabled: boolean;
}

interface ChatBubble {
  role: 'user' | 'ai';
  text: string;
}

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
      label: 'Tom de voz',
      template:
        '\n\nTOM DE VOZ:\n[Descreva como a IA deve falar — ex: acolhedora, formal, próxima, profissional]\n',
    },
    {
      label: 'Regras',
      template:
        '\n\nREGRAS:\n- [Regra 1]\n- [Regra 2]\n- [Regra 3]\n',
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

  // ---------- Sugestões contextuais ----------
  const { data: clinicInfo } = useQuery({
    queryKey: ['ai-secretary-clinic-info', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('name, category, phone, business_hours, address, city')
        .eq('id', currentClinicId!)
        .maybeSingle();
      return data;
    },
  });

  const contextSuggestions: ContextSuggestion[] = (() => {
    const list: ContextSuggestion[] = [];
    if (!clinicInfo) return list;
    if (clinicInfo.name) {
      list.push({
        id: 'identity',
        title: 'Identidade',
        preview: `Apresentar-se como secretária da ${clinicInfo.name}.`,
        text: `\n\nIDENTIDADE:\nVocê é a secretária virtual da ${clinicInfo.name}. Sempre se apresente de forma cordial mencionando o nome da clínica.\n`,
      });
    }
    if (clinicInfo.category) {
      const catMap: Record<string, string> = {
        odonto: 'odontológica', medico: 'médica', estetica: 'estética', veterinario: 'veterinária', outro: 'de saúde',
      };
      const cat = catMap[clinicInfo.category] ?? 'de saúde';
      list.push({
        id: 'specialty',
        title: 'Especialidade',
        preview: `Contexto de clínica ${cat}.`,
        text: `\n\nCONTEXTO:\nA clínica é ${cat}. Adapte o vocabulário e as orientações ao tipo de atendimento oferecido.\n`,
      });
    }
    if (clinicInfo.phone) {
      list.push({
        id: 'phone',
        title: 'Telefone',
        preview: `Encaminhar urgências para ${clinicInfo.phone}.`,
        text: `\n\nCONTATO DE URGÊNCIA:\nEm casos urgentes, oriente o paciente a ligar para ${clinicInfo.phone}.\n`,
      });
    }
    if (clinicInfo.address || clinicInfo.city) {
      const addr = [clinicInfo.address, clinicInfo.city].filter(Boolean).join(', ');
      list.push({
        id: 'address',
        title: 'Endereço',
        preview: `Informar localização: ${addr}.`,
        text: `\n\nLOCALIZAÇÃO:\nQuando perguntarem sobre a localização, informe: ${addr}.\n`,
      });
    }
    list.push({
      id: 'confirm',
      title: 'Confirmação',
      preview: 'Confirmar consultas 24h antes via WhatsApp.',
      text: `\n\nCONFIRMAÇÃO:\nSempre confirme consultas 24h antes do horário marcado, e peça que o paciente responda SIM ou NÃO.\n`,
    });
    list.push({
      id: 'limits',
      title: 'Limites',
      preview: 'Não dar diagnósticos nem prometer resultados.',
      text: `\n\nLIMITES:\n- Nunca dê diagnósticos clínicos.\n- Nunca prometa resultados específicos de tratamentos.\n- Sempre encaminhe dúvidas técnicas ao profissional responsável.\n`,
    });
    return list;
  })();

  const insertChipTemplate = (template: string) => {
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

  // ---------- WhatsApp status (Backend IA) ----------
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

  // ---------- Teste de conversa ----------
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [chat, setChat] = useState<ChatBubble[]>([]);

  const testMutation = useMutation({
    mutationFn: () =>
      aiBackend.testConversation(currentClinicId!, testPhone.trim(), testMessage.trim()),
    onMutate: () => {
      setChat((c) => [...c, { role: 'user', text: testMessage.trim() }]);
    },
    onSuccess: (data) => {
      setChat((c) => [...c, { role: 'ai', text: data.reply }]);
      setTestMessage('');
    },
    onError: (e: any) => {
      toast.error(e.message ?? 'Erro ao testar conversa');
      setChat((c) => [...c, { role: 'ai', text: '⚠️ Erro: ' + (e.message ?? 'falha') }]);
    },
  });

  const handleSendTest = () => {
    if (!testPhone.trim() || !testMessage.trim() || !currentClinicId) return;
    testMutation.mutate();
  };

  // ---------- Render ----------
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

      {/* Card System Prompt — layout 2 colunas */}
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap gap-2">
                  {PROMPT_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => insertChipTemplate(chip.template)}
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

              <SuggestionsPanel
                suggestions={contextSuggestions}
                promptPreview={prompt}
                onAdd={insertChipTemplate}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Teste */}
      <Card>
        <CardHeader>
          <CardTitle>Testar conversa</CardTitle>
          <CardDescription>
            Simule uma mensagem de paciente para ver como a IA responde.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
            <Input
              placeholder="Telefone (ex: 11999999999)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <Input
              placeholder="Mensagem do paciente"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendTest()}
            />
            <Button
              onClick={handleSendTest}
              disabled={
                testMutation.isPending ||
                !testPhone.trim() ||
                !testMessage.trim() ||
                !currentClinicId ||
                !backendConfigured
              }
              className="gap-2"
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4 min-h-[120px] max-h-[400px] overflow-y-auto">
            {chat.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                As respostas da IA aparecerão aqui.
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {chat.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${b.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                        b.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card border border-border rounded-bl-sm'
                      }`}
                    >
                      {b.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </CardContent>
      </Card>

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
