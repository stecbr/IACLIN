import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Settings, Trash2, HelpCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CommissionRule {
  id: string;
  trigger: string;
  type: string;
  value: number;
  insurance?: string;
  specialty?: string;
}

type CommissionConfig = Record<string, CommissionRule[]>;

const TRIGGERS = [
  { value: 'after_procedure', label: 'Após finalizar o procedimento' },
  { value: 'after_payment', label: 'Após receber o pagamento' },
];

const COMMISSION_TYPES = [
  { value: 'percentage', label: 'Porcentagem (%)' },
  { value: 'fixed', label: 'Valor fixo (R$)' },
];

function loadRules(clinicId: string): CommissionConfig {
  try {
    return JSON.parse(
      localStorage.getItem(`commission_rules_${clinicId}`) ?? '{}'
    );
  } catch {
    return {};
  }
}

function saveRules(clinicId: string, rules: CommissionConfig) {
  localStorage.setItem(`commission_rules_${clinicId}`, JSON.stringify(rules));
}

interface Props {
  clinicId: string;
  transactions: any[];
}

export function CommissionsPanel({ clinicId, transactions }: Props) {
  const [configOpen, setConfigOpen] = useState(false);
  const [editingPro, setEditingPro] = useState<{ id: string; name: string } | null>(null);
  const [rules, setRules] = useState<CommissionConfig>(() => loadRules(clinicId));

  const [draftTrigger, setDraftTrigger] = useState('after_procedure');
  const [draftType, setDraftType] = useState('percentage');
  const [draftValue, setDraftValue] = useState('');
  const [draftInsurance, setDraftInsurance] = useState('');
  const [draftSpecialty, setDraftSpecialty] = useState('');
  const [localRules, setLocalRules] = useState<CommissionRule[]>([]);

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
      const paidByPro = transactions.filter(
        (t) =>
          t.dentist_id === m.user_id &&
          t.type === 'income' &&
          t.status === 'paid'
      );
      const earned = paidByPro.reduce((s, t) => s + Number(t.amount), 0);

      const proRules = rules[m.user_id] ?? [];
      let commission = 0;
      proRules.forEach((rule) => {
        // Skip rule if it targets a specific specialty that doesn't match this professional
        if (rule.specialty && m.specialty !== rule.specialty) return;

        // Filter transactions by insurance if the rule specifies one
        const applicableTx = rule.insurance
          ? paidByPro.filter(
              (t) => (t.patients as any)?.insurance_provider === rule.insurance
            )
          : paidByPro;
        const applicableEarned = applicableTx.reduce(
          (s, t) => s + Number(t.amount),
          0
        );

        if (rule.type === 'percentage')
          commission += applicableEarned * (rule.value / 100);
        else commission += rule.value;
      });

      return {
        id: m.user_id,
        name: profile?.full_name ?? 'Profissional',
        specialty: m.specialty as string | null,
        earned,
        commission,
        rulesCount: proRules.length,
      };
    });
  }, [members, profilesData, transactions, rules]);

  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const openConfig = (pro: { id: string; name: string }) => {
    setEditingPro(pro);
    setLocalRules([...(rules[pro.id] ?? [])]);
    setDraftTrigger('after_procedure');
    setDraftType('percentage');
    setDraftValue('');
    setDraftInsurance('');
    setDraftSpecialty('');
    setConfigOpen(true);
  };

  const addRule = () => {
    const v = parseFloat(draftValue);
    if (!v || v <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    const newRule: CommissionRule = {
      id: Math.random().toString(36).slice(2),
      trigger: draftTrigger,
      type: draftType,
      value: v,
      insurance: draftInsurance || undefined,
      specialty: draftSpecialty || undefined,
    };
    setLocalRules((prev) => [...prev, newRule]);
    setDraftValue('');
  };

  const removeLocalRule = (id: string) => {
    setLocalRules((prev) => prev.filter((r) => r.id !== id));
  };

  const saveConfig = () => {
    if (!editingPro) return;
    const next = { ...rules, [editingPro.id]: localRules };
    setRules(next);
    saveRules(clinicId, next);
    toast.success('Comissões salvas!');
    setConfigOpen(false);
  };

  const triggerLabel = (t: string) =>
    TRIGGERS.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          As regras de comissão são salvas apenas neste dispositivo/navegador. Reconfigure se acessar de outro dispositivo.
        </span>
      </div>
      {professionals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Nenhum profissional vinculado à clínica
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary header */}
          <div className="hidden sm:grid grid-cols-[1fr_140px_140px_140px] gap-4 px-4 text-xs text-muted-foreground font-medium border-b border-border/40 pb-2">
            <span>Profissional</span>
            <span className="text-right">Faturado no período</span>
            <span className="text-right">Comissão calculada</span>
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
                    <p className="text-xs text-muted-foreground">Comissão</p>
                    <p className="text-sm font-semibold text-primary">
                      {fmt(pro.commission)}
                    </p>
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
                  value={draftInsurance}
                  onValueChange={setDraftInsurance}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
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
                  value={draftSpecialty}
                  onValueChange={setDraftSpecialty}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
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
              disabled={!draftValue || parseFloat(draftValue) <= 0}
            >
              Salvar regra
            </Button>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm font-medium">Regras criadas</p>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {localRules.length === 0 ? (
                <div className="rounded-lg border border-border/50 p-4 text-xs text-muted-foreground text-center">
                  As regras que você criar serão exibidas aqui.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {localRules.map((rule) => (
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
                        {(rule.insurance || rule.specialty) && (
                          <p className="text-muted-foreground">
                            {[rule.insurance, rule.specialty]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => removeLocalRule(rule.id)}
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
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
