import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface AddressValue {
  zipCode: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface Props {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  idPrefix?: string;
  /** se true, mostra UF e Cidade lado a lado em 2 colunas; caso contrário em 3 (col 2 + col 1) */
  className?: string;
}

function formatCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

interface ViaCepSuggestion {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/**
 * Endereço inteligente:
 *  - Digite o CEP e os campos são preenchidos automaticamente.
 *  - Digite o logradouro e veja sugestões reais (ViaCEP) — ao selecionar,
 *    CEP, bairro, cidade e UF são preenchidos.
 *  - Marque "Sem número" para imóveis sem numeração.
 */
export function SmartAddressFields({ value, onChange, idPrefix = 'addr', className }: Props) {
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  // ---------- CEP -> ViaCEP ----------
  const [fetchingCep, setFetchingCep] = useState(false);
  useEffect(() => {
    const digits = value.zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    let cancelled = false;
    setFetchingCep(true);
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data?.erro) return;
        onChange({
          ...value,
          address: data.logradouro || value.address,
          neighborhood: data.bairro || value.neighborhood,
          city: data.localidade || value.city,
          state: data.uf || value.state,
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchingCep(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.zipCode]);

  // ---------- Logradouro -> autocomplete ViaCEP ----------
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<ViaCepSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canSearch = useMemo(() => {
    return value.state.trim().length === 2 && value.city.trim().length >= 3 && value.address.trim().length >= 3;
  }, [value.state, value.city, value.address]);

  useEffect(() => {
    if (!canSearch) { setSuggestions([]); setError(null); return; }
    let cancelled = false;
    setSearching(true);
    setError(null);
    const handle = setTimeout(() => {
      const uf = value.state.trim().toUpperCase();
      const cidade = encodeURIComponent(value.city.trim());
      const logr = encodeURIComponent(value.address.trim());
      fetch(`https://viacep.com.br/ws/${uf}/${cidade}/${logr}/json/`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (Array.isArray(data)) {
            setSuggestions(data.slice(0, 25));
          } else {
            setSuggestions([]);
            setError('Nenhum endereço encontrado');
          }
        })
        .catch(() => { if (!cancelled) setError('Falha ao buscar endereços'); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [value.address, value.city, value.state, canSearch]);

  // fecha dropdown ao clicar fora
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleSelect = (s: ViaCepSuggestion) => {
    onChange({
      ...value,
      zipCode: formatCep(s.cep),
      address: s.logradouro,
      neighborhood: s.bairro,
      city: s.localidade,
      state: s.uf,
    });
    setOpen(false);
  };

  // ---------- Sem número ----------
  const noNumber = value.addressNumber.trim().toUpperCase() === 'S/N';

  return (
    <div className={cn('grid md:grid-cols-6 gap-3', className)}>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-cep`}>CEP *</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-cep`}
            value={value.zipCode}
            onChange={(e) => set({ zipCode: formatCep(e.target.value) })}
            placeholder="00000-000"
            inputMode="numeric"
          />
          {fetchingCep && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="space-y-1.5 md:col-span-4 relative" ref={containerRef}>
        <Label htmlFor={`${idPrefix}-logr`}>Logradouro *</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-logr`}
            value={value.address}
            onChange={(e) => { set({ address: e.target.value }); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Comece a digitar a rua…"
            autoComplete="off"
          />
          {searching
            ? <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            : <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          }
        </div>
        {open && (suggestions.length > 0 || error || !canSearch) && (
          <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
            {!canSearch && (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Informe UF, cidade e ao menos 3 letras da rua — ou digite o CEP para preencher tudo automaticamente.
              </div>
            )}
            {canSearch && error && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{error}</div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={`${s.cep}-${i}`}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-b-0"
              >
                <div className="text-sm text-foreground">{s.logradouro || '—'}</div>
                <div className="text-[11px] text-muted-foreground">
                  {[s.bairro, s.localidade, s.uf].filter(Boolean).join(' · ')} {s.cep ? `· ${s.cep}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-num`}>Número *</Label>
        <Input
          id={`${idPrefix}-num`}
          value={noNumber ? '' : value.addressNumber}
          disabled={noNumber}
          onChange={(e) => set({ addressNumber: e.target.value })}
          placeholder="123"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer pt-0.5">
          <Checkbox
            checked={noNumber}
            onCheckedChange={(checked) => set({ addressNumber: checked ? 'S/N' : '' })}
          />
          Sem número
        </label>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-comp`}>Complemento</Label>
        <Input
          id={`${idPrefix}-comp`}
          value={value.addressComplement}
          onChange={(e) => set({ addressComplement: e.target.value })}
          placeholder="Sala 101"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-bairro`}>Bairro</Label>
        <Input
          id={`${idPrefix}-bairro`}
          value={value.neighborhood}
          onChange={(e) => set({ neighborhood: e.target.value })}
          placeholder="Centro"
        />
      </div>

      <div className="space-y-1.5 md:col-span-4">
        <Label htmlFor={`${idPrefix}-city`}>Cidade *</Label>
        <Input
          id={`${idPrefix}-city`}
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
          placeholder="São Paulo"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-state`}>UF *</Label>
        <Input
          id={`${idPrefix}-state`}
          value={value.state}
          onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })}
          placeholder="SP"
          maxLength={2}
        />
      </div>
    </div>
  );
}