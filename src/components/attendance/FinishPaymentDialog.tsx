import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, endOfMonth } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Shield, CreditCard, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSoloMode } from '@/hooks/useSoloMode';
import { canManageClinicFinance } from '@/lib/financePermissions';
import { generateCommissionsForTransaction } from '@/lib/commissions';

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

type Mode = '' | 'insurance' | 'paid' | 'later';

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
  const { effectiveRole } = useRoleAccess();
  const { isSolo } = useSoloMode();
  const canManage = canManageClinicFinance({
    isSolo,
    role: effectiveRole as any,
    hasClinic: !!clinicId,
  });
  const needsApproval = !!clinicId && !canManage;
  const [mode, setMode] = useState<Mode>('');
  const [operatorId, setOperatorId] = useState<string>('');
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [priceItems, setPriceItems] = useState<Record<string, number>>({}); // tuss_code -> value_brl
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cardFee, setCardFee] = useState<string>('');

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

  // Fallback: quando a tabela TUSS não tem valor, usa o valor particular do catálogo.
  const insuranceTotal = insuranceLines.reduce(
    (s, l) => s + (l.insuranceValue ?? l.price ?? 0),
    0,
  );
  const insuranceHasFallback = insuranceLines.some((l) => l.insuranceValue == null);

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
      approval_status: needsApproval ? 'awaiting_approval' : 'approved',
      approval_requested_by: needsApproval ? user!.id : null,
      approval_decided_by: needsApproval ? null : user!.id,
      approval_decided_at: needsApproval ? null : new Date().toISOString(),
      ...overrides,
    };
    if (needsApproval) {
      // Force status pending while awaiting approval
      payload.status = 'pending';
    }
    const { data, error } = await supabase
      .from('financial_transactions')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    const newId = data!.id as string;
    // If the row was inserted as approved, fire commission generation (after_procedure).
    if (!needsApproval) {
      try {
        await generateCommissionsForTransaction(newId, 'after_procedure');
      } catch (_) {
        // do not block flow
      }
    }
    return newId;
  };

  const handleConfirmInsurance = async () => {
    if (!operatorId) { toast.error('Selecione o convênio'); return; }
    const op = selectedOption;
    const amount = tussOperatorId ? insuranceTotal : totalParticular;
    setSaving(true);
    try {
      const today = new Date();
      const period = format(today, 'yyyy-MM');
      // due_date = último dia do mês de competência (mesmo período da fatura).
      // O vencimento real da fatura junto à operadora é definido por ela.
      const dueDate = format(endOfMonth(today), 'yyyy-MM-dd');
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
      toast.success(
        needsApproval
          ? `Consulta finalizada. Cobrança do convênio ${op?.name} enviada para aprovação.`
          : `Registrado no convênio ${op?.name} – ${period}.`
      );
      onCompleted();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao registrar');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPaid = async () => {
    if (totalParticular <= 0) { toast.error('Valor inválido'); return; }
    const fee = Math.max(0, parseFloat((cardFee || '0').replace(',', '.')) || 0);
    if (fee > totalParticular) {
      toast.error('A taxa não pode ser maior que o valor recebido');
      return;
    }
    setSaving(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await createBaseTx({
        category: 'consultation',
        amount: totalParticular,
        payment_method: 'card',
        status: 'paid',
        due_date: today,
        paid_date: today,
        card_fee_amount: fee,
        notes: 'Pago pelo paciente (registrado pela clínica)',
      });
      toast.success(
        needsApproval
          ? 'Consulta finalizada. Pagamento enviado para aprovação.'
          : 'Pagamento registrado.'
      );
      onCompleted();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao registrar pagamento');
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
      toast.success(
        needsApproval
          ? 'Consulta finalizada. Cobrança "A combinar" enviada para aprovação.'
          : 'Registrado como "A combinar". Cobrança ficará pendente.'
      );
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
            onClick={() => setMode('insurance')}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
              mode === 'insurance' ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50'
            }`}
          >
            <Shield className="h-5 w-5" />
            Convênio
          </button>
          <button
            type="button"
            onClick={() => setMode('paid')}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
              mode === 'paid' ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            Cartão / Pago
          </button>
          <button
            type="button"
            onClick={() => setMode('later')}
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
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground mt-1 space-y-1">
                  <p>Nenhum convênio disponível para este atendimento.</p>
                  <p>Você pode:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Cadastrar o convênio na ficha do paciente, ou</li>
                    <li>Cadastrar convênios em Configurações → Convênios da clínica, ou</li>
                    <li>Finalizar como <b>Particular agora</b> ou <b>A combinar</b>.</li>
                  </ul>
                </div>
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
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">valor particular</span>
                        <span className="font-mono">{brl(l.price ?? 0)}</span>
                      </span>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-semibold">
                  <span>Total convênio</span>
                  <span>{brl(insuranceTotal)}</span>
                </div>
                {insuranceHasFallback && (
                  <div className="rounded-lg bg-muted/50 border border-border p-2 text-xs text-muted-foreground">
                    Procedimentos sem valor na tabela da operadora foram somados pelo valor particular do catálogo da clínica.
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  Esta consulta entra na fatura do mês corrente. O vencimento junto à operadora é definido por ela.
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
                disabled={!operatorId || saving}
                onClick={handleConfirmInsurance}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar convênio
              </Button>
            </div>
          </div>
        )}

        {/* Cartão / Pago */}
        {mode === 'paid' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O paciente já efetuou o pagamento ({brl(totalParticular)}) diretamente com a clínica (cartão, dinheiro, PIX, etc.).
              O atendimento será registrado como <Badge variant="secondary" className="mx-1">Pago</Badge> em Contas a Receber.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Taxa da maquininha (R$) — opcional</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cardFee}
                onChange={(e) => setCardFee(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              <p className="text-[11px] text-muted-foreground">
                Use apenas em cartão crédito/débito. O valor é deduzido do lucro líquido no DRE.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleConfirmPaid} disabled={saving || totalParticular <= 0} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar pagamento
              </Button>
            </div>
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