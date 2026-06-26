import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, User as UserIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSoloMode } from '@/hooks/useSoloMode';
import { Download, Loader2, Wallet } from 'lucide-react';
import { generateBudgetPdf, fetchClinicForPdf } from '@/lib/generateBudgetPdf';
import { BudgetPaymentDialog } from './BudgetPaymentDialog';

interface BudgetDetailDialogProps {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'awaiting_payment', label: 'Aguardando pagamento' },
  { value: 'realized', label: 'Realizado' },
  { value: 'not_approved', label: 'Não aprovado' },
];

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  awaiting_payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  realized: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  not_approved: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

export function BudgetDetailDialog({ planId, open, onOpenChange }: BudgetDetailDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isClinicOwner } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const { isSolo } = useSoloMode();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: plan, isLoading } = useQuery({
    queryKey: ['treatment-plan-detail', planId],
    enabled: !!planId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_plans')
        .select(
          '*, patients(id, full_name, cpf, phone, email), treatment_plan_items(id, tooth_number, price, notes, custom_procedure_name, procedures(name))'
        )
        .eq('id', planId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleGeneratePdf = async () => {
    if (!plan) return;
    setGeneratingPdf(true);
    try {
      const clinic = await fetchClinicForPdf((plan as any).clinic_id ?? null);
      const p = (plan as any).patients ?? {};
      const items = ((plan as any).treatment_plan_items ?? []).map((it: any) => ({
        id: it.id,
        procedure_id: it.procedure_id,
        price: Number(it.price) || 0,
        tooth_number: it.tooth_number ?? null,
        notes: it.notes ?? null,
        procedures: { name: it.procedures?.name ?? it.custom_procedure_name ?? 'Procedimento' },
      }));
      await generateBudgetPdf({
        plan: {
          id: plan.id,
          title: plan.title ?? 'Orçamento',
          description: (plan as any).description ?? null,
          status: plan.status ?? 'pending',
          total_cost: Number((plan as any).total_cost) || 0,
          created_at: plan.created_at,
          treatment_plan_items: items,
        },
        patient: {
          full_name: p.full_name ?? 'Paciente',
          cpf: p.cpf ?? null,
          phone: p.phone ?? null,
          email: p.email ?? null,
        },
        clinic: clinic ?? null,
      });
      toast.success('PDF gerado. Use a janela de impressão para salvar.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      // Approval is special: may auto-generate financial charges
      if (status === 'approved') {
        const canApproveForClinic =
          isSolo || isClinicOwner || effectiveRole === 'admin' || effectiveRole === 'secretary';
        if (!canApproveForClinic) {
          throw new Error(
            'Apenas a secretaria ou admin da clínica pode aprovar este orçamento. Mantenha como "Pendente" e aguarde a aprovação.'
          );
        }
      }

      const { error } = await supabase
        .from('treatment_plans')
        .update({ status })
        .eq('id', planId!);
      if (error) throw error;

      if (status === 'approved' && plan) {
        const items = (plan as any).treatment_plan_items ?? [];
        if (items.length > 0) {
          // Atomic check-and-set: only mark charges_generated_at if it was NULL
          // This prevents duplicate charges on concurrent/rapid clicks
          const { data: claimed } = await supabase
            .from('treatment_plans')
            .update({ charges_generated_at: new Date().toISOString() })
            .eq('id', planId!)
            .is('charges_generated_at', null)
            .select('id');

          if (claimed && claimed.length > 0) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const rows = items.map((it: any) => ({
              type: 'income' as const,
              category: 'procedure',
              description: `${it.procedures?.name ?? it.custom_procedure_name ?? 'Procedimento'}${it.tooth_number ? ` (dente ${it.tooth_number})` : ''} — ${plan.title ?? 'Orçamento'}`,
              amount: Number(it.price) || 0,
              due_date: today,
              status: 'pending' as const,
              clinic_id: (plan as any).clinic_id ?? null,
              dentist_id: (plan as any).dentist_id ?? user?.id ?? null,
              patient_id: (plan as any).patient_id ?? null,
              treatment_plan_id: planId!,
            }));
            const { error: txErr } = await supabase.from('financial_transactions').insert(rows);
            if (txErr) throw new Error(`Status atualizado, mas falhou ao gerar cobranças: ${txErr.message}`);
          }
        }
      }

      if (status === 'awaiting_payment' && plan) {
        // Notifica paciente
        const patientId = (plan as any).patients?.id;
        if (patientId) {
          const { data: pat } = await supabase
            .from('patients')
            .select('patient_user_id, clinic_id')
            .eq('id', patientId)
            .maybeSingle();
          if (pat?.patient_user_id) {
            await supabase.from('notifications').insert({
              clinic_id: pat.clinic_id ?? null,
              user_id: pat.patient_user_id,
              type: 'budget',
              title: 'Orçamento aprovado — pagamento pendente',
              message: `Seu orçamento "${plan.title}" foi aprovado. Vá até a recepção da clínica para validar o pagamento (R$ ${Number((plan as any).total_cost ?? 0).toFixed(2).replace('.', ',')}).`,
              reference_id: planId!,
              reference_type: 'treatment_plan',
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-plan-detail', planId] });
      queryClient.invalidateQueries({ queryKey: ['patient-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['patient-financial-status'] });
      queryClient.invalidateQueries({ queryKey: ['patients-financial-status-bulk'] });
      toast.success('Status atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async () => {
      const { error: itemsErr } = await supabase
        .from('treatment_plan_items')
        .delete()
        .eq('treatment_plan_id', planId!);
      if (itemsErr) throw itemsErr;
      const { data, error } = await supabase
        .from('treatment_plans')
        .delete()
        .eq('id', planId!)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Não foi possível excluir: você não tem permissão para este orçamento.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans-kanban'] });
      toast.success('Orçamento excluído');
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="truncate">
                  {plan?.title ?? 'Orçamento'}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  {(plan as any)?.patients?.full_name ?? 'Paciente'}
                  {plan?.created_at && (
                    <span className="text-muted-foreground">
                      · {format(new Date(plan.created_at), "dd 'de' MMM yyyy", { locale: ptBR })}
                    </span>
                  )}
                </DialogDescription>
              </div>
              {plan?.status && (
                <Badge className={statusBadge[plan.status] ?? ''} variant="secondary">
                  {STATUS_OPTIONS.find((s) => s.value === plan.status)?.label ?? plan.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {isLoading || !plan ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {plan.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {plan.description}
                </p>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Procedimentos</h3>
                <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                  {(plan as any).treatment_plan_items?.length ? (
                    (plan as any).treatment_plan_items.map((item: any) => (
                      <div key={item.id} className="p-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.procedures?.name ?? item.custom_procedure_name ?? 'Procedimento'}
                            {item.tooth_number && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                · Dente {item.tooth_number}
                              </span>
                            )}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                          R$ {Number(item.price).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">Nenhum item.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-semibold text-foreground">
                  R$ {Number(plan.total_cost).toFixed(2).replace('.', ',')}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select
                  value={plan.status}
                  onValueChange={(v) => updateStatus.mutate(v)}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isSolo && effectiveRole === 'dentist' && (
                  <p className="text-xs text-muted-foreground">
                    A aprovação final e a geração das cobranças são feitas pela secretaria/admin da clínica.
                  </p>
                )}
                {(isSolo || effectiveRole === 'admin' || effectiveRole === 'secretary') && plan.status !== 'approved' && (
                  <p className="text-xs text-muted-foreground">
                    Ao aprovar, o sistema cria automaticamente as cobranças no financeiro do paciente.
                  </p>
                )}
                {plan.status === 'awaiting_payment' && (isSolo || isClinicOwner || effectiveRole === 'admin' || effectiveRole === 'secretary') && (
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    Quando o paciente pagar na recepção, registre o pagamento abaixo.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 mt-4">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={!plan || deletePlan.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Excluir
            </Button>
            {plan?.status === 'awaiting_payment' && (isSolo || isClinicOwner || effectiveRole === 'admin' || effectiveRole === 'secretary') && (
              <Button
                onClick={() => setPaymentOpen(true)}
                className="gap-1.5"
              >
                <Wallet className="h-4 w-4" />
                Registrar pagamento
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleGeneratePdf}
              disabled={!plan || generatingPdf}
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              {generatingPdf ? 'Gerando...' : 'Gerar PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const pid = (plan as any)?.patients?.id;
                if (!pid) return;
                onOpenChange(false);
                navigate(`/patients/${pid}`, { state: { fromBudgetId: planId } });
              }}
              disabled={!plan || !(plan as any)?.patients?.id}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Abrir prontuário
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O orçamento e todos os seus itens serão removidos
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlan.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deletePlan.mutate();
              }}
              disabled={deletePlan.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlan.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BudgetPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        plan={plan ? {
          id: plan.id,
          title: plan.title ?? 'Orçamento',
          total_cost: Number((plan as any).total_cost) || 0,
          patient_id: (plan as any).patient_id ?? null,
          dentist_id: (plan as any).dentist_id ?? null,
          clinic_id: (plan as any).clinic_id ?? null,
          patient_name: (plan as any).patients?.full_name ?? null,
        } : null}
      />
    </>
  );
}
