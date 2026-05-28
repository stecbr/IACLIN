import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  SUB_STATUS_LABELS, CYCLE_LABELS, METHOD_LABELS, formatBRL,
  type SubStatus, type BillingCycle, type PaymentMethod, type DiscountType,
  type PlatformSubscription, type PlatformPlan, type PlanSegment,
} from '@/types/superadmin';
import { fetchAdminData } from '@/hooks/usePlatformAdminData';

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: PlanSegment;
  entityId: string;
  entityName: string;
  current: PlatformSubscription | null;
  invalidateKeys: string[][];
}

export function SubscriptionDialog({
  open, onClose, entityType, entityId, entityName, current, invalidateKeys,
}: Props) {
  const qc = useQueryClient();

  const { data: plans = [] } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => fetchAdminData<PlatformPlan[]>('plans'),
    enabled: open,
  });

  const [planId, setPlanId] = useState<string>(current?.plan_id ?? '');
  const [cycle, setCycle] = useState<BillingCycle>(current?.billing_cycle ?? 'monthly');
  const [status, setStatus] = useState<SubStatus>(current?.status ?? 'trial');
  const [method, setMethod] = useState<PaymentMethod>(current?.payment_method ?? 'manual');
  const [discType, setDiscType] = useState<DiscountType | ''>(current?.discount_type ?? '');
  const [discValue, setDiscValue] = useState(current?.discount_value?.toString() ?? '');
  const [dueDate, setDueDate] = useState(current?.due_date ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const eligible = useMemo(
    () => plans.filter(p => p.segment === entityType && p.is_active && p.billing_cycle === cycle),
    [plans, entityType, cycle]
  );

  const selectedPlan = plans.find(p => p.id === planId);
  const base = selectedPlan?.price_cents ?? 0;
  const finalCents = useMemo(() => {
    const v = parseFloat(discValue.replace(',', '.'));
    if (!discType || isNaN(v) || v <= 0) return base;
    if (discType === 'percent') return Math.max(0, Math.floor(base * (1 - Math.min(v, 100) / 100)));
    return Math.max(0, base - Math.floor(v * 100));
  }, [base, discType, discValue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc('upsert_platform_subscription', {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_plan_id: planId || null,
        p_billing_cycle: cycle,
        p_status: status,
        p_payment_method: method,
        p_discount_type: discType || null,
        p_discount_value: discType && discValue ? parseFloat(discValue.replace(',', '.')) : null,
        p_coupon_id: null,
        p_due_date: dueDate || null,
        p_notes: notes || null,
      });
      if (error) throw error;
      for (const key of invalidateKeys) await qc.invalidateQueries({ queryKey: key });
      toast.success('Assinatura salva!');
      onClose();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'desconhecido'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assinatura — {entityName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ciclo</Label>
              <Select value={cycle} onValueChange={v => setCycle(v as BillingCycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CYCLE_LABELS) as [BillingCycle, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as SubStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(SUB_STATUS_LABELS) as [SubStatus, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder={eligible.length ? 'Selecione um plano...' : 'Nenhum plano para este ciclo/segmento'} />
              </SelectTrigger>
              <SelectContent>
                {eligible.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatBRL(p.price_cents)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento padrão</Label>
            <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Desconto</Label>
              <Select value={discType || 'none'} onValueChange={v => setDiscType(v === 'none' ? '' : v as DiscountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem desconto</SelectItem>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input
                type="number"
                value={discValue}
                onChange={e => setDiscValue(e.target.value)}
                disabled={!discType}
                placeholder={discType === 'percent' ? '10' : '50,00'}
              />
            </div>
          </div>

          {selectedPlan && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Valor base</span><span>{formatBRL(base)}</span></div>
              <div className="flex justify-between font-semibold"><span>Valor final</span><span className="text-primary">{formatBRL(finalCents)}</span></div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Próximo vencimento</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: contrato anual, condição especial..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !planId}>
            {saving ? 'Salvando...' : 'Salvar assinatura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
