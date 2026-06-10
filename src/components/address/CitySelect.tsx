import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCitiesByUf, BRAZIL_CITIES, foldKey, normalizeUf } from '@/lib/brazilCities';

interface Props {
  value: string;
  onChange: (city: string, uf?: string) => void;
  /** Restrict suggestions to this UF when provided. */
  uf?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable picker of Brazilian cities. The text input only filters — the user
 * must pick a predefined city so values stay standardized.
 */
export function CitySelect({ value, onChange, uf, placeholder = 'Selecione a cidade…', id, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedUf = normalizeUf(uf ?? '');
  const pool = useMemo(() => (normalizedUf ? getCitiesByUf(normalizedUf) : BRAZIL_CITIES), [normalizedUf]);

  const filtered = useMemo(() => {
    const q = foldKey(query);
    if (!q) return pool.slice(0, 200);
    const starts: typeof pool = [];
    const includes: typeof pool = [];
    for (const c of pool) {
      const k = foldKey(c.name);
      if (k.startsWith(q)) starts.push(c);
      else if (k.includes(q)) includes.push(c);
      if (starts.length + includes.length >= 400) break;
    }
    return [...starts, ...includes].slice(0, 200);
  }, [pool, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{value || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px] z-[1000]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar cidade…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
            <CommandGroup>
              {filtered.map((c) => {
                const label = normalizedUf ? c.name : `${c.name} — ${c.uf}`;
                const selected = value === c.name;
                return (
                  <CommandItem
                    key={`${c.uf}-${c.name}`}
                    value={`${c.name}-${c.uf}`}
                    onSelect={() => {
                      onChange(c.name, c.uf);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}