import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Wifi, WifiOff, RefreshCw, Send, Save, QrCode, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend } from '@/lib/aiBackend';

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
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (config) {
      setPrompt(config.custom_prompt ?? '');
      setEnabled(config.enabled);
    }
  }, [config]);

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
      toast.success('Configurações salvas');
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
    enabled: !!currentClinicId,
    queryFn: () => aiBackend.getWhatsAppStatus(currentClinicId!),
    refetchInterval: 15000,
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
      <PageHeader
        title="Secretária IA"
        description="Configure a secretária virtual da sua clínica no WhatsApp"
        icon={Bot}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card WhatsApp */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Conexão WhatsApp
                </CardTitle>
                <CardDescription>Status da instância da secretária</CardDescription>
              </div>
              {statusQuery.isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : statusQuery.isError ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Backend offline
                </Badge>
              ) : isConnected ? (
                <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20">
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
            {statusQuery.isError && (
              <p className="text-sm text-muted-foreground">
                Não foi possível conectar ao backend da IA. Verifique se ele está em execução.
              </p>
            )}
            {!statusQuery.isError && (
              <div className="text-sm text-muted-foreground">
                Instância:{' '}
                <span className="font-mono text-foreground">
                  {statusQuery.data?.instance_name ?? '—'}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !currentClinicId}
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
              <Button
                variant="ghost"
                onClick={() => statusQuery.refetch()}
                disabled={statusQuery.isFetching}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${statusQuery.isFetching ? 'animate-spin' : ''}`} />
                Atualizar status
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

      {/* Card Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Instruções personalizadas</CardTitle>
          <CardDescription>
            Diga à IA como ela deve se comportar — regras de agendamento, tom de voz, restrições.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingConfig ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Ex.:\n- Não agende aos domingos\n- Sempre pergunte o convênio\n- Use tom cordial e formal`}
              rows={8}
              className="resize-y font-mono text-sm"
            />
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => saveConfig.mutate({ custom_prompt: prompt, enabled })}
              disabled={saveConfig.isPending || loadingConfig}
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
                !currentClinicId
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
