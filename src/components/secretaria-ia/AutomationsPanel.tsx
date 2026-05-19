import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell,
  CheckCircle2,
  CalendarClock,
  RotateCcw,
  UserCog,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Zap,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  aiBackend,
  isAiBackendConfigured,
  type AiAutomation,
  type AiAutomationInput,
  type AiAutomationType,
} from '@/lib/aiBackend';

interface Props {
  clinicId: string | null;
}

const TYPE_META: Record<AiAutomationType, { label: string; icon: typeof Bell; hint: string }> = {
  reminder: { label: 'Lembrete de consulta', icon: Bell, hint: 'Ex: 24h antes da consulta' },
  confirmation: { label: 'Confirmação', icon: CheckCircle2, hint: 'Ex: ao agendar' },
  return: { label: 'Retorno', icon: RotateCcw, hint: 'Ex: 6 meses após a última consulta' },
  reschedule: { label: 'Reagendamento', icon: CalendarClock, hint: 'Ex: após no-show' },
  handoff: { label: 'Encaminhamento humano', icon: UserCog, hint: 'Ex: palavra-chave "atendente"' },
};

const TYPE_OPTIONS = Object.entries(TYPE_META) as [AiAutomationType, (typeof TYPE_META)[AiAutomationType]][];

const VARIABLES = ['{patient_name}', '{date}', '{time}', '{clinic_name}', '{doctor_name}'];

const EMPTY_FORM: AiAutomationInput = {
  name: '',
  type: 'reminder',
  enabled: true,
  trigger: '24h antes da consulta',
  template: 'Olá {patient_name}, lembrete da sua consulta em {date} às {time}. Confirma sua presença?',
};

function normalize(payload: unknown): AiAutomation[] {
  if (Array.isArray(payload)) return payload as AiAutomation[];
  const data = (payload as { data?: AiAutomation[] })?.data;
  return Array.isArray(data) ? data : [];
}

export function AutomationsPanel({ clinicId }: Props) {
  const qc = useQueryClient();
  const enabled = !!clinicId && isAiBackendConfigured();

  const { data: automations = [], isLoading, isError, error } = useQuery({
    queryKey: ['ai-automations', clinicId],
    queryFn: async () => normalize(await aiBackend.listAutomations(clinicId as string)),
    enabled,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiAutomation | null>(null);
  const [form, setForm] = useState<AiAutomationInput>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<AiAutomation | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type,
        enabled: editing.enabled,
        trigger: editing.trigger,
        template: editing.template,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [dialogOpen, editing]);

  const createMutation = useMutation({
    mutationFn: (payload: AiAutomationInput) =>
      aiBackend.createAutomation(clinicId as string, payload),
    onSuccess: () => {
      toast.success('Automação criada');
      qc.invalidateQueries({ queryKey: ['ai-automations', clinicId] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao criar automação'),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; payload: Partial<AiAutomationInput> & { enabled?: boolean } }) =>
      aiBackend.updateAutomation(clinicId as string, vars.id, vars.payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-automations', clinicId] });
      if (vars.payload.name || vars.payload.template || vars.payload.trigger || vars.payload.type) {
        toast.success('Automação atualizada');
        setDialogOpen(false);
      }
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar automação'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiBackend.deleteAutomation(clinicId as string, id),
    onSuccess: () => {
      toast.success('Automação removida');
      qc.invalidateQueries({ queryKey: ['ai-automations', clinicId] });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover automação'),
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Dê um nome para a automação');
    if (!form.template.trim()) return toast.error('Escreva a mensagem template');
    if (!form.trigger.trim()) return toast.error('Defina o gatilho');
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (a: AiAutomation) => {
    setEditing(a);
    setDialogOpen(true);
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Automações de WhatsApp</h2>
          <p className="text-xs text-muted-foreground">
            Fluxos automáticos que a IA envia para o paciente. Use variáveis como{' '}
            <code className="rounded bg-muted px-1">{'{patient_name}'}</code>,{' '}
            <code className="rounded bg-muted px-1">{'{date}'}</code> e{' '}
            <code className="rounded bg-muted px-1">{'{time}'}</code>.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova automação
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <Card className="rounded-xl border-destructive/30 shadow-sm">
          <CardContent className="py-6 text-sm text-destructive">
            Não foi possível carregar as automações. {(error as Error)?.message}
          </CardContent>
        </Card>
      ) : automations.length === 0 ? (
        <Card className="rounded-xl border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhuma automação ainda</p>
              <p className="text-xs text-muted-foreground">
                Crie a primeira para começar a enviar lembretes e confirmações automaticamente.
              </p>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Criar automação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {automations.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.reminder;
            const Icon = meta.icon;
            return (
              <Card key={a.id} className="rounded-xl shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Gatilho: {a.trigger}
                    </p>
                  </div>
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(v) =>
                      updateMutation.mutate({ id: a.id, payload: { enabled: v } })
                    }
                    disabled={updateMutation.isPending}
                  />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDelete(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar automação' : 'Nova automação'}</DialogTitle>
            <DialogDescription>
              Configure quando a IA envia a mensagem e o conteúdo do template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Lembrete 24h"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as AiAutomationType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ativa</Label>
                <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.enabled ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gatilho</Label>
              <Input
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                placeholder={TYPE_META[form.type].hint}
              />
              <p className="text-xs text-muted-foreground">{TYPE_META[form.type].hint}</p>
            </div>
            <div className="space-y-2">
              <Label>Mensagem template</Label>
              <Textarea
                rows={5}
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
                placeholder="Olá {patient_name}, sua consulta é em {date} às {time}."
              />
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, template: `${f.template}${v}` }))}
                    className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-mono hover:bg-muted"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editing ? 'Salvar alterações' : 'Criar automação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover automação?</AlertDialogTitle>
            <AlertDialogDescription>
              A automação <b>{confirmDelete?.name}</b> será removida e os disparos futuros serão
              cancelados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
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