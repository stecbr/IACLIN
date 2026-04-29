import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, Check, ChevronDown, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SPECIALTIES, type Specialty } from '@/components/patient/booking/SpecialtyStep';

export type SpecialtyFilter = 'odonto' | 'medico' | 'all';

interface SpecialtySelectProps {
  value: string;
  onChange: (id: string) => void;
  filterCategory?: SpecialtyFilter;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  required?: boolean;
}

function filterByCategory(filter: SpecialtyFilter): Specialty[] {
  if (filter === 'all') return SPECIALTIES;
  if (filter === 'odonto') return SPECIALTIES.filter((s) => s.category === 'odonto');
  // 'medico' includes medico + estetica + outro (everything that's not strictly odonto)
  return SPECIALTIES.filter((s) => s.category !== 'odonto');
}

export function SpecialtySelect({
  value,
  onChange,
  filterCategory = 'all',
  placeholder = 'Selecione uma especialidade',
  disabled,
  id,
  className,
}: SpecialtySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => filterByCategory(filterCategory), [filterCategory]);
  const popular = useMemo(() => list.filter((s) => s.popular), [list]);

  const selected = useMemo(
    () => SPECIALTIES.find((s) => s.id === value),
    [value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [list, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <selected.icon className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate text-foreground">{selected.name}</span>
              </>
            ) : (
              <>
                <Stethoscope className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{placeholder}</span>
              </>
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[360px] overflow-hidden flex flex-col"
        align="start"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar especialidade..."
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {!query && popular.length > 0 && (
            <div className="p-2">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mais procurados
              </p>
              <div className="flex flex-wrap gap-1.5 px-1">
                {popular.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onChange(s.id); setOpen(false); }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                      value === s.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted',
                    )}
                  >
                    <s.icon className="h-3 w-3" />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-1">
            {!query && popular.length > 0 && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Todas (A-Z)
              </p>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhum resultado para "{query}".
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onChange(s.id); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === s.id && 'bg-accent/60',
                  )}
                >
                  <s.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{s.name}</span>
                  {value === s.id && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Helper: convert a stored specialty id to a readable label (or fall back to raw value). */
export function specialtyLabel(value: string | null | undefined): string {
  if (!value) return '';
  const found = SPECIALTIES.find((s) => s.id === value);
  return found?.name ?? value;
}

/** Helper: returns true if value is a known catalog id. */
export function isCatalogSpecialty(value: string | null | undefined): boolean {
  if (!value) return false;
  return SPECIALTIES.some((s) => s.id === value);
}

/**
 * Returns the proper professional registration label based on the specialty.
 * - Odontology specialties → 'CRO'
 * - All other specialties (medical, aesthetic, vet, other) → 'CRM'
 */
export function registrationLabelForSpecialty(
  specialtyId: string | null | undefined,
): 'CRO' | 'CRM' {
  if (!specialtyId) return 'CRM';
  const s = SPECIALTIES.find((x) => x.id === specialtyId);
  return s?.category === 'odonto' ? 'CRO' : 'CRM';
}

export function registrationPlaceholderForSpecialty(
  specialtyId: string | null | undefined,
): string {
  return `Digite seu ${registrationLabelForSpecialty(specialtyId)}`;
}

export type SpecialtyCategory = 'odonto' | 'medico' | 'estetica' | 'veterinario' | 'outro';

/** Returns the high-level category for a stored specialty id (defaults to 'outro'). */
export function specialtyCategoryOf(
  specialtyId: string | null | undefined,
): SpecialtyCategory {
  if (!specialtyId) return 'outro';
  const found = SPECIALTIES.find((s) => s.id === specialtyId);
  return (found?.category ?? 'outro') as SpecialtyCategory;
}

/**
 * Light validation: makes sure the user did not paste a CRM number for an odonto
 * specialty (or a CRO for a medical one). Returns null if OK, else an error message.
 * Only checks an explicit textual prefix — pure numeric values are always accepted.
 */
export function validateRegistrationForSpecialty(
  registration: string,
  specialtyId: string | null | undefined,
): string | null {
  const trimmed = (registration ?? '').trim();
  if (!trimmed) return null;
  const expected = registrationLabelForSpecialty(specialtyId);
  const upper = trimmed.toUpperCase();
  const startsWithCRO = /^CRO\b/.test(upper);
  const startsWithCRM = /^CRM\b/.test(upper);
  if (expected === 'CRO' && startsWithCRM) {
    return 'Esta especialidade é de Odontologia — informe um CRO, não um CRM.';
  }
  if (expected === 'CRM' && startsWithCRO) {
    return 'Esta especialidade é da área médica — informe um CRM, não um CRO.';
  }
  return null;
}
