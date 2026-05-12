import { useEffect, useMemo, useState } from 'react';
import { MapPin, Map as MapIcon, Shield, X, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface BookingFiltersValue {
  state: string | null;
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

const BR_STATES: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
];

function normalizeCity(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return cleaned
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function normalizeState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.length === 2) return t.toUpperCase();
  const found = BR_STATES.find((s) => s.name.toLowerCase() === t.toLowerCase());
  return found ? found.uf : t.toUpperCase();
}

interface CityEntry { name: string; state: string | null }

export function BookingFilters({ value, onChange }: BookingFiltersProps) {
  const [allCities, setAllCities] = useState<string[]>([]);
  const [stateCities, setStateCities] = useState<Record<string, string[]>>({});
  const [plans, setPlans] = useState<InsuranceOption[]>([]);
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ins } = await supabase
        .from('insurance_plans')
        .select('id, name, ans_code, clinic_id, is_active')
        .eq('is_active', true);
      const seen = new Map<string, InsuranceOption>();
      for (const p of (ins ?? []) as any[]) {
        const k = `${(p.name || '').toLowerCase()}|${p.ans_code || ''}`;
        if (!seen.has(k)) seen.set(k, p);
      }
      setPlans(Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    })();
  }, []);

  // Load cities for the selected state (or all states) from IBGE on demand
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (value.state) {
        if (stateCities[value.state]) return;
        try {
          const res = await fetch(
            `https://servicos.ibge.gov.br/api/v1/localidades/estados/${value.state}/municipios`,
          );
          const data = await res.json();
          const names = (data ?? [])
            .map((m: any) => normalizeCity(m.nome))
            .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
          if (!cancelled) setStateCities((prev) => ({ ...prev, [value.state!]: names }));
        } catch { /* ignore */ }
      } else if (allCities.length === 0) {
        try {
          const res = await fetch(
            'https://servicos.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
          );
          const data = await res.json();
          const names = Array.from(
            new Set((data ?? []).map((m: any) => normalizeCity(m.nome))),
          ).sort((a, b) => (a as string).localeCompare(b as string, 'pt-BR')) as string[];
          if (!cancelled) setAllCities(names);
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [value.state]);

  const filteredCities = useMemo(() => {
    if (value.state) return stateCities[value.state] ?? [];
    return allCities;
  }, [allCities, stateCities, value.state]);

  const stateLabel = useMemo(() => {
    if (!value.state) return 'Todos os estados';
    const s = BR_STATES.find((x) => x.uf === value.state);
    return s ? `${s.name} (${s.uf})` : value.state;
  }, [value.state]);

  const planLabel = useMemo(() => {
    if (!value.insurancePlanId) return 'Particular / Todos';
    const p = plans.find((x) => x.id === value.insurancePlanId);
    return p ? p.name : 'Convênio';
  }, [plans, value.insurancePlanId]);

  const hasFilters = !!value.state || !!value.city || !!value.insurancePlanId;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      {/* State */}
      <Popover open={stateOpen} onOpenChange={setStateOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <MapIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">{stateLabel}</span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar estado..." />
            <CommandList>
              <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange({ ...value, state: null });
                    setStateOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value.state ? 'opacity-100' : 'opacity-0')} />
                  Todos os estados
                </CommandItem>
                {BR_STATES.map((s) => (
                  <CommandItem
                    key={s.uf}
                    value={`${s.name} ${s.uf}`}
                    onSelect={() => {
                      onChange({ ...value, state: s.uf, city: null });
                      setStateOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value.state === s.uf ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{s.uf}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
              <CommandEmpty>
                {value.state
                  ? 'Nenhuma cidade neste estado.'
                  : 'Nenhuma cidade encontrada.'}
              </CommandEmpty>
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
                {filteredCities.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    onSelect={() => {
                      onChange({ ...value, city: name });
                      setCityOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value.city === name ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1">{name}</span>
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
          onClick={() => onChange({ state: null, city: null, insurancePlanId: null })}
        >
          <X className="h-3 w-3" />
          Limpar
        </Button>
      )}
    </div>
  );
}
