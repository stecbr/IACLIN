import { useEffect, useState } from 'react';
import { Shield, Wallet, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { InsurancePlanSelect } from '@/components/InsurancePlanSelect';

export type CoverageChoice =
  | { kind: 'private' }
  | { kind: 'insurance'; planId: string; planName: string };

interface CoverageStepProps {
  value: CoverageChoice | null;
  onSelect: (choice: CoverageChoice) => void;
}

export function CoverageStep({ value, onSelect }: CoverageStepProps) {
  const [mode, setMode] = useState<'private' | 'insurance' | null>(
    value?.kind === 'insurance' ? 'insurance' : value?.kind === 'private' ? 'private' : null,
  );
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');

  // Hydrate selection from existing value (single row lookup by id — the
  // catalog has tens of thousands of rows, so it can't be fetched in bulk).
  useEffect(() => {
    if (value?.kind !== 'insurance') return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('insurance_plans_catalog')
        .select('id, plan_name, operator_name')
        .eq('id', value.planId)
        .maybeSingle();
      if (!cancelled && data) {
        setSelectedOperator(data.operator_name);
        setSelectedPlan(data.plan_name);
      }
    })();
    return () => { cancelled = true; };
  }, [value]);

  const handlePlanChange = async (operator: string, plan: string) => {
    setSelectedOperator(operator);
    setSelectedPlan(plan);
    if (!operator || !plan) return;
    const { data: row } = await supabase
      .from('insurance_plans_catalog')
      .select('id, plan_name, operator_name')
      .eq('operator_name', operator)
      .eq('plan_name', plan)
      .maybeSingle();
    if (row) {
      onSelect({
        kind: 'insurance',
        planId: row.id,
        planName: `${row.operator_name} — ${row.plan_name}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Como deseja pagar?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha entre particular ou usar um convênio.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setMode('private');
            onSelect({ kind: 'private' });
          }}
          className={cn(
            'group relative rounded-2xl border bg-card p-5 text-left transition-all',
            'hover:border-primary/50 hover:shadow-sm',
            mode === 'private' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Particular</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pagamento direto à clínica.
              </p>
            </div>
            {mode === 'private' && (
              <Check className="h-4 w-4 text-primary absolute top-3 right-3" />
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode('insurance')}
          className={cn(
            'group relative rounded-2xl border bg-card p-5 text-left transition-all',
            'hover:border-primary/50 hover:shadow-sm',
            mode === 'insurance' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Convênio</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use seu plano de saúde ou odontológico.
              </p>
            </div>
            {mode === 'insurance' && (
              <Check className="h-4 w-4 text-primary absolute top-3 right-3" />
            )}
          </div>
        </button>
      </div>

      {mode === 'insurance' && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Selecione seu convênio</p>
            <p className="text-xs text-muted-foreground">
              Mostraremos apenas clínicas que aceitam esse plano.
            </p>
          </div>
          <InsurancePlanSelect
            operatorValue={selectedOperator}
            planValue={selectedPlan}
            onChange={handlePlanChange}
            placeholder="Selecione o convênio"
          />
        </Card>
      )}
    </div>
  );
}
