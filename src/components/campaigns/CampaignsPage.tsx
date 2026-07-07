import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, Loader2, MessageSquare, Send, Sparkles, Users, UserX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';
import {
  resolveCampaignAudience,
  type AudienceType,
  type AudienceFilters,
  type Recipient,
} from '@/hooks/useCampaignAudience';
import CampaignHistory from './CampaignHistory';

// ---- presets ----------------------------------------------------------------

const AUDIENCE_PRESETS: Array<{
  id: AudienceType;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'Todos os pacientes', hint: 'Toda a base da clínica', icon: Users },
  { id: 'active', label: 'Ativos', hint: 'Marcados como ativos', icon: Users },
  { id: 'scheduled', label: 'Com consulta futura', hint: 'Já têm consulta marcada', icon: CalendarClock },
  { id: 'absent', label: 'Sem consulta há tempo', hint: 'Sem retorno recente', icon: UserX },
  { id: 'private', label: 'Particulares', hint: 'Sem convênio', icon: Users },
  { id: 'insurance', label: 'De um convênio', hint: 'Filtre por operadora', icon: Users },
  { id: 'inactive', label: 'Inativos', hint: 'Reative pacientes', icon: Users },
];

const TEMPLATES: Array<{ label: string; body: string }> = [
  {
    label: 'Retorno preventivo',
    body: 'Oi {nome}, faz um tempinho que a gente não se vê! Que tal agendar sua consulta de manutenção na {clinica}? É rapidinho — responda este WhatsApp que a gente organiza um horário.',
  },
  {
    label: 'Promoção',
    body: 'Olá {nome}! A {clinica} está com condição especial este mês. Responda esta mensagem para saber mais e agendar sua avaliação sem compromisso.',
  },
  {
    label: 'Lembrete geral',
    body: 'Oi {nome}! Passando aqui rapidinho pra lembrar de cuidar do seu sorriso. Qualquer dúvida é só responder este WhatsApp. — Equipe {clinica}',
  },
];

// ---- helpers ----------------------------------------------------------------

function renderPreview(template: string, name: string, clinicName: string) {
  const safeName = name || 'Paciente';
  const safeClinic = clinicName || 'nossa clínica';
  return template
    .replace(/\{nome\}/g, safeName)
    .replace(/\{patient_name\}/g, safeName)
    .replace(/\{clinica\}/g, safeClinic)
    .replace(/\{clinic_name\}/g, safeClinic);
}

// ---- component --------------------------------------------------------------

