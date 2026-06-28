import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { useReconcileInvoice, type InvoiceGroup, type GlosaInput } from '@/hooks/useInsuranceInvoices';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPeriod(p: string) {
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

interface ItemState {
  tx_id: string;
  appointment_id: string | null;
  patient: string;
  amount: number;
  glosa_amount: string; // input string
  reason: string;
  status: 'accepted' | 'contested';
}

export function ReconcileInvoiceDialog({
  open,
  onOpenChange,
  group,
  clinicId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: InvoiceGroup | null;
  clinicId: string;
}) {
  const reconcile = useReconcileInvoice();
  const [received, setReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
  const [notes, setNotes] = useState('');
  const [createLoss, setCreateLoss] = useState(true);
  const [items, setItems] = useState<ItemState[]>([]);
  const [generalReason, setGeneralReason] = useState('');

  useEffect(() => {
    if (group && open) {
      setReceived(group.total.toFixed(2));
      setItems(group.items.map((i) => ({
        tx_id: i.id,
        appointment_id: i.appointment_id,
        patient: i.patients?.full_name ?? '—',
        amount: Number(i.amount) || 0,
        glosa_amount: '',
        reason: '',
        status: 'accepted',
      })));
      setNotes('');
      setGeneralReason('');
      setCreateLoss(true);
    }
  }, [group, open]);

  const expected = group?.total ?? 0;
  const receivedNum = Number(received) || 0;
  const diff = expected - receivedNum;
  const needsGlosas = diff > 0.005;
  const sumItemGlosas = items.reduce((s, i) => s + (Number(i.glosa_amount) || 0), 0);
  const remaining = Math.max(0, diff - sumItemGlosas);

  const canConfirm = useMemo(() => {
    if (!group) return false;
    if (receivedNum < 0) return false;
    if (!needsGlosas) return true;
    return Math.abs(diff - sumItemGlosas) < 0.01 || remaining < 0.01;
  }, [group, receivedNum, needsGlosas, diff, sumItemGlosas, remaining]);

  const handleConfirm = async () => {
    if (!group) return;
    const itemGlosas: GlosaInput[] = items
      .filter((i) => Number(i.glosa_amount) > 0)
      .map((i) => ({
        transaction_id: i.tx_id,
        appointment_id: i.appointment_id,
        glosa_amount: Number(i.glosa_amount),
        reason: i.reason || null,
        status: i.status,
      }));

    const allocated = itemGlosas.reduce((s, g) => s + g.glosa_amount, 0);
    const leftover = Math.max(0, diff - allocated);
    const glosas = [...itemGlosas];
    if (leftover > 0.005) {
      glosas.push({
        transaction_id: null,
        appointment_id: null,
        glosa_amount: Number(leftover.toFixed(2)),
        reason: generalReason || 'Diferença geral do lote',
        status: 'accepted',
      });
    }

    try {
      await reconcile.mutateAsync({
        clinic_id: clinicId,
        operator_id: group.operator_id,
        period: group.period,
        received_amount: Number(receivedNum.toFixed(2)),
        payment_method: paymentMethod,
        notes: notes || null,
        glosas,
        create_loss_transaction: createLoss,
      });
      toast.success('Lote conciliado com sucesso');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao conciliar');
    }
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conciliar lote · {group.operator_name}</DialogTitle>
          <p className="text-sm text-muted-foreground capitalize">{fmtPeriod(group.period)} · {group.count} consulta(s)</p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Valor esperado</p>
            <p className="font-mono font-semibold">{brl(expected)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <Label className="text-xs">Valor depositado</Label>
            <Input
              type="number" step="0.01" min="0"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Diferença (glosa)</p>
            <p className={`font-mono font-semibold ${needsGlosas ? 'text-amber-600' : 'text-emerald-600'}`}>{brl(diff)}</p>
          </div>
        </div>

        {needsGlosas && (
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-medium">Lançamento de glosas</h4>
              <Badge variant={remaining < 0.01 ? 'default' : 'outline'}>
                {remaining < 0.01 ? 'Diferença alocada' : `Faltam ${brl(remaining)}`}
              </Badge>
            </div>

            <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
              {items.map((i, idx) => (
                <div key={i.tx_id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{i.patient}</p>
                      <p className="text-xs text-muted-foreground">Esperado: {brl(i.amount)}</p>
                    </div>
                    <Input
                      type="number" step="0.01" min="0" max={i.amount}
                      placeholder="Glosa R$"
                      className="w-28 h-8"
                      value={i.glosa_amount}
                      onChange={(e) => setItems((prev) => prev.map((p, j) => j === idx ? { ...p, glosa_amount: e.target.value } : p))}
                    />
                    <Select
                      value={i.status}
                      onValueChange={(v) => setItems((prev) => prev.map((p, j) => j === idx ? { ...p, status: v as any } : p))}
                    >
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accepted">Aceitar</SelectItem>
                        <SelectItem value="contested">Contestar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {Number(i.glosa_amount) > 0 && (
                    <Input
                      placeholder="Motivo da glosa (ex: elegibilidade)"
                      value={i.reason}
                      onChange={(e) => setItems((prev) => prev.map((p, j) => j === idx ? { ...p, reason: e.target.value } : p))}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>

            {remaining > 0.005 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                  <span>O restante de <strong>{brl(remaining)}</strong> será lançado como glosa geral do lote (aceita).</span>
                </div>
                <Input
                  placeholder="Motivo da glosa geral"
                  value={generalReason}
                  onChange={(e) => setGeneralReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={createLoss} onChange={(e) => setCreateLoss(e.target.checked)} />
              Lançar glosas aceitas como despesa (categoria <code>loss_glosa</code>)
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-xs">Método de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || reconcile.isPending}>
            {reconcile.isPending ? 'Conciliando...' : 'Confirmar conciliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
