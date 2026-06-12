import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, CreditCard, Clock, AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';

export interface FinishProcedure {
  procedure_id: string;
  name: string;
  code: string | null;
  price: number; // valor particular (catálogo da clínica)
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointmentId: string;
  patientId: string;
  patientName: string;
  clinicId: string | null;
  procedures: FinishProcedure[];
  onCompleted: () => void;
}

type Mode = '' | 'insurance' | 'stripe' | 'later';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function FinishPaymentDialog({
  open, onOpenChange, appointmentId, patientId, patientName, clinicId, procedures, onCompleted,
}: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('');
  const [operatorId, setOperatorId] = useState<string>('');
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [priceItems, setPriceItems] = useState<Record<string, number>>({}); // tuss_code -> value_brl
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);

  const totalParticular = useMemo(
    () => procedures.reduce((s, p) => s + (p.price || 0), 0),
    [procedures],
  );

  const insuranceLines = useMemo(() => {
    return procedures.map((p) => {
      const v = p.code ? priceItems[p.code.toUpperCase()] : undefined;
      return { ...p, insuranceValue: v ?? null };
    });
  }, [procedures, priceItems]);

  const insuranceTotal = insuranceLines.reduce((s, l) => s + (l.insuranceValue ?? 0), 0);
  const insuranceHasMissing = insuranceLines.some((l) => l.insuranceValue == null);

  // Carregar operadoras em que o profissional está credenciado (aprovadas)
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from('operator_credentialings')
        .select('operator_id, insurance_operators(id, name)')
        .eq('professional_user_id', user.id)
        .eq('status', 'approved');
      const list = (data ?? [])
        .map((row: any) => row.insurance_operators)
        .filter(Boolean)
        .map((o: any) => ({ id: o.id, name: o.name }));
      // dedup
      const seen = new Set<string>();
      const unique = list.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
      setOperators(unique);
    })();
  }, [open, user]);

  // Carregar tabela de preços vigente da operadora
  useEffect(() => {
    if (!operatorId) { setPriceItems({}); return; }
    setLoadingPrices(true);
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: tables } = await supabase
        .from('operator_price_tables')
        .select('id, valid_from, valid_until')
        .eq('operator_id', operatorId)
        .order('valid_from', { ascending: false });
      const currentTable = (tables ?? []).find((t: any) =>
        (!t.valid_from || t.valid_from <= today) && (!t.valid_until || t.valid_until >= today)
      ) ?? tables?.[0];
      if (!currentTable) {
        setPriceItems({});
        setLoadingPrices(false);
        return;
      }
      const { data: items } = await supabase
        .from('operator_price_items')
        .select('tuss_code, value_brl')
        .eq('table_id', currentTable.id);
      const map: Record<string, number> = {};
      (items ?? []).forEach((it: any) => {
        if (it.tuss_code) map[String(it.tuss_code).toUpperCase()] = Number(it.value_brl ?? 0);
      });
      setPriceItems(map);
      setLoadingPrices(false);
    })();
  }, [operatorId]);

  const createBaseTx = async (overrides: Record<string, any>) => {
    const desc = `Atendimento - ${patientName}`;
    const payload: any = {
      patient_id: patientId,
      appointment_id: appointmentId,
      dentist_id: user!.id,
      clinic_id: clinicId ?? null,
      type: 'income',
      description: desc,
      ...overrides,
    };
    const { data, error } = await supabase
      .from('financial_transactions')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data!.id as string;
  };

  const handleConfirmInsurance = async () => {
    if (!operatorId) { toast.error('Selecione a operadora'); return; }
    if (insuranceHasMissing) {
      toast.error('Há procedimentos sem valor na tabela da operadora');
      return;
    }
    const op = operators.find((o) => o.id === operatorId);
    setSaving(true);
    try {
      const today = new Date();
      // Fatura: período = mês corrente; due_date = dia 20 do mês seguinte
      const period = format(today, 'yyyy-MM');
      const dueDate = format(addMonths(new Date(today.getFullYear(), today.getMonth(), 20), 1), 'yyyy-MM-dd');
      const notes = `Convênio: ${op?.name} • Procedimentos: ` +
        insuranceLines.map((l) => `${l.name}${l.code ? ` (${l.code})` : ''} - ${brl(l.insuranceValue ?? 0)}`).join('; ');
      await createBaseTx({
        category: 'insurance',
        amount: insuranceTotal,
        payment_method: `insurance:${op?.name ?? ''}`,
        status: 'pending',
        due_date: dueDate,
        operator_id: operatorId,
        insurance_invoice_period: period,
        insurance_invoice_status: 'open',
        notes,
      });
      toast.success(`Registrado na fatura ${op?.name} de ${period}.`);
      onCompleted();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao registrar');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStripe = async () => {
    if (totalParticular <= 0) { toast.error('Valor inválido'); return; }
    setSaving(true);
    try {
      const txId = await createBaseTx({
        category: 'consultation',
        amount: totalParticular,
        payment_method: 'stripe',
        status: 'pending',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        notes: 'Pagamento via Stripe Checkout',
      });
      const { data, error } = await supabase.functions.invoke('create-consultation-checkout', {
        body: {
          transaction_id: txId,
          patient_name: patientName,
          line_items: procedures.map((p) => ({ name: p.name, amount: p.price })),
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Link de pagamento não gerado');
      setStripeUrl(data.url as string);
      toast.success('Link de pagamento gerado!');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha no Stripe');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLater = async () => {
    setSaving(true);
    try {
      await createBaseTx({
        category: 'consultation',
        amount: totalParticular,
        payment_method: 'particular_pending',
        status: 'pending',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        notes: 'A combinar com paciente',
      });
      toast.success('Registrado como "A combinar". Cobrança ficará pendente.');
      onCompleted();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const onInteractOutside = (e: Event) => e.preventDefault();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) return; onOpenChange(v); }}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={onInteractOutside}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Forma de pagamento</DialogTitle>
          <DialogDescription>
            Selecione como esta consulta de <b>{patientName}</b> será paga.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Procedimentos</span>
            <span>{procedures.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total particular</span>
            <Badge variant="secondary">{brl(totalParticular)}</Badge>
          </div>
        </div>

        {/* Seleção de modo */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => { setMode('insurance'); setStripeUrl(null); }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
              mode === 'insurance' ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50'
            }`}
          >
            <Shield className="h-5 w-5" />
            Convênio
          </button>
          <button
            type="button"
            onClick={() => { setMode('stripe'); setStripeUrl(null); }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
              mode === 'stripe' ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            Particular agora
          </button>
          <button
            type="button"
            onClick={() => { setMode('later'); setStripeUrl(null); }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
              mode === 'later' ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50'
            }`}
          >
            <Clock className="h-5 w-5" />
            A combinar
          </button>
        </div>

        {/* Convênio */}
        {mode === 'insurance' && (
          <div className="space-y-3">
            <div>
              <Label>Operadora credenciada</Label>
              {operators.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Você ainda não tem credenciamento aprovado em nenhuma operadora.
                </p>
              ) : (
                <Select value={operatorId} onValueChange={setOperatorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a operadora..." /></SelectTrigger>
                  <SelectContent>
                    {operators.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {operatorId && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Valores conforme tabela vigente da operadora
                  {loadingPrices && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
                </div>
                {insuranceLines.map((l) => (
                  <div key={l.procedure_id} className="flex items-center justify-between text-sm">
                    <span>
                      {l.name}{' '}
                      {l.code && <span className="text-xs text-muted-foreground">({l.code})</span>}
                    </span>
                    {l.insuranceValue != null ? (
                      <span className="font-mono">{brl(l.insuranceValue)}</span>
                    ) : (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> sem valor
                      </span>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-semibold">
                  <span>Total convênio</span>
                  <span>{brl(insuranceTotal)}</span>
                </div>
                {insuranceHasMissing && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-2 text-xs text-amber-700 dark:text-amber-400">
                    Procedimentos sem valor na tabela. Cadastre o código TUSS na tabela da operadora ou ajuste o código do procedimento.
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  Esta consulta será incluída na fatura do mês corrente, com vencimento dia 20 do mês seguinte.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                disabled={!operatorId || insuranceHasMissing || saving}
                onClick={handleConfirmInsurance}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar convênio
              </Button>
            </div>
          </div>
        )}

        {/* Stripe */}
        {mode === 'stripe' && (
          <div className="space-y-3">
            {!stripeUrl ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Vamos gerar um link de pagamento Stripe ({brl(totalParticular)}). Compartilhe com o paciente — ele paga pelo celular.
                </p>
                <div className="flex justify-end">
                  <Button onClick={handleConfirmStripe} disabled={saving || totalParticular <= 0} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Gerar link de pagamento
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/30 p-3 text-sm">
                  Link gerado! Compartilhe com o paciente:
                </div>
                <a
                  href={stripeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-sm hover:bg-muted/50"
                >
                  <span className="truncate text-primary">{stripeUrl}</span>
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                </a>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(stripeUrl);
                    toast.success('Link copiado');
                  }}
                  className="w-full"
                >
                  Copiar link
                </Button>
                <div className="flex justify-end">
                  <Button onClick={onCompleted}>Concluir</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* A combinar */}
        {mode === 'later' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O pagamento será resolvido diretamente entre médico e paciente. A consulta ficará como
              <Badge variant="outline" className="mx-1">Pendente</Badge>
              em Contas a Receber.
            </p>
            <div className="flex justify-end">
              <Button onClick={handleConfirmLater} disabled={saving} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Registrar como pendente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}