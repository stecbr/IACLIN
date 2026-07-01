import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type CatalogRow = {
  id: string;
  operator_name: string;
  plan_name: string;
  type: string;
};

interface InsurancePlanSelectProps {
  operatorValue: string;
  planValue: string;
  onChange: (operator: string, plan: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function InsurancePlanSelect({
  operatorValue,
  planValue,
  onChange,
  placeholder = 'Digite operadora ou plano...',
  disabled,
  id,
  className,
}: InsurancePlanSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // O catálogo tem dezenas de milhares de planos (todas as operadoras ativas
  // da ANS) — buscar tudo de uma vez estoura o limite padrão de 1000 linhas
  // do Supabase e planos de operadoras "no fim do alfabeto" nunca aparecem.
  // Por isso a busca é feita no servidor, com debounce.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['insurance-plans-catalog', debouncedQuery],
    enabled: open,
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from('insurance_plans_catalog')
        .select('id, operator_name, plan_name, type')
        .eq('is_active', true);
      if (debouncedQuery) {
        // vírgula e parênteses têm significado especial na sintaxe do .or() do PostgREST
        const safe = debouncedQuery.replace(/[,()]/g, ' ').trim();
        if (safe) {
          const term = `%${safe}%`;
          q = q.or(`plan_name.ilike.${term},operator_name.ilike.${term}`);
        }
      }
      const { data, error } = await q
        .order('operator_name')
        .order('plan_name')
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });

  const selectedLabel =
    planValue && operatorValue
      ? `${operatorValue} — ${planValue}`
      : planValue || operatorValue || '';

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  const filtered = useMemo(() => {
    // A filtragem já é feita no servidor (debouncedQuery); aqui só agrupamos por operadora.
    const map = new Map<string, CatalogRow[]>();
    for (const p of plans) {
      if (!map.has(p.operator_name)) map.set(p.operator_name, []);
      map.get(p.operator_name)!.push(p);
    }
    return Array.from(map.entries());
  }, [plans]);

  const handleSelect = (operator: string, plan: string) => {
    onChange(operator, plan);
    setQuery(plan ? `${operator} — ${plan}` : '');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id={id}
            ref={inputRef}
            value={query}
            disabled={disabled || isLoading}
            placeholder={isLoading ? 'Carregando...' : placeholder}
            onFocus={() => {
              setOpen(true);
              if (query === selectedLabel) setQuery('');
              // Center the field on screen so the dropdown stays visible (mobile).
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }, 50);
            }}
            onClick={() => {
              setOpen(true);
              if (query === selectedLabel) setQuery('');
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }, 50);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            className="pl-9 pr-9"
            autoComplete="off"
          />
          {(query || selectedLabel) && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => handleSelect('', '')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[--radix-popover-trigger-width] p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <div className="max-h-[min(18rem,50vh)] overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => handleSelect('', '')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
          >
            <Check
              className={cn(
                'h-4 w-4',
                !operatorValue && !planValue ? 'opacity-100' : 'opacity-0',
              )}
            />
            Nenhum (Particular)
          </button>

          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum convênio encontrado.
            </p>
          ) : (
            filtered.map(([operator, items]) => (
              <div key={operator} className="pt-1">
                <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {operator}
                </div>
                {items.map((p) => {
                  const selected =
                    planValue === p.plan_name && operatorValue === p.operator_name;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p.operator_name, p.plan_name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate">{p.plan_name}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
