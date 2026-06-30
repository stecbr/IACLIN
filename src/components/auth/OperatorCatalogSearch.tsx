import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface CatalogOperator {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  ans_code: string | null;
  type: 'medico' | 'odonto' | 'ambos';
  contact_phone: string | null;
  responsible_name: string | null;
}

interface Props {
  value: string;
  onTextChange: (text: string) => void;
  onSelect: (op: CatalogOperator | null) => void;
  selectedId?: string | null;
  placeholder?: string;
}

/**
 * Busca em tempo real no catálogo de operadoras (ANS).
 * Só lista operadoras AINDA não reivindicadas (sem owner).
 */
export function OperatorCatalogSearch({
  value,
  onTextChange,
  onSelect,
  selectedId,
  placeholder = 'Digite o nome da operadora (ex: Unimed, Amil…)',
}: Props) {
  const [results, setResults] = useState<CatalogOperator[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (selectedId) return; // already locked to a selection
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('insurance_operators')
        .select('id, name, legal_name, cnpj, ans_code, type, contact_phone, responsible_name')
        .is('owner_id', null)
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,legal_name.ilike.%${q}%,cnpj.ilike.%${q}%,ans_code.ilike.%${q}%`)
        .order('name')
        .limit(12);
      if (cancel) return;
      if (!error && data) setResults(data as CatalogOperator[]);
      setLoading(false);
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [value, selectedId]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onTextChange(e.target.value);
            if (selectedId) onSelect(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn('h-10 pl-9 pr-9', selectedId && 'border-green-500 bg-green-50/40 dark:bg-green-950/20')}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedId ? (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                onTextChange('');
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              tabIndex={-1}
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {selectedId && (
        <p className="mt-1 text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
          <Check className="h-3 w-3" /> Operadora encontrada no banco de dados. Campos preenchidos automaticamente.
        </p>
      )}

      {open && !selectedId && value.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              Nenhuma operadora encontrada. Você pode continuar e cadastrar uma nova.
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onSelect(r);
                onTextChange(r.name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b last:border-b-0 transition-colors"
            >
              <div className="text-sm font-medium truncate">{r.name}</div>
              {r.legal_name && r.legal_name !== r.name && (
                <div className="text-[11px] text-muted-foreground truncate">{r.legal_name}</div>
              )}
              <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                {r.ans_code && <span>ANS {r.ans_code}</span>}
                {r.cnpj && <span className="font-mono">{r.cnpj}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}