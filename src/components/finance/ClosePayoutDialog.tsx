import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string;
  dentistId: string;
  dentistName: string;
  defaultStart: string | null;
}

export function ClosePayoutDialog({
  open, onOpenChange, clinicId, dentistId, dentistName, defaultStart,
}: Props) {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [periodStart, setPeriodStart] = useState(defaultStart ?? today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPeriodStart(defaultStart ?? today);
      setPeriodEnd(today);
      setPaymentMethod('pix');
      setNotes('');
    }
  }, [open, defaultStart, today]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['payout-preview', clinicId, dentistId, periodStart, periodEnd],
    enabled: open && !!clinicId && !!dentistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, amount, due_date, created_at, description, patients(full_name)')
        .eq('clinic_id', clinicId)
        .eq('dentist_id', dentistId)
        .eq('type', 'expense')
        .eq('category', 'commission')
        .eq('status', 'pending')
        .is('payout_id', null)
        .gte('due_date', periodStart)
        .lte('due_date', periodEnd)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = useMemo(
    () => (items as any[]).reduce((s, r) => s + Number(r.amount), 0),
    [items]
  );

  const handleConfirm = async () => {
    if ((items as any[]).length === 0) {
      toast.error('Nenhuma comissão pendente neste período');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc('close_commission_period', {
        _clinic_id: clinicId,
        _dentist_id: dentistId,
        _period_start: periodStart,
        _period_end: periodEnd,
        _payment_method: paymentMethod,
        _notes: notes || null,
      });
      if (error) throw error;
      toast.success('Repasse registrado com sucesso');
      qc.invalidateQueries({ queryKey: ['payouts-open', clinicId] });
      qc.invalidateQueries({ queryKey: ['payout-history', clinicId] });
      qc.invalidateQueries({ queryKey: ['my-commissions'] });
      qc.invalidateQueries({ queryKey: ['my-payouts'] });
      qc.invalidateQueries({ queryKey: ['financial-transactions'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao registrar repasse');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Fechar período · {dentistName}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 items-start">
          {/* Left: form controls */}
          <div className="flex flex-col gap-3 w-72 shrink-0">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs leading-relaxed">
                Confirme o período e o método usado para pagar o profissional.
                <strong> A plataforma não envia o dinheiro</strong> — você paga por fora
                (Pix, transferência, dinheiro) e aqui apenas registra que o repasse
                foi feito. O profissional verá esse lançamento em <em>Meu Financeiro</em>.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label>Início do período</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim do período</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Método de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Ex.: PIX Banco Itaú, comprovante #1234"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Right: commission list */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="rounded-lg border border-border/60 max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Data</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
                  ) : (items as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma comissão pendente neste período.</TableCell></TableRow>
                  ) : (
                    (items as any[]).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {r.due_date
                            ? format(parseISO(r.due_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell className="font-medium">{r.patients?.full_name ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{r.description ?? 'Comissão sobre atendimento'}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(Number(r.amount))}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {(items as any[]).length} comissão(ões) no período
              </span>
              <span className="text-lg font-semibold tabular-nums">{fmt(total)}</span>
            </div>

            {!isLoading && (items as any[]).length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Nenhuma comissão neste intervalo. Tente ampliar o período acima.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting || total <= 0}>
            {submitting ? 'Registrando…' : 'Registrar pagamento já realizado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}