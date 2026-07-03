import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, Trash2, HelpCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generateCommissionsForTransaction } from '@/lib/commissions';

interface CommissionRule {
  id: string;
  trigger: string;
  type: string;
  value: number;
  insurance_provider?: string | null;
  specialty?: string | null;
  dentist_id?: string;
}

const TRIGGERS = [
  { value: 'after_procedure', label: 'Após finalizar o procedimento' },
  { value: 'after_payment', label: 'Após receber o pagamento' },
];

const COMMISSION_TYPES = [
  { value: 'percentage', label: 'Porcentagem (%)' },
  { value: 'fixed', label: 'Valor fixo (R$)' },
];

interface Props {
  clinicId: string;
  transactions: any[];
}

export function CommissionsPanel({ clinicId, transactions }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [editingPro, setEditingPro] = useState<{ id: string; name: string; isDefault?: boolean } | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcPro, setRecalcPro] = useState<string | null>(null);

  const [draftTrigger, setDraftTrigger] = useState('after_procedure');
  const [draftType, setDraftType] = useState('percentage');
  const [draftValue, setDraftValue] = useState('');
  const [draftInsurance, setDraftInsurance] = useState('');
  const [draftSpecialty, setDraftSpecialty] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const { data: rulesData = [] } = useQuery({
    queryKey: ['commission-rules', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('clinic_id', clinicId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const rulesByDentist = useMemo(() => {
    const map: Record<string, CommissionRule[]> = {};
    (rulesData as any[]).forEach((r) => {
      const key = r.is_clinic_default ? '__default__' : r.dentist_id;
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(r as CommissionRule);
    });
    return map;
  }, [rulesData]);

  const defaultRules = rulesByDentist['__default__'] ?? [];

  const { data: members = [] } = useQuery({
    queryKey: ['clinic-members-commissions', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_members')
        .select('user_id, role, specialty')
        .eq('clinic_id', clinicId);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const memberIds = members.map((m) => m.user_id);

  const { data: profilesData = [] } = useQuery({
    queryKey: ['profiles-commissions', ...memberIds],
    queryFn: async () => {
      if (!memberIds.length) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds);
      return data ?? [];
    },
    enabled: memberIds.length > 0,
  });

  const { data: insurances = [] } = useQuery({
    queryKey: ['clinic-insurances-commissions', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('patients')
        .select('insurance_provider')
        .eq('clinic_id', clinicId)
        .not('insurance_provider', 'is', null);
      return [
        ...new Set(
          (data ?? []).map((p) => p.insurance_provider).filter(Boolean)
        ),
      ] as string[];
    },
    enabled: !!clinicId,
  });

  const specialties = useMemo(
    () => [...new Set(members.map((m) => m.specialty).filter(Boolean))] as string[],
    [members]
  );

  const professionals = useMemo(() => {
    return members.map((m) => {
      const profile = (profilesData as any[]).find((p) => p.id === m.user_id);
      const incomeByPro = transactions.filter(
        (t) =>
          t.dentist_id === m.user_id &&
          t.type === 'income' &&
          (!t.approval_status || t.approval_status === 'approved')
      );
      const earned = incomeByPro.reduce((s, t) => s + Number(t.amount), 0);
      const paidByPro = incomeByPro.filter((t) => t.status === 'paid');

      const proRules = rulesByDentist[m.user_id] ?? [];
      let commission = 0;
      proRules.forEach((rule) => {
        if (rule.specialty && m.specialty !== rule.specialty) return;
        const base = rule.trigger === 'after_payment' ? paidByPro : incomeByPro;
        const applicableTx = rule.insurance_provider
          ? base.filter(
              (t) => (t.patients as any)?.insurance_provider === rule.insurance_provider
            )
          : base;
        const applicableEarned = applicableTx.reduce(
          (s, t) => s + Number(t.amount),
          0
        );
        if (rule.type === 'percentage')
          commission += applicableEarned * (rule.value / 100);
        else commission += rule.value * applicableTx.length;
      });

      // Commissions actually posted as expenses (category=commission)
      const posted = transactions
        .filter(
          (t) =>
            t.dentist_id === m.user_id &&
            t.type === 'expense' &&
            t.category === 'commission'
        )
        .reduce((s, t) => s + Number(t.amount), 0);

      return {
        id: m.user_id,
        name: profile?.full_name ?? 'Profissional',
        specialty: m.specialty as string | null,
        earned,
        commission,
        posted,
        rulesCount: proRules.length,
      };
    });
  }, [members, profilesData, transactions, rulesByDentist]);

  // Professionals who have income transactions but no commission posted and no rules
  const professionalsWithoutCommission = useMemo(() =>
    professionals.filter((p) => p.earned > 0 && p.rulesCount === 0 && p.posted === 0 && defaultRules.length === 0),
    [professionals, defaultRules]
  );

  const handleRetroactiveRecalculate = async () => {
    setRecalculating(true);
    try {
      const { data: incomeTxs } = await supabase
        .from('financial_transactions')
        .select('id, dentist_id, appointment_id')
        .eq('clinic_id', clinicId)
        .eq('type', 'income')
        .or('approval_status.is.null,approval_status.eq.approved');
      if (!incomeTxs?.length) {
        toast.info('Nenhuma transação de receita encontrada.');
        return;
      }

      // Corrige dentist_id divergente: usa o dentist_id real da consulta quando difere
      let fixed = 0;
      for (const tx of incomeTxs as any[]) {
        if (!tx.appointment_id) continue;
        const { data: apt } = await supabase
          .from('appointments')
          .select('dentist_id')
          .eq('id', tx.appointment_id)
          .maybeSingle();
        if (apt?.dentist_id && apt.dentist_id !== tx.dentist_id) {
          await supabase
            .from('financial_transactions')
            .update({ dentist_id: apt.dentist_id })
            .eq('id', tx.id);
          fixed++;
        }
      }

      let created = 0;
      for (const tx of incomeTxs as any[]) {
        created += await generateCommissionsForTransaction(tx.id, 'after_procedure');
      }

      const parts = [];
      if (created > 0) parts.push(`${created} comissão(ões) gerada(s)`);
      if (fixed > 0) parts.push(`${fixed} profissional(is) corrigido(s)`);
      const msg = parts.length > 0
        ? `Recálculo concluído: ${parts.join(', ')}.`
        : 'Recálculo concluído: nenhuma comissão nova gerada (regras ou valores podem estar zerados).';
      if (created > 0) toast.success(msg); else toast.info(msg);
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payouts-pending-by-dentist', clinicId] });
      queryClient.invalidateQueries({ queryKey: ['payouts-open', clinicId] });
      queryClient.invalidateQueries({ queryKey: ['commission-rules', clinicId] });
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao recalcular comissões');
    } finally {
      setRecalculating(false);
    }
  };

  const handleRecalcPro = async (dentistId: string, dentistName: string) => {
    setRecalcPro(dentistId);
    try {
      const { data: incomeTxs } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('dentist_id', dentistId)
        .eq('type', 'income')
        .or('approval_status.is.null,approval_status.eq.approved');
      if (!incomeTxs?.length) {
        toast.info('Nenhuma transação encontrada para este profissional.');
        return;
      }
      let created = 0;
      for (const tx of incomeTxs) {
        created += await generateCommissionsForTransaction(tx.id, 'after_procedure');
        created += await generateCommissionsForTransaction(tx.id, 'after_payment');
      }
      if (created > 0) {
        toast.success(`${created} comissão(ões) gerada(s) para ${dentistName}.`);
      } else {
        toast.info('Comissões já estão em dia ou nenhuma regra aplicável encontrada.');
      }
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao recalcular comissões');
    } finally {
      setRecalcPro(null);
    }
  };

  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const openConfig = (pro: { id: string; name: string; isDefault?: boolean }) => {
    setEditingPro(pro);
    setDraftTrigger('after_procedure');
    setDraftType('percentage');
    setDraftValue('');
    setDraftInsurance('');
    setDraftSpecialty('');
    setConfigOpen(true);
  };

  const proRulesEditing = editingPro
    ? (editingPro.isDefault ? defaultRules : (rulesByDentist[editingPro.id] ?? []))
    : [];

  const editingProData = editingPro && !editingPro.isDefault
    ? professionals.find((p) => p.id === editingPro.id) ?? null
    : null;

  const hasDuplicateTrigger = proRulesEditing.some((r) => r.trigger === draftTrigger);

  const previewCommission = useMemo(() => {
    if (!draftValue || parseFloat(draftValue) <= 0 || !editingPro || editingPro.isDefault) return null;
    const v = parseFloat(draftValue);
    const memberSpecialty = members.find((m) => m.user_id === editingPro.id)?.specialty ?? null;
    let base = transactions.filter(
      (t: any) =>
        t.dentist_id === editingPro.id &&
        t.type === 'income' &&
        (!t.approval_status || t.approval_status === 'approved')
    );
    if (draftTrigger === 'after_payment') base = base.filter((t: any) => t.status === 'paid');
    if (draftInsurance) base = base.filter((t: any) => (t.patients as any)?.insurance_provider === draftInsurance);
    if (draftSpecialty && memberSpecialty !== draftSpecialty) base = [];
    const totalBase = base.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const amount = draftType === 'percentage' ? totalBase * (v / 100) : v * base.length;
    return { amount, base: totalBase, count: base.length };
  }, [draftValue, draftType, draftTrigger, draftInsurance, draftSpecialty, editingPro, members, transactions]);

  const addRule = async () => {
    if (!editingPro) return;
    const v = parseFloat(draftValue);
    if (!v || v <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    setSavingRule(true);
    const { error } = await supabase.from('commission_rules').insert({
      clinic_id: clinicId,
      dentist_id: editingPro.isDefault ? null : editingPro.id,
      is_clinic_default: !!editingPro.isDefault,
      trigger: draftTrigger,
      type: draftType,
      value: v,
      insurance_provider: draftInsurance || null,
      specialty: draftSpecialty || null,
      created_by: user?.id ?? null,
    });
    setSavingRule(false);
    if (error) {
      toast.error('Falha ao salvar regra', { description: error.message });
      return;
    }
    toast.success('Regra salva');
    setDraftValue('');
    setDraftInsurance('');
    setDraftSpecialty('');
    queryClient.invalidateQueries({ queryKey: ['commission-rules', clinicId] });
  };

  const removeRule = async (id: string) => {
    const { error } = await supabase.from('commission_rules').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['commission-rules', clinicId] });
  };

  const triggerLabel = (t: string) =>
    TRIGGERS.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="space-y-4">
      {/* Alerta: profissionais com atendimentos mas sem comissão configurada */}
      {professionalsWithoutCommission.length > 0 && (
        <Card className="border-amber-400/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Atendimentos sem comissão configurada
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
                {professionalsWithoutCommission.map((p) => p.name).join(', ')} — possuem receitas registradas mas nenhuma regra de comissão.
                Configure uma regra abaixo e clique em "Recalcular retroativo" para gerar as comissões passadas.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 border-amber-400/60 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10 flex-shrink-0"
              onClick={handleRetroactiveRecalculate}
              disabled={recalculating}
            >
              <RefreshCw className={`h-3 w-3 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalculando...' : 'Recalcular retroativo'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Regra padrão da clínica (fallback para profissionais sem regra) */}
      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Settings className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Regra padrão da clínica</p>
            <p className="text-xs text-muted-foreground">
              Aplicada automaticamente quando um profissional não tem regra própria.
              {defaultRules.length > 0 && ` · ${defaultRules.length} regra${defaultRules.length > 1 ? 's' : ''} cadastrada${defaultRules.length > 1 ? 's' : ''}.`}
            </p>
          </div>
          {defaultRules.length > 0 && (
            <Badge variant="secondary" className="text-[10px] hidden sm:flex">
              ativa
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => openConfig({ id: '__default__', name: 'Regra padrão da clínica', isDefault: true })}
          >
            <Settings className="h-3 w-3" />
            Configurar
          </Button>
        </CardContent>
      </Card>

      {professionals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Nenhum profissional vinculado à clínica
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary header */}
          <div className="hidden sm:grid grid-cols-[1fr_140px_140px_140px_140px] gap-4 px-4 text-xs text-muted-foreground font-medium border-b border-border/40 pb-2">
            <span>Profissional</span>
            <span className="text-right">Faturado no período</span>
            <span className="text-right">Comissão calculada</span>
            <span className="text-right">Comissão lançada</span>
            <span className="text-right">Ações</span>
          </div>

          {professionals.map((pro) => (
            <Card key={pro.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {initials(pro.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pro.name}</p>
                    {pro.specialty && (
                      <p className="text-xs text-muted-foreground truncate">
                        {pro.specialty}
                      </p>
                    )}
                  </div>
                  <div className="text-right hidden sm:block min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Faturado</p>
                    <p className="text-sm font-semibold">{fmt(pro.earned)}</p>
                  </div>
                  <div className="text-right hidden sm:block min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Calculada</p>
                    <p className="text-sm font-semibold text-primary">
                      {fmt(pro.commission)}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Lançada</p>
                    <p className="text-sm font-semibold">{fmt(pro.posted)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {pro.rulesCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] hidden sm:flex">
                        {pro.rulesCount} regra{pro.rulesCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {pro.commission > pro.posted && pro.rulesCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 border-amber-400/60 text-amber-700 hover:bg-amber-500/10"
                        onClick={() => handleRecalcPro(pro.id, pro.name)}
                        disabled={recalcPro === pro.id}
                        title="Gerar comissões pendentes"
                      >
                        <RefreshCw className={`h-3 w-3 ${recalcPro === pro.id ? 'animate-spin' : ''}`} />
                        {recalcPro === pro.id ? 'Gerando...' : 'Gerar'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => openConfig({ id: pro.id, name: pro.name })}
                    >
                      <Settings className="h-3 w-3" />
                      Comissões
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Comissões de {editingPro?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumo financeiro do profissional */}
            {editingProData && (
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Faturado</p>
                  <p className="text-sm font-semibold">{fmt(editingProData.earned)}</p>
                </div>
                <div className="text-center border-x border-border/40">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Calculado</p>
                  <p className="text-sm font-semibold text-primary">{fmt(editingProData.commission)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Lançado</p>
                  <p className="text-sm font-semibold">{fmt(editingProData.posted)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">
                  Quando o profissional receberá a comissão?
                </Label>
                <Select value={draftTrigger} onValueChange={setDraftTrigger}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo de comissão</Label>
                <Select value={draftType} onValueChange={setDraftType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMISSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Valor {draftType === 'percentage' ? '(%)' : '(R$)'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 20"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  className="h-9"
                />
                {/* Preview em tempo real */}
                {previewCommission !== null && (
                  <p className="text-[11px] text-primary font-medium leading-tight mt-1">
                    {draftType === 'percentage'
                      ? `Com ${draftValue}% → ${fmt(previewCommission.amount)} (base ${fmt(previewCommission.base)})`
                      : `${fmt(parseFloat(draftValue))} × ${previewCommission.count} atend. → ${fmt(previewCommission.amount)}`}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Em qual convênio? (opcional)</Label>
                <Select
                  value={draftInsurance || '__all__'}
                  onValueChange={(v) => setDraftInsurance(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {insurances.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Em qual especialidade? (opcional)
                </Label>
                <Select
                  value={draftSpecialty || '__all__'}
                  onValueChange={(v) => setDraftSpecialty(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {specialties.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Aviso de regra duplicada */}
            {hasDuplicateTrigger && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                Já existe uma regra para "{TRIGGERS.find((t) => t.value === draftTrigger)?.label}". Adicionar outra pode gerar comissões duplicadas.
              </p>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={addRule}
              disabled={!draftValue || parseFloat(draftValue) <= 0 || savingRule}
            >
              {savingRule ? 'Salvando...' : 'Adicionar regra'}
            </Button>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm font-medium">Regras criadas</p>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {proRulesEditing.length === 0 ? (
                <div className="rounded-lg border border-border/50 p-4 text-xs text-muted-foreground text-center">
                  As regras que você criar serão exibidas aqui.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {proRulesEditing.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 text-xs"
                    >
                      <div className="flex-1 space-y-0.5">
                        <p className="font-medium">
                          {rule.type === 'percentage'
                            ? `${rule.value}%`
                            : `R$ ${rule.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            · {triggerLabel(rule.trigger)}
                          </span>
                        </p>
                        {(rule.insurance_provider || rule.specialty) && (
                          <p className="text-muted-foreground">
                            {[rule.insurance_provider, rule.specialty]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => removeRule(rule.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setConfigOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
