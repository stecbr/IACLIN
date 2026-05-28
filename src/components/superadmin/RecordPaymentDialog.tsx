import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { METHOD_LABELS, type PaymentMethod, type PlatformSubscription } from '@/types/superadmin';

interface Props {
  open: boolean;
  onClose: () => void;
  subscription: PlatformSubscription;
  entityName: string;
}

export function RecordPaymentDialog({ open, onClose, subscription, entityName }: Props) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [amountBrl, setAmountBrl] = useState(((subscription.final_amount_cents || subscription.amount_cents) / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16));
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const amount_cents = Math.round(parseFloat(amountBrl.replace(',', '.')) * 100) || 0;
      const { error } = await (supabase as any).from('platform_payments').insert({
        subscription_id: subscription.id,
        amount_cents,
        method,
        status: 'paid',
        paid_at: new Date(paidAt).toISOString(),
        receipt_url: receiptUrl || null,
        notes: notes || null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['platform-payments'] });
      await qc.invalidateQueries({ queryKey: ['platform-clinics'] });
      await qc.invalidateQueries({ queryKey: ['platform-doctors'] });
      await qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Pagamento registrado!');
      onClose();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'desconhecido'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento — {entityName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input value={amountBrl} onChange={e => setAmountBrl(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data e hora do pagamento</Label>
            <Input type="datetime-local" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>URL do comprovante (opcional)</Label>
            <Input value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Ao confirmar, o vencimento da assinatura será estendido automaticamente conforme o ciclo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Confirmar pagamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}