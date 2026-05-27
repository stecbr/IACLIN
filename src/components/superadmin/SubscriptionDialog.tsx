import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SUB_STATUS_LABELS, PLAN_OPTIONS, type SubStatus, type PlatformSubscription } from '@/types/superadmin';

interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: 'clinic' | 'doctor';
  entityId: string;
  entityName: string;
  current: PlatformSubscription | null;
  /** Query keys para invalidar após salvar */
  invalidateKeys: string[][];
}

export function SubscriptionDialog({
  open,
  onClose,
  entityType,
  entityId,
  entityName,
  current,
  invalidateKeys,
}: SubscriptionDialogProps) {
  const qc = useQueryClient();

  const [planName,    setPlanName]    = useState(current?.plan_name    ?? 'Básico');
  const [status,      setStatus]      = useState<SubStatus>(current?.status ?? 'trial');
  const [amountBrl,   setAmountBrl]   = useState(
    current ? (current.amount_cents / 100).toFixed(2) : '0.00'
  );
  const [dueDate,     setDueDate]     = useState(current?.due_date ?? '');
  const [notes,       setNotes]       = useState(current?.notes ?? '');
  const [saving,      setSaving]      = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cents = Math.round(parseFloat(amountBrl.replace(',', '.')) * 100) || 0;
      const { error } = await (supabase as any).rpc('upsert_platform_subscription', {
        p_entity_type:   entityType,
        p_entity_id:     entityId,
        p_plan_name:     planName,
        p_status:        status,
        p_amount_cents:  cents,
        p_due_date:      dueDate || null,
        p_notes:         notes || null,
      });
      if (error) throw error;
      for (const key of invalidateKeys) {
        await qc.invalidateQueries({ queryKey: key });
      }
      toast.success('Assinatura salva com sucesso!');
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message ?? 'Desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assinatura — {entityName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Plano */}
          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={planName} onValueChange={setPlanName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as SubStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SUB_STATUS_LABELS) as [SubStatus, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor mensal */}
          <div className="space-y-1.5">
            <Label>Valor mensal (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                className="pl-9"
                value={amountBrl}
                onChange={e => setAmountBrl(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Data de vencimento */}
          <div className="space-y-1.5">
            <Label>Data de vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: pagamento via PIX, contrato especial..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
