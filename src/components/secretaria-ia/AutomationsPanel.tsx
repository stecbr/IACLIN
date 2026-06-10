import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CheckCircle2, RotateCcw, CalendarClock, UserCog, Loader2, Cake, Star, AlertTriangle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { aiBackend, isAiBackendConfigured } from '@/lib/aiBackend';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  clinicId: string | null;
}

type AutomationType =
  | 'appointment_reminder'
  | 'confirmation'
  | 'return'
  | 'reschedule'
  | 'escalate'
  | 'birthday'
  | 'nps';

interface AutomationRecord {
  id?: string;
  type: AutomationType;
  active: boolean;
  message: string;
  trigger_keywords?: string;
  target_phone?: string;
  return_after_days?: number;
  image_url?: string;
}

// `defaultMessage` é o texto PRONTO que a clínica recebe já preenchido — ela não
// precisa escrever nada, só ligar. Pode personalizar depois (botão "Personalizar").
const AUTOMATION_DEFS: Array<{
  type: AutomationType;
  title: string;
  description: string;
  icon: typeof Bell;
  defaultMessage: string;
}> = [
  {
    type: 'appointment_reminder',
    title: 'Lembrete de consulta',
    description: 'Enviado automaticamente 24h antes da consulta',
    icon: Bell,
    defaultMessage: 'Olá {patient_name}, lembrete da sua consulta em {date} às {time}.',
  },
  {
    type: 'confirmation',
    title: 'Confirmação de agendamento',
    description: 'Enviado logo após o agendamento ser criado',
    icon: CheckCircle2,
    defaultMessage: 'Olá {patient_name}, sua consulta foi agendada para {date} às {time}.',
  },
  {
    type: 'return',
    title: 'Mensagem de retorno',
    description: 'Enviado X dias após a última consulta',
    icon: RotateCcw,
    defaultMessage: 'Olá {patient_name}, já faz um tempo desde sua última visita à {clinic_name}. Que tal agendar um retorno?',
  },
  {
    type: 'reschedule',
    title: 'Reagendamento',
    description: 'Enviado quando uma consulta é cancelada',
    icon: CalendarClock,
    defaultMessage: 'Olá {patient_name}, sua consulta foi cancelada. Quer reagendar?',
  },
  {
    type: 'escalate',
    title: 'Escalada para humano',
    description: 'Enviado quando a IA não consegue resolver',
    icon: UserCog,
    defaultMessage: 'Vou te transferir para um de nossos atendentes. Aguarde só um momento.',
  },
  {
    type: 'birthday',
    title: 'Feliz aniversário',
    description: 'Enviado no dia do aniversário do paciente (de manhã)',
    icon: Cake,
    defaultMessage: 'Olá {patient_name}, a equipe da {clinic_name} deseja um feliz aniversário! 🎉',
  },
  {
    type: 'nps',
    title: 'Pesquisa de satisfação (NPS)',
    description: 'Enviado algumas horas após a consulta realizada',
    icon: Star,
    defaultMessage: 'Olá {patient_name}, como foi seu atendimento hoje? De 0 a 10, o quanto você recomendaria a {clinic_name}?',
  },
];

// Exemplo renderizado p/ a prévia "como o paciente recebe" (sem mostrar {}).
function renderPreview(message: string, clinicName: string): string {
  return (message || '')
    .replace(/\{patient_name\}/g, 'Maria')
    .replace(/\{date\}/g, '10/06/2026')
    .replace(/\{time\}/g, '10:00')
    .replace(/\{doctor\}/g, 'Dr. Carlos')
    .replace(/\{procedure\}/g, 'Limpeza')
    .replace(/\{clinic_name\}/g, clinicName || 'sua clínica');
}

function normalize(payload: unknown): AutomationRecord[] {
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.data)
    ? (payload as any).data
    : [];
  return (arr as any[]).map((a) => ({
    id: a.id,
    type: a.type,
    active: a.active ?? a.enabled ?? false,
    message: a.message_template ?? a.message ?? a.template ?? '',
    trigger_keywords: a.trigger_keywords ?? '',
    target_phone: a.target_phone ?? '',
    return_after_days: a.return_after_days ?? 180,
    image_url: a.image_url ?? a.media_url ?? '',
  }));
}

// Cobertura dos dados que cada automação precisa para conseguir disparar.
interface PatientDataCoverage {
  total: number;
  missingPhone: number;
  missingBirthDate: number;
}

