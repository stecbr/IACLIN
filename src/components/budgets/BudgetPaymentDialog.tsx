import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, ShieldCheck, Banknote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Method = 'card' | 'insurance' | 'cash_pix';

const METHODS: { id: Method; label: string; icon: any; hint: string }[] = [
  { id: 'card', label: 'Cartão', icon: CreditCard, hint: 'Crédito ou débito na maquininha' },
  { id: 'insurance', label: 'Convênio', icon: ShieldCheck, hint: 'Cobrança via plano' },
  { id: 'cash_pix', label: 'Dinheiro / Pix', icon: Banknote, hint: 'Pago em espécie ou Pix' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: {
    id: string;
    title: string;
    total_cost: number;
    patient_id?: string | null;
    dentist_id?: string | null;
    clinic_id?: string | null;
    patient_name?: string | null;
  } | null;
}

export function BudgetPaymentDialog({ open, onOpenChange, plan }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [method, setMethod] = useState<Method | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setMethod(null);
      setNotes('');
    }
  }, [open]);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!plan) throw new Error('Orçamento não encontrado');
      if (!method) throw new Error('Escolha a forma de pagamento');
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);

      // 1) Atualiza cobranças pendentes vinculadas ao orçamento, se houver
      await supabase
        .from('financial_transactions')
        .update({
          status: 'paid',
          paid_date: today,
          payment_method: method,
        })
        .eq('treatment_plan_id', plan.id)
        .eq('status', 'pending');

      // 2) Garante um registro consolidado de pagamento do orçamento
      const { data: existing } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('treatment_plan_id', plan.id)
        .eq('status', 'paid')
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error: txErr } = await supabase.from('financial_transactions').insert({
          type: 'income',
          category: 'procedure',
          description: `Pagamento orçamento — ${plan.title}`,
          amount: Number(plan.total_cost) || 0,
          payment_method: method,
          status: 'paid',
          due_date: today,
          paid_date: today,
          patient_id: plan.patient_id ?? null,
          dentist_id: plan.dentist_id ?? null,
          clinic_id: plan.clinic_id ?? null,
          treatment_plan_id: plan.id,
          notes: notes.trim() || null,
        });
        if (txErr) throw txErr;
      }

      // 3) Marca orçamento como realizado
      const { error: planErr } = await supabase
        .from('treatment_plans')
        .update({
          status: 'realized',
          payment_method: method,
          paid_at: nowIso,
          payment_recorded_by: user?.id ?? null,
          payment_notes: notes.trim() || null,
        })
        .eq('id', plan.id);
      if (planErr) throw planErr;

      // 4) Notifica o paciente (busca patient_user_id)
      if (plan.patient_id) {
        const { data: pat } = await supabase
          .from('patients')
          .select('patient_user_id')
          .eq('id', plan.patient_id)
          .maybeSingle();
        if (pat?.patient_user_id) {
          await supabase.from('notifications').insert({
            clinic_id: plan.clinic_id ?? null,
            user_id: pat.patient_user_id,
            type: 'budget',
            title: 'Pagamento confirmado',
            message: `Recebemos o pagamento do orçamento "${plan.title}". Obrigado!`,
            reference_id: plan.id,
            reference_type: 'treatment_plan',
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatment-plans-kanban'] });
      qc.invalidateQueries({ queryKey: ['treatment-plan-detail'] });
      qc.invalidateQueries({ queryKey: ['patient-transactions'] });
      qc.invalidateQueries({ queryKey: ['patient-financial-status'] });
      qc.invalidateQueries({ queryKey: ['patients-financial-status-bulk'] });
      qc.invalidateQueries({ queryKey: ['patient-budgets-pending'] });
      toast.success('Pagamento registrado');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao registrar pagamento'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {plan?.patient_name ?? 'Paciente'} · {plan?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor total</span>
            <span className="text-xl font-semibold text-foreground">
              R$ {Number(plan?.total_cost ?? 0).toFixed(2).replace('.', ',')}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Forma de pagamento</p>
            <div className="grid grid-cols-1 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                        : 'border-border/60 hover:bg-muted/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Observação (opcional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: pago parcialmente no caixa, recibo emitido…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirm.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => confirm.mutate()} disabled={!method || confirm.isPending}>
            {confirm.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}