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
  /** Convênio registrado na ficha do paciente (texto livre). */
  patientInsuranceProvider?: string | null;
}

type Mode = '' | 'insurance' | 'stripe' | 'later';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface OperatorOption {
  id: string;          // insurance_operators.id for personal; insurance_plans.id for clinic
  name: string;
  source: 'patient' | 'personal' | 'clinic';
  operatorId?: string; // insurance_operators.id usado para busca de tabela TUSS
}

export function FinishPaymentDialog({
  open, onOpenChange, appointmentId, patientId, patientName, clinicId, procedures, onCompleted,
  patientInsuranceProvider,
}: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('');
  const [operatorId, setOperatorId] = useState<string>('');
  const [operators, setOperators] = useState<OperatorOption[]>([]);
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

  // Carregar operadoras: credenciamentos pessoais + convênios da clínica
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      // 1. Credenciamentos pessoais aprovados
      const { data: creds } = await supabase
        .from('operator_credentialings')
        .select('operator_id, insurance_operators(id, name)')
        .eq('professional_user_id', user.id)
        .eq('status', 'approved');
      const personal: OperatorOption[] = ((creds ?? []) as any[])
        .filter((r) => r.insurance_operators)
        .map((r) => ({
          id: r.insurance_operators.id,
          name: r.insurance_operators.name,
          source: 'personal' as const,
          operatorId: r.insurance_operators.id,
        }));

      // 2. Convênios ativos da clínica
      const clinic: OperatorOption[] = [];
      if (clinicId) {
        const { data: plans } = await supabase
          .from('insurance_plans')
          .select('id, name, operator_id')
          .eq('clinic_id', clinicId)
          .eq('is_active', true);
        for (const p of ((plans ?? []) as any[])) {
          // Evita duplicata se já coberto por credenciamento pessoal no mesmo operador
          const alreadyCovered = p.operator_id && personal.some((po) => po.operatorId === p.operator_id);
          if (!alreadyCovered) {
            clinic.push({
              id: p.id,
              name: p.name,
              source: 'clinic' as const,
              operatorId: p.operator_id ?? undefined,
            });
          }
        }
      }

      // 3. Convênio do paciente (ficha)
      const patientOpt: OperatorOption[] = [];
      const provider = (patientInsuranceProvider ?? '').trim();
      if (provider) {
        // tenta casar com uma operadora cadastrada para obter operatorId (tabela TUSS)
        const { data: ops } = await supabase
          .from('insurance_operators')
          .select('id, name')
          .eq('is_active', true);
        const match = (ops ?? []).find((o: any) => normalize(o.name) === normalize(provider));
        // evita duplicar com credenciamento pessoal ou convênio da clínica
        const dup =
          (match && personal.some((p) => p.operatorId === match.id)) ||
          (match && clinic.some((c) => c.operatorId === match.id)) ||
          personal.some((p) => normalize(p.name) === normalize(provider)) ||
          clinic.some((c) => normalize(c.name) === normalize(provider));
        if (!dup) {
          patientOpt.push({
            id: match?.id ?? `patient:${provider}`,
            name: match?.name ?? provider,
            source: 'patient',
            operatorId: match?.id ?? undefined,
          });
        }
      }

      const seen = new Set<string>();
      const merged = [...patientOpt, ...personal, ...clinic].filter((o) =>
        seen.has(o.id) ? false : (seen.add(o.id), true),
      );
      setOperators(merged);
      // pré-seleciona o convênio do paciente quando disponível
      if (patientOpt[0]) {
        setOperatorId((prev) => prev || patientOpt[0].id);
      }
    })();
  }, [open, user, clinicId, patientInsuranceProvider]);

  // operatorId da opção selecionada (pode diferir do id da opção quando é convênio de clínica)
  const selectedOption = operators.find((o) => o.id === operatorId);
  const tussOperatorId = selectedOption?.operatorId;

  // Carregar tabela de preços vigente da operadora (apenas quando há operatorId TUSS)
  useEffect(() => {
    if (!tussOperatorId) { setPriceItems({}); return; }
    setLoadingPrices(true);
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: tables } = await supabase
        .from('operator_price_tables')
        .select('id, valid_from, valid_until')
        .eq('operator_id', tussOperatorId)
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
  }, [tussOperatorId]);

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
    if (!operatorId) { toast.error('Selecione o convênio'); return; }
    if (tussOperatorId && insuranceHasMissing) {
      toast.error('Há procedimentos sem valor na tabela da operadora');
      return;
    }
    const op = selectedOption;
    const amount = tussOperatorId ? insuranceTotal : totalParticular;
    setSaving(true);
    try {
      const today = new Date();
      const period = format(today, 'yyyy-MM');
      const dueDate = format(addMonths(new Date(today.getFullYear(), today.getMonth(), 20), 1), 'yyyy-MM-dd');
      const notes = `Convênio: ${op?.name} • Procedimentos: ` +
        insuranceLines.map((l) => `${l.name}${l.code ? ` (${l.code})` : ''} - ${brl(l.insuranceValue ?? l.price ?? 0)}`).join('; ');
      await createBaseTx({
        category: 'insurance',
        amount,
        payment_method: `insurance:${op?.name ?? ''}`,
        status: 'pending',
        due_date: dueDate,
        operator_id: tussOperatorId ?? null,
        insurance_invoice_period: period,
        insurance_invoice_status: 'open',
        notes,
      });
      toast.success(`Registrado no convênio ${op?.name} – ${period}.`);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Label>Convênio / Operadora</Label>
              {operators.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum convênio disponível. Cadastre convênios nas Configurações da clínica ou solicite credenciamento pessoal.
                </p>
              ) : (
                <Select value={operatorId} onValueChange={setOperatorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o convênio..." /></SelectTrigger>
                  <SelectContent>
                    {operators.filter((o) => o.source === 'patient').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Convênio do paciente</div>
                        {operators.filter((o) => o.source === 'patient').map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {operators.filter((o) => o.source === 'personal').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Credenciamento pessoal</div>
                        {operators.filter((o) => o.source === 'personal').map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {operators.filter((o) => o.source === 'clinic').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Convênios da clínica</div>
                        {operators.filter((o) => o.source === 'clinic').map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {operatorId && tussOperatorId && (
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

            {operatorId && !tussOperatorId && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Convênio da clínica sem tabela TUSS vinculada. O atendimento será registrado como convênio sem valor automático.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                disabled={!operatorId || (!!tussOperatorId && insuranceHasMissing) || saving}
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