import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

type CatalogRow = {
  id: string;
  operator_name: string;
  plan_name: string;
  type: string;
};

interface InsurancePlanSelectProps {
  /** Operadora atualmente selecionada (ex: "Unimed") */
  operatorValue: string;
  /** Plano/convênio atualmente selecionado (ex: "Unimed Nacional") */
  planValue: string;
  onChange: (operator: string, plan: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Select de convênio (plano) com catálogo global.
 * Operadora ≠ Convênio: aqui o usuário escolhe o PLANO específico
 * (ex: "Unimed Nacional"), e a operadora é derivada automaticamente.
 */
export function InsurancePlanSelect({
  operatorValue,
  planValue,
  onChange,
  placeholder = 'Selecione o convênio',
  disabled,
  id,
  className,
}: InsurancePlanSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['insurance-plans-catalog'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_plans_catalog')
        .select('id, operator_name, plan_name, type')
        .eq('is_active', true)
        .order('operator_name')
        .order('plan_name');
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogRow[]>();
    for (const p of plans) {
      if (!map.has(p.operator_name)) map.set(p.operator_name, []);
      map.get(p.operator_name)!.push(p);
    }
    return Array.from(map.entries());
  }, [plans]);

  const label =
    planValue && operatorValue
      ? `${operatorValue} — ${planValue}`
      : planValue
        ? planValue
        : operatorValue
          ? `${operatorValue} (sem plano)`
          : isLoading
            ? 'Carregando...'
            : placeholder;

  const hasSelection = !!planValue || !!operatorValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !hasSelection && 'text-muted-foreground')}>
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar operadora ou plano..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum convênio encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ particular nenhum"
                onSelect={() => {
                  onChange('', '');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', !hasSelection ? 'opacity-100' : 'opacity-0')}
                />
                Nenhum (Particular)
              </CommandItem>
            </CommandGroup>
            {grouped.map(([operator, items]) => (
              <CommandGroup key={operator} heading={operator}>
                {items.map((p) => {
                  const selected = planValue === p.plan_name && operatorValue === p.operator_name;
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.operator_name} ${p.plan_name}`}
                      onSelect={() => {
                        onChange(p.operator_name, p.plan_name);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{p.plan_name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {/* Compat: valor legado fora do catálogo */}
            {hasSelection &&
              !plans.some(
                (p) => p.plan_name === planValue && p.operator_name === operatorValue,
              ) && (
                <CommandGroup heading="Cadastro atual">
                  <CommandItem disabled value="__current__">
                    <Check className="mr-2 h-4 w-4 opacity-100" />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}