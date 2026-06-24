import { useEffect, useMemo, useState } from 'react';
import { Shield, Wallet, Check, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
}

export function CoverageStep({ value, onSelect }: CoverageStepProps) {
  const [mode, setMode] = useState<'private' | 'insurance' | null>(
    value?.kind === 'insurance' ? 'insurance' : value?.kind === 'private' ? 'private' : null,
  );
  const [plans, setPlans] = useState<InsuranceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (mode !== 'insurance') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('insurance_plans')
        .select('id, name, ans_code, is_active')
        .eq('is_active', true);
      const seen = new Map<string, InsuranceOption>();
      for (const p of (data ?? []) as any[]) {
        const k = `${(p.name || '').toLowerCase()}|${p.ans_code || ''}`;
        if (!seen.has(k)) seen.set(k, { id: p.id, name: p.name, ans_code: p.ans_code });
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.ans_code ?? '').toLowerCase().includes(q),
    );
  }, [plans, query]);

  const selectedPlanId = value?.kind === 'insurance' ? value.planId : null;

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
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar convênio..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {loading ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Nenhum convênio encontrado.
              </p>
            ) : (
              filtered.map((p) => {
                const selected = selectedPlanId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect({ kind: 'insurance', planId: p.id, planName: p.name })}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                      'hover:bg-muted',
                      selected && 'bg-primary/5',
                    )}
                  >
                    <Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.ans_code && (
                      <span className="text-[10px] text-muted-foreground">ANS {p.ans_code}</span>
                    )}
                    {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}