import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, Plus, Pencil, Trash2, Loader2, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  clinicId: string | null;
}

interface NpsSurvey {
  id: string;
  clinic_id: string;
  name: string;
  question: string;
  scale_min: number;
  scale_max: number;
  send_after_hours: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface NpsResponse {
  id: string;
  clinic_id: string;
  survey_id: string | null;
  patient_id: string | null;
  appointment_id: string | null;
  patient_phone: string | null;
  score: number | null;
  comment: string | null;
  category: string | null;
  status: string;
  sent_at: string;
  answered_at: string | null;
}

const DEFAULT_QUESTION =
  'Olá {patient_name}, como foi seu atendimento hoje? De 0 a 10, o quanto você recomendaria a {clinic_name}?';

function renderPreview(message: string, clinicName: string): string {
  return (message || '')
    .replace(/\{patient_name\}/g, 'Maria')
    .replace(/\{clinic_name\}/g, clinicName || 'sua clínica')
    .replace(/\{procedure\}/g, 'Limpeza');
}

function categoryOf(score: number | null): 'promoter' | 'passive' | 'detractor' | null {
  if (score === null || score === undefined) return null;
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

export function NpsPanel({ clinicId }: Props) {
  if (!clinicId) {
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
        <h2 className="text-base font-semibold">Pesquisa de satisfação (NPS)</h2>
        <p className="text-xs text-muted-foreground">
          Crie um ou mais questionários. A IA Secretária envia pelo WhatsApp algumas horas
          após a consulta e registra a nota dada pelo paciente.
        </p>
      </div>

      <Tabs defaultValue="questionnaires" className="w-full">
        <TabsList>
          <TabsTrigger value="questionnaires" className="gap-1.5">
            <Star className="h-3.5 w-3.5" />
            Questionários
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Respostas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questionnaires" className="mt-4">
          <SurveysSection clinicId={clinicId} />
        </TabsContent>

        <TabsContent value="responses" className="mt-4">
          <ResponsesSection clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Questionários ────────────────────────────────────────────────────────────
function SurveysSection({ clinicId }: { clinicId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<NpsSurvey | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['nps-surveys', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_surveys' as any)
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as NpsSurvey[]) ?? [];
    },
  });

  const { data: clinicName = '' } = useQuery({
    queryKey: ['clinic-name', clinicId],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle();
      return (data as any)?.name ?? '';
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nps_surveys' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Questionário removido');
      qc.invalidateQueries({ queryKey: ['nps-surveys', clinicId] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('nps_surveys' as any)
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nps-surveys', clinicId] }),
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {surveys.length} questionário(s). Marque um como padrão para usar quando a consulta não apontar um específico.
        </p>
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo questionário
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : surveys.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum questionário criado ainda. Clique em "Novo questionário" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {surveys.map((s) => (
            <Card
              key={s.id}
              className={cn(
                'rounded-xl shadow-sm transition-all',
                s.is_active ? 'border-primary/40' : 'bg-muted/30 opacity-80',
              )}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      {s.is_default && (
                        <Badge variant="secondary" className="text-[10px]">Padrão</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Escala {s.scale_min}–{s.scale_max} · envia {s.send_after_hours}h após a consulta
                    </p>
                  </div>
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: s.id, is_active: v })}
                  />
                </div>
                <div className="rounded-lg border bg-muted/40 p-2.5">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Como o paciente recebe
                  </p>
                  <p className="text-sm leading-snug text-foreground/90">
                    {renderPreview(s.question, clinicName)}
                  </p>
                </div>
                <div className="mt-auto flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(s)} className="h-8 gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteId(s.id)}
                    className="h-8 gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SurveyFormDialog
        clinicId={clinicId}
        clinicName={clinicName}
        open={creating || !!editing}
        survey={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover questionário?</AlertDialogTitle>
            <AlertDialogDescription>
              As respostas já registradas serão mantidas, mas o questionário não enviará mais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Form de questionário ─────────────────────────────────────────────────────
function SurveyFormDialog({
  clinicId,
  clinicName,
  open,
  survey,
  onClose,
}: {
  clinicId: string;
  clinicName: string;
  open: boolean;
  survey: NpsSurvey | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [scaleMin, setScaleMin] = useState(0);
  const [scaleMax, setScaleMax] = useState(10);
  const [sendAfter, setSendAfter] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (open) {
      setName(survey?.name ?? '');
      setQuestion(survey?.question ?? DEFAULT_QUESTION);
      setScaleMin(survey?.scale_min ?? 0);
      setScaleMax(survey?.scale_max ?? 10);
      setSendAfter(survey?.send_after_hours ?? 3);
      setIsActive(survey?.is_active ?? true);
      setIsDefault(survey?.is_default ?? false);
    }
  }, [open, survey]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        clinic_id: clinicId,
        name: name.trim(),
        question: question.trim(),
        scale_min: scaleMin,
        scale_max: scaleMax,
        send_after_hours: sendAfter,
        is_active: isActive,
        is_default: isDefault,
      };

      // Se este vai ser o padrão, desmarca os outros antes.
      if (isDefault) {
        await supabase
          .from('nps_surveys' as any)
          .update({ is_default: false })
          .eq('clinic_id', clinicId)
          .neq('id', survey?.id ?? '00000000-0000-0000-0000-000000000000');
      }

      if (survey?.id) {
        const { error } = await supabase.from('nps_surveys' as any).update(payload).eq('id', survey.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nps_surveys' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(survey ? 'Questionário atualizado' : 'Questionário criado');
      qc.invalidateQueries({ queryKey: ['nps-surveys', clinicId] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar'),
  });

  const canSave = name.trim().length > 0 && question.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{survey ? 'Editar questionário' : 'Novo questionário'}</DialogTitle>
          <DialogDescription>
            Defina a pergunta enviada ao paciente e quando deve ser enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome interno</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ex: "Pós-limpeza", "Geral"'
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Pergunta enviada ao paciente</Label>
            <Textarea
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Você pode usar: <code className="rounded bg-muted px-1">{'{patient_name}'}</code>{' '}
              <code className="rounded bg-muted px-1">{'{clinic_name}'}</code>{' '}
              <code className="rounded bg-muted px-1">{'{procedure}'}</code>
            </p>
          </div>

          <div className="rounded-lg border bg-primary/5 p-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Prévia
            </p>
            <p className="text-sm leading-snug text-foreground/90">
              {renderPreview(question, clinicName)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Escala min.</Label>
              <Input
                type="number"
                value={scaleMin}
                min={0}
                max={10}
                onChange={(e) => setScaleMin(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Escala max.</Label>
              <Input
                type="number"
                value={scaleMax}
                min={1}
                max={10}
                onChange={(e) => setScaleMax(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Enviar após (h)</Label>
              <Input
                type="number"
                value={sendAfter}
                min={0}
                max={168}
                onChange={(e) => setSendAfter(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-[11px] text-muted-foreground">A IA poderá enviar este questionário.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Padrão</p>
              <p className="text-[11px] text-muted-foreground">
                Usado quando a consulta não apontar um questionário específico.
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Respostas / painel ──────────────────────────────────────────────────────
function ResponsesSection({ clinicId }: { clinicId: string }) {
  const [surveyFilter, setSurveyFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'30' | '90' | 'all'>('30');

  const { data: surveys = [] } = useQuery({
    queryKey: ['nps-surveys', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_surveys' as any)
        .select('id, name')
        .eq('clinic_id', clinicId);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const sinceIso = useMemo(() => {
    if (periodFilter === 'all') return null;
    const days = periodFilter === '30' ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [periodFilter]);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['nps-responses', clinicId, surveyFilter, periodFilter],
    queryFn: async () => {
      let q = supabase
        .from('nps_responses' as any)
        .select('*')
        .eq('clinic_id', clinicId)
        .order('sent_at', { ascending: false })
        .limit(500);
      if (surveyFilter !== 'all') q = q.eq('survey_id', surveyFilter);
      if (sinceIso) q = q.gte('sent_at', sinceIso);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as NpsResponse[]) ?? [];
    },
  });

  // Busca nomes dos pacientes referenciados
  const patientIds = useMemo(
    () => Array.from(new Set(responses.map((r) => r.patient_id).filter(Boolean))) as string[],
    [responses],
  );
  const { data: patientsMap = {} } = useQuery({
    queryKey: ['nps-patients', patientIds],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name')
        .in('id', patientIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name; });
      return map;
    },
  });

  const stats = useMemo(() => {
    const sent = responses.length;
    const answered = responses.filter((r) => r.score !== null && r.score !== undefined);
    const total = answered.length;
    const promoters = answered.filter((r) => (r.score ?? 0) >= 9).length;
    const passives = answered.filter((r) => (r.score ?? 0) >= 7 && (r.score ?? 0) < 9).length;
    const detractors = answered.filter((r) => (r.score ?? 0) <= 6).length;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
    const avg = total > 0 ? answered.reduce((s, r) => s + (r.score ?? 0), 0) / total : null;
    const responseRate = sent > 0 ? Math.round((total / sent) * 100) : 0;
    return { sent, total, promoters, passives, detractors, nps, avg, responseRate };
  }, [responses]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={surveyFilter} onValueChange={setSurveyFilter}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Todos os questionários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os questionários</SelectItem>
            {surveys.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="NPS"
          value={stats.nps === null ? '—' : String(stats.nps)}
          hint="% promoters − % detractors"
          highlight
        />
        <StatCard
          label="Média"
          value={stats.avg === null ? '—' : stats.avg.toFixed(1)}
          hint="Média das notas"
        />
        <StatCard
          label="Respondidas"
          value={String(stats.total)}
          hint={`${stats.sent} enviadas`}
        />
        <StatCard
          label="Taxa de resposta"
          value={`${stats.responseRate}%`}
          hint="Respondidas / enviadas"
        />
      </div>

      {/* Distribuição */}
      {stats.total > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="space-y-3 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Distribuição
            </p>
            <DistributionBar
              label="Promoters (9–10)"
              count={stats.promoters}
              total={stats.total}
              color="bg-emerald-500"
            />
            <DistributionBar
              label="Passives (7–8)"
              count={stats.passives}
              total={stats.total}
              color="bg-yellow-500"
            />
            <DistributionBar
              label="Detractors (0–6)"
              count={stats.detractors}
              total={stats.total}
              color="bg-red-500"
            />
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : responses.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma pesquisa enviada ainda neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Paciente</th>
                    <th className="px-4 py-2 text-left font-medium">Nota</th>
                    <th className="px-4 py-2 text-left font-medium">Comentário</th>
                    <th className="px-4 py-2 text-left font-medium">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => {
                    const cat = categoryOf(r.score);
                    return (
                      <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <div className="truncate">{(r.patient_id && patientsMap[r.patient_id]) || r.patient_phone || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.score === null || r.score === undefined ? (
                            <Badge variant="outline" className="text-[10px]">aguardando</Badge>
                          ) : (
                            <Badge
                              className={cn(
                                'text-[11px]',
                                cat === 'promoter' && 'bg-emerald-500 hover:bg-emerald-500',
                                cat === 'passive' && 'bg-yellow-500 hover:bg-yellow-500',
                                cat === 'detractor' && 'bg-red-500 hover:bg-red-500',
                              )}
                            >
                              {r.score}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {r.comment || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.answered_at ?? r.sent_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn('rounded-xl shadow-sm', highlight && 'border-primary/40 bg-primary/5')}>
      <CardContent className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-semibold tracking-tight', highlight && 'text-primary')}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} · {pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}