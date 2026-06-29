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
import { Settings, Trash2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
    ? (rulesByDentist[editingPro.id] ?? [])
    : [];

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