export function AutomationsPanel({ clinicId }: Props) {
  const qc = useQueryClient();
  const enabled = !!clinicId && isAiBackendConfigured();

  const { data: automations = [], isLoading, isError, error } = useQuery({
    queryKey: ['ai-automations', clinicId],
    queryFn: async () => normalize(await aiBackend.listAutomations(clinicId as string)),
    enabled,
  });

  // Conta pacientes ativos sem telefone / sem data de nascimento, para avisar
  // quando uma automação não conseguirá atingir parte (ou todos) os pacientes.
  const { data: coverage } = useQuery<PatientDataCoverage>({
    queryKey: ['ai-automations-coverage', clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const base = () =>
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinicId as string)
          .eq('is_active', true);

      const [{ count: total }, { count: withPhone }, { count: withBirth }] = await Promise.all([
        base(),
        base().not('phone', 'is', null).neq('phone', ''),
        base().not('date_of_birth', 'is', null),
      ]);

      const t = total ?? 0;
      return {
        total: t,
        missingPhone: t - (withPhone ?? 0),
        missingBirthDate: t - (withBirth ?? 0),
      };
    },
  });

  if (!enabled) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Disponível apenas no contexto de clínica.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Automações de WhatsApp</h2>
        <p className="text-xs text-muted-foreground">
          Cada automação já vem com uma mensagem pronta. É só ativar — não precisa escrever nada.
          Se quiser, clique em <span className="font-medium">Personalizar mensagem</span> para editar.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {AUTOMATION_DEFS.map((d) => (
            <Skeleton key={d.type} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="rounded-xl border-destructive/30 shadow-sm">
          <CardContent className="py-6 text-sm text-destructive">
            Não foi possível carregar as automações. {(error as Error)?.message}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {AUTOMATION_DEFS.map((def) => {
            const existing = automations.find((a) => a.type === def.type);
            return (
              <AutomationCard
                key={def.type}
                def={def}
                record={existing}
                clinicId={clinicId as string}
                coverage={coverage}
                onSaved={() => qc.invalidateQueries({ queryKey: ['ai-automations', clinicId] })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  def: (typeof AUTOMATION_DEFS)[number];
  record?: AutomationRecord;
  clinicId: string;
  coverage?: PatientDataCoverage;
  onSaved: () => void;
}

// Quais dados do cadastro de paciente cada automação precisa para disparar.
// 'escalate' é reativa (responde a palavras-chave), não depende de cadastro.
const AUTOMATION_DATA_REQUIREMENTS: Record<AutomationType, Array<'phone' | 'birthDate'>> = {
  appointment_reminder: ['phone'],
  confirmation: ['phone'],
  return: ['phone'],
  reschedule: ['phone'],
  escalate: [],
  birthday: ['phone', 'birthDate'],
  nps: ['phone'],
};

function AutomationCard({ def, record, clinicId, coverage, onSaved }: CardProps) {
  const Icon = def.icon;
  const isEscalate = def.type === 'escalate';
  const isReturn = def.type === 'return';
  const isBirthday = def.type === 'birthday';
  // Mensagem começa com a versão PRONTA (default) quando ainda não há salva.
  const initialMessage = record?.message?.trim() ? record.message : def.defaultMessage;
  const [active, setActive] = useState<boolean>(record?.active ?? false);
  const [message, setMessage] = useState<string>(initialMessage);
  const [imageUrl, setImageUrl] = useState<string>(record?.image_url ?? '');
  const [triggerKeywords, setTriggerKeywords] = useState<string>(record?.trigger_keywords ?? '');
  const [targetPhone, setTargetPhone] = useState<string>(record?.target_phone ?? '');
  const [returnDays, setReturnDays] = useState<string>(String((record as any)?.return_after_days ?? 180));
  // Editor de texto fica ESCONDIDO por padrão — fluxo comum é só ligar.
  const [editing, setEditing] = useState<boolean>(false);

  // Nome da clínica para a prévia "como o paciente recebe".
  const { data: clinicName = '' } = useQuery({
    queryKey: ['clinic-name', clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle();
      return (data as any)?.name ?? '';
    },
  });

  // Avisos de dados faltando: só relevantes quando a automação está ativa e há
  // pacientes cadastrados. Mostra quantos ficarão de fora por falta de dado.
  const dataWarnings = useMemo(() => {
    if (!active || !coverage || coverage.total === 0) return [] as string[];
    const reqs = AUTOMATION_DATA_REQUIREMENTS[def.type];
    const warnings: string[] = [];
    const plural = (n: number) => (n === 1 ? 'paciente' : 'pacientes');
    if (reqs.includes('phone') && coverage.missingPhone > 0) {
      warnings.push(
        coverage.missingPhone === coverage.total
          ? 'Nenhum paciente tem telefone cadastrado — esta automação não enviará para ninguém.'
          : `${coverage.missingPhone} ${plural(coverage.missingPhone)} sem telefone não receberão.`,
      );
    }
    if (reqs.includes('birthDate') && coverage.missingBirthDate > 0) {
      warnings.push(
        coverage.missingBirthDate === coverage.total
          ? 'Nenhum paciente tem data de nascimento cadastrada — ninguém receberá o aniversário.'
          : `${coverage.missingBirthDate} ${plural(coverage.missingBirthDate)} sem data de nascimento não receberão.`,
      );
    }
    return warnings;
  }, [active, coverage, def.type]);

  useEffect(() => {
    setActive(record?.active ?? false);
    setMessage(record?.message?.trim() ? record.message : def.defaultMessage);
    setImageUrl(record?.image_url ?? '');
    setTriggerKeywords(record?.trigger_keywords ?? '');
    setTargetPhone(record?.target_phone ?? '');
    setReturnDays(String((record as any)?.return_after_days ?? 180));
  }, [record?.id, record?.active, record?.message, record?.image_url, record?.trigger_keywords, record?.target_phone, def.defaultMessage]);

  const dirty = useMemo(
    () =>
      (record?.active ?? false) !== active ||
      (record?.message?.trim() ? record.message : def.defaultMessage) !== message ||
      (isBirthday && (record?.image_url ?? '') !== imageUrl) ||
      (isReturn && String((record as any)?.return_after_days ?? 180) !== returnDays) ||
      (isEscalate &&
        ((record?.trigger_keywords ?? '') !== triggerKeywords ||
          (record?.target_phone ?? '') !== targetPhone)),
    [record, active, message, imageUrl, triggerKeywords, targetPhone, returnDays, isEscalate, isReturn, isBirthday, def.defaultMessage],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { type: def.type, enabled: active, message_template: message };
      if (isEscalate) {
        payload.trigger_keywords = triggerKeywords;
        payload.target_phone = targetPhone;
      }
      if (isReturn) {
        payload.return_after_days = Number(returnDays) || 180;
      }
      if (isBirthday) {
        payload.image_url = imageUrl || null;
      }
      if (record?.id) {
        return aiBackend.updateAutomation(clinicId, record.id, payload);
      }
      return aiBackend.createAutomation(clinicId, payload);
    },
    onSuccess: () => {
      toast.success('Automação salva');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar'),
  });

  return (
    <Card
      className={cn(
        'rounded-xl shadow-sm transition-all',
        active
          ? 'border-primary/60 ring-1 ring-primary/30'
          : 'border-border bg-muted/30 opacity-80',
      )}
    >
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{def.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        {dataWarnings.length > 0 && (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div className="space-y-0.5">
              {dataWarnings.map((w, i) => (
                <p key={i} className="leading-snug">{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Mensagem: prévia pronta + edição opcional (escondida por padrão) */}
        <div className="space-y-2">
          {/* Prévia "como o paciente recebe" — sem mostrar {} */}
          <div className={cn('rounded-lg border p-2.5', active ? 'bg-primary/5 border-primary/20' : 'bg-muted/40')}>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Como o paciente recebe
            </p>
            <p className="text-sm leading-snug text-foreground/90">
              {renderPreview(message, clinicName)}
            </p>
          </div>

          {/* Aniversário: anexar imagem (cartão) */}
          {isBirthday && (
            <div className="space-y-1.5">
              <Label className="text-xs">Imagem do cartão (opcional)</Label>
              {imageUrl ? (
                <div className="flex items-center gap-2">
                  <img src={imageUrl} alt="Cartão" className="h-14 w-14 rounded-md object-cover border" />
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setImageUrl('')} disabled={!active}>
                    Remover
                  </Button>
                </div>
              ) : (
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Cole a URL da imagem (ex: https://...)"
                  disabled={!active}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}
              <p className="text-[11px] text-muted-foreground">A imagem é enviada junto com a mensagem de parabéns.</p>
            </div>
          )}

          {/* Botão para revelar o editor — fluxo comum nem abre */}
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!active}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Personalizar mensagem
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Editar mensagem</Label>
                <button
                  type="button"
                  onClick={() => { setMessage(def.defaultMessage); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Restaurar padrão
                </button>
              </div>
              <Textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={!active}
                className="resize-none text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Você pode usar: <code className="rounded bg-muted px-1">{'{patient_name}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{date}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{time}'}</code>{' '}
                <code className="rounded bg-muted px-1">{'{clinic_name}'}</code> — serão preenchidos automaticamente.
              </p>
            </div>
          )}
        </div>

        {isEscalate && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Palavras-chave para escalar</Label>
              <input
                type="text"
                value={triggerKeywords}
                onChange={(e) => setTriggerKeywords(e.target.value)}
                placeholder="urgente, dor, emergência"
                disabled={!active}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                Separe por vírgula. Se o paciente usar qualquer uma dessas palavras, a IA encaminha automaticamente para humano.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone de apoio (opcional)</Label>
              <input
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="5592..."
                disabled={!active}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                Número que o paciente pode contatar fora do horário.
              </p>
            </div>
          </>
        )}

        {isReturn && (
          <div className="space-y-1.5">
            <Label className="text-xs">Enviar após quantos dias da última consulta?</Label>
            <input
              type="number"
              min={1}
              value={returnDays}
              onChange={(e) => setReturnDays(e.target.value)}
              placeholder="180"
              disabled={!active}
              className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Ex: 180 dias = lembrete de retorno a cada 6 meses.
            </p>
          </div>
        )}

        <div className="mt-auto flex justify-end">
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
