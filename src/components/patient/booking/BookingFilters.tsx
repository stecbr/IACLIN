import { useEffect, useMemo, useState } from 'react';
import { MapPin, Shield, X, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface BookingFiltersValue {
  city: string | null;
  insurancePlanId: string | null;
}

interface InsuranceOption {
  id: string;
  name: string;
  ans_code: string | null;
  clinic_id: string;
}

interface BookingFiltersProps {
  value: BookingFiltersValue;
  onChange: (next: BookingFiltersValue) => void;
}

export function BookingFilters({ value, onChange }: BookingFiltersProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [plans, setPlans] = useState<InsuranceOption[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: clinics }, { data: ins }] = await Promise.all([
        supabase.from('clinics').select('city').not('city', 'is', null),
        supabase.from('insurance_plans').select('id, name, ans_code, clinic_id, is_active').eq('is_active', true),
      ]);
      const set = new Set<string>();
      for (const c of clinics ?? []) {
        const city = (c as any).city?.trim();
        if (city) set.add(city);
      }
      setCities(Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      // Dedup plans by name+ans_code
      const seen = new Map<string, InsuranceOption>();
      for (const p of (ins ?? []) as any[]) {
        const k = `${(p.name || '').toLowerCase()}|${p.ans_code || ''}`;
        if (!seen.has(k)) seen.set(k, p);
      }
      setPlans(Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    })();
  }, []);

  const planLabel = useMemo(() => {
    if (!value.insurancePlanId) return 'Particular / Todos';
    const p = plans.find((x) => x.id === value.insurancePlanId);
    return p ? p.name : 'Convênio';
  }, [plans, value.insurancePlanId]);

  const hasFilters = !!value.city || !!value.insurancePlanId;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      {/* City */}
      <Popover open={cityOpen} onOpenChange={setCityOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">
              {value.city ?? 'Todas as cidades'}
            </span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar cidade..." />
            <CommandList>
              <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange({ ...value, city: null });
                    setCityOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value.city ? 'opacity-100' : 'opacity-0')} />
                  Todas as cidades
                </CommandItem>
                {cities.map((c) => (
                  <CommandItem
                    key={c}
                    onSelect={() => {
                      onChange({ ...value, city: c });
                      setCityOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value.city === c ? 'opacity-100' : 'opacity-0')} />
                    {c}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Insurance plan */}
      <Popover open={planOpen} onOpenChange={setPlanOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium truncate max-w-[180px]">{planLabel}</span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar convênio..." />
            <CommandList>
              <CommandEmpty>Nenhum convênio encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange({ ...value, insurancePlanId: null });
                    setPlanOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value.insurancePlanId ? 'opacity-100' : 'opacity-0')} />
                  Particular / Todos
                </CommandItem>
                {plans.map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => {
                      onChange({ ...value, insurancePlanId: p.id });
                      setPlanOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.insurancePlanId === p.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{p.name}</span>
                    {p.ans_code && (
                      <span className="ml-2 text-[10px] text-muted-foreground">ANS {p.ans_code}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-xs text-muted-foreground"
          onClick={() => onChange({ city: null, insurancePlanId: null })}
        >
          <X className="h-3 w-3" />
          Limpar
        </Button>
      )}
    </div>
  );
}