export default function CampaignsPage({ clinicId }: { clinicId: string }) {
  const [audience, setAudience] = useState<AudienceType>('all');
  const [filters, setFilters] = useState<AudienceFilters>({ last_visit_months: 6 });
  const [template, setTemplate] = useState('Olá {nome}! Passando aqui pra manter contato. — Equipe {clinica}');
  const [channels, setChannels] = useState<{ whatsapp: boolean; sms: boolean }>({
    whatsapp: true,
    sms: false,
  });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [insuranceOptions, setInsuranceOptions] = useState<string[]>([]);
  const [clinicName, setClinicName] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  // clinic name + insurance list
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [{ data: clinic }, { data: patients }] = await Promise.all([
        supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle(),
        supabase
          .from('patients')
          .select('insurance_provider')
          .eq('clinic_id', clinicId)
          .not('insurance_provider', 'is', null)
          .limit(2000),
      ]);
      setClinicName(clinic?.name ?? '');
      const unique = Array.from(
        new Set(
          (patients ?? [])
            .map((p: any) => (p.insurance_provider as string | null)?.trim())
            .filter((v): v is string => !!v),
        ),
      ).sort();
      setInsuranceOptions(unique);
    })();
  }, [clinicId]);

  // resolve audience whenever selection changes
  useEffect(() => {
    let cancel = false;
    setAudienceLoading(true);
    resolveCampaignAudience(clinicId, audience, filters)
      .then((res) => {
        if (cancel) return;
        setRecipients(res.recipients);
      })
      .catch(() => !cancel && setRecipients([]))
      .finally(() => !cancel && setAudienceLoading(false));
    return () => {
      cancel = true;
    };
  }, [clinicId, audience, filters]);

  const validPhoneCount = recipients.length;
  const previewRecipient = recipients[0];
  const previewText = useMemo(
    () => renderPreview(template, previewRecipient?.name ?? 'Maria Silva', clinicName),
    [template, previewRecipient, clinicName],
  );

  const chosenChannels = Object.entries(channels)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const canSend =
    !!template.trim() && chosenChannels.length > 0 && validPhoneCount > 0 && !sending;

  const insertVar = (v: string) => setTemplate((t) => `${t}${t.endsWith(' ') || !t ? '' : ' '}${v}`);

  const handleSend = async () => {
    if (!canSend) return;
    if (!isAiBackendConfigured()) {
      toast({
        title: 'Backend da IA não configurado',
        description: 'A campanha não pode ser disparada sem a integração de WhatsApp ativa.',
        variant: 'destructive',
      });
      return;
    }
    if (channels.sms) {
      toast({
        title: 'SMS ainda não disponível',
        description: 'O envio por SMS entra em breve. Enviaremos só pelo WhatsApp por enquanto.',
      });
    }

    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const audiencePreset = AUDIENCE_PRESETS.find((a) => a.id === audience);
      const name = `${audiencePreset?.label ?? 'Campanha'} · ${new Date().toLocaleDateString('pt-BR')}`;

      // 1) grava a campanha
      const { data: campaign, error: cErr } = await supabase
        .from('campaigns')
        .insert({
          clinic_id: clinicId,
          created_by: userRes.user?.id ?? null,
          name,
          audience_type: audience,
          filters: filters as any,
          template,
          channels: chosenChannels,
          status: 'sending',
          recipient_count: recipients.length,
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (cErr || !campaign) throw cErr ?? new Error('Falha ao criar campanha');

      // 2) grava a lista de destinatários
      if (recipients.length > 0) {
        const rows = recipients.map((r) => ({
          campaign_id: campaign.id,
          clinic_id: clinicId,
          patient_id: r.patient_id,
          name: r.name,
          phone: r.phone,
          whatsapp_status: channels.whatsapp ? 'queued' : null,
          sms_status: channels.sms ? 'queued' : null,
        }));
        await supabase.from('campaign_recipients').insert(rows);
      }

      // 3) dispara no backend IA (WhatsApp real via Evolution)
      if (channels.whatsapp) {
        await aiBackend.sendCampaign(clinicId, {
          campaign_id: campaign.id,
          template,
          channels: chosenChannels,
          recipients,
        });
      }

      await supabase
        .from('campaigns')
        .update({ status: 'completed' })
        .eq('id', campaign.id);

      toast({
        title: 'Campanha disparada',
        description: `${recipients.length} paciente(s) sendo notificados.`,
      });
      setHistoryKey((k) => k + 1);
    } catch (err) {
      console.error('[campaigns] send failed', err);
      toast({
        title: 'Erro ao enviar campanha',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Campanhas</h1>
        <p className="text-muted-foreground">
          Envie mensagens em massa para os pacientes cadastrados. Segmente, escreva e dispare em uma tela só.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* --------- Para quem --------- */}
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Para quem</h2>
                <p className="text-xs text-muted-foreground">Escolha o público — o cálculo é ao vivo.</p>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {audienceLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Users className="h-3 w-3 mr-1" />
                    {validPhoneCount} com WhatsApp
                  </>
                )}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {AUDIENCE_PRESETS.map((preset) => {
                const active = audience === preset.id;
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAudience(preset.id)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      active
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 hover:border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">{preset.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{preset.hint}</p>
                  </button>
                );
              })}
            </div>

            {audience === 'absent' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Meses sem consulta</Label>
                <Input
                  type="number"
                  min={1}
                  value={filters.last_visit_months ?? 6}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      last_visit_months: Number(e.target.value) || 6,
                    }))
                  }
                />
              </div>
            )}

            {audience === 'insurance' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Convênio</Label>
                <Select
                  value={filters.insurance_plan ?? 'any'}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      insurance_plan: v === 'any' ? null : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer convênio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer convênio</SelectItem>
                    {insuranceOptions.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              Só pacientes com telefone cadastrado entram na campanha.
              {recipients.length > 0 && (
                <> Exemplo: <span className="text-foreground">{recipients[0].name}</span>.</>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --------- Mensagem --------- */}
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">O que enviar</h2>
                <p className="text-xs text-muted-foreground">Use variáveis para personalizar cada mensagem.</p>
              </div>
              <div className="flex gap-1.5">
                {['{nome}', '{clinica}'].map((v) => (
                  <Button key={v} type="button" size="sm" variant="outline" className="h-7 rounded-full text-xs"
                    onClick={() => insertVar(v)}>
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
              placeholder="Escreva a mensagem que será enviada..."
              className="resize-none"
            />

            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <Button
                  key={t.label}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full text-xs bg-muted/50 hover:bg-muted"
                  onClick={() => setTemplate(t.body)}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> {t.label}
                </Button>
              ))}
            </div>

            <div className="rounded-2xl border bg-[#e5ddd5]/30 dark:bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Preview WhatsApp
              </p>
              <div className="rounded-xl bg-white dark:bg-background shadow-sm p-3 text-sm whitespace-pre-wrap max-w-[85%]">
                {previewText || 'Sua mensagem aparecerá aqui.'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --------- Rodapé --------- */}
      <Card className="rounded-2xl border-border/60 sticky bottom-4 backdrop-blur bg-background/85">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setChannels((c) => ({ ...c, whatsapp: !c.whatsapp }))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                channels.whatsapp
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setChannels((c) => ({ ...c, sms: !c.sms }))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors relative ${
                channels.sms
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
              title="Em breve"
            >
              SMS
              <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-60">em breve</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground leading-tight">
              <div>
                <span className="text-foreground font-semibold">{validPhoneCount}</span> pacientes
              </div>
              <div>serão notificados</div>
            </div>
            <Button
              size="lg"
              disabled={!canSend}
              onClick={handleSend}
              className="rounded-full gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="pt-4">
          <CampaignHistory key={historyKey} clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}