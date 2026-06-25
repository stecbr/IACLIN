import { useEffect, useMemo, useState } from 'react';
import { Shield, Wallet, Check, ChevronsUpDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export type CoverageChoice =
  | { kind: 'private' }
  | { kind: 'insurance'; planId: string; planName: string };

interface CoverageStepProps {
  value: CoverageChoice | null;
  onSelect: (choice: CoverageChoice) => void;
}

interface InsuranceOption {
  id: string;
  name: string;
  ans_code: string | null;
  operator: string;
}

export function CoverageStep({ value, onSelect }: CoverageStepProps) {
  const [mode, setMode] = useState<'private' | 'insurance' | null>(
    value?.kind === 'insurance' ? 'insurance' : value?.kind === 'private' ? 'private' : null,
  );
  const [plans, setPlans] = useState<InsuranceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'insurance') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('insurance_plans_catalog')
        .select('id, plan_name, operator_name, ans_code, is_active')
        .eq('is_active', true);
      const seen = new Map<string, InsuranceOption>();
      for (const p of (data ?? []) as any[]) {
        const fullName = `${p.operator_name} — ${p.plan_name}`;
        const k = `${(p.plan_name || '').toLowerCase()}|${(p.operator_name || '').toLowerCase()}|${p.ans_code || ''}`;
        if (!seen.has(k)) {
          seen.set(k, {
            id: p.id,
            name: fullName,
            ans_code: p.ans_code,
            operator: p.operator_name,
          });
        }
      }
      if (!cancelled) {
        setPlans(
          Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const selectedPlanId = value?.kind === 'insurance' ? value.planId : null;
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, InsuranceOption[]>();
    for (const p of plans) {
      if (!map.has(p.operator)) map.set(p.operator, []);
      map.get(p.operator)!.push(p);
    }
    return Array.from(map.entries());
  }, [plans]);

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
          <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={loading}
                className="w-full justify-between font-normal"
              >
                <span
                  className={cn(
                    'truncate flex items-center gap-2',
                    !selectedPlan && 'text-muted-foreground',
                  )}
                >
                  {selectedPlan && <Shield className="h-3.5 w-3.5 text-primary" />}
                  {loading
                    ? 'Carregando...'
                    : selectedPlan
                      ? selectedPlan.name
                      : 'Selecione o convênio'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Buscar operadora ou plano..." />
                <CommandList className="max-h-72">
                  <CommandEmpty>Nenhum convênio encontrado.</CommandEmpty>
                  {grouped.map(([operator, items]) => (
                    <CommandGroup key={operator} heading={operator}>
                      {items.map((p) => {
                        const selected = selectedPlanId === p.id;
                        return (
                          <CommandItem
                            key={p.id}
                            value={`${p.operator} ${p.name} ${p.ans_code ?? ''}`}
                            onSelect={() => {
                              onSelect({ kind: 'insurance', planId: p.id, planName: p.name });
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')}
                            />
                            <span className="flex-1 truncate">{p.name.split(' — ')[1] ?? p.name}</span>
                            {p.ans_code && (
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                ANS {p.ans_code}
                              </span>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Card>
      )}
    </div>
  );
}