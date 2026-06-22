import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CID10_DATA } from '@/lib/cid10Data';
import { getSymptomCidSuggestions } from '@/lib/symptomCidSuggestions';

export interface Hypothesis {
  id: string;
  text: string;
  cid10: string;
}

interface Props {
  hypotheses: Hypothesis[];
  onChange: (h: Hypothesis[]) => void;
  diagnosis: string;
  setDiagnosis: (v: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  readOnly?: boolean;
}

const SEVERITY_OPTS = [
  { value: 'mild', label: 'Leve', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { value: 'moderate', label: 'Moderado', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { value: 'severe', label: 'Grave', tone: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface Cid10AutocompleteProps {
  textValue: string;
  cid10Value: string;
  onTextChange: (v: string) => void;
  onCid10Change: (v: string) => void;
  onSelect: (description: string, code: string) => void;
  disabled?: boolean;
}

function Cid10Autocomplete({ textValue, cid10Value, onTextChange, onCid10Change, onSelect, disabled }: Cid10AutocompleteProps) {
  const [activeField, setActiveField] = useState<'text' | 'cid10' | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const query = activeField === 'text' ? textValue : activeField === 'cid10' ? cid10Value : '';

  // Sugestões clássicas — busca direta no CID10_DATA por código ou descrição
  const cid10Results = useMemo(() => {
    const term = normalize(query.trim());
    if (!term || term.length < 2) return [];
    return CID10_DATA.filter(
      (c) => normalize(c.code).includes(term) || normalize(c.description).includes(term)
    ).slice(0, 6);
  }, [query]);

  // Sugestões inteligentes por sintoma — só quando o campo de texto estiver ativo
  const symptomResults = useMemo(() => {
    if (activeField !== 'text' || textValue.length < 3) return [];
    const suggestions = getSymptomCidSuggestions(textValue);
    // Remove os que já aparecem no CID10Results para não duplicar
    const existingCodes = new Set(cid10Results.map(r => r.code));
    return suggestions.filter(s => !existingCodes.has(s.code));
  }, [activeField, textValue, cid10Results]);

  const totalResults = cid10Results.length + symptomResults.length;
  const showDropdown = activeField !== null && totalResults > 0;

  useEffect(() => { setHighlightIndex(0); }, [totalResults]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (code: string, description: string) => {
    onSelect(description, code);
    setActiveField(null);
  };

  // Lista unificada para navegação por teclado
  const allItems = useMemo(() => [
    ...cid10Results.map(r => ({ code: r.code, description: r.description, isSymptom: false })),
    ...symptomResults.map(r => ({ code: r.code, description: r.description, isSymptom: true })),
  ], [cid10Results, symptomResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = allItems[highlightIndex];
      if (item) pick(item.code, item.description);
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 grid grid-cols-1 md:grid-cols-[1fr,140px] gap-2">
      <Input
        value={textValue}
        onChange={(e) => { onTextChange(e.target.value); setActiveField('text'); }}
        onFocus={() => setActiveField('text')}
        onKeyDown={handleKeyDown}
        placeholder="Hipótese diagnóstica"
        className="h-9 text-sm"
        disabled={disabled}
        autoComplete="off"
      />
      <Input
        value={cid10Value}
        onChange={(e) => { onCid10Change(e.target.value); setActiveField('cid10'); }}
        onFocus={() => setActiveField('cid10')}
        onKeyDown={handleKeyDown}
        placeholder="CID-10 (opcional)"
        className="h-9 text-sm font-mono"
        disabled={disabled}
        autoComplete="off"
      />

      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {/* Sugestões clássicas do CID10 */}
          {cid10Results.length > 0 && (
            <>
              {symptomResults.length > 0 && (
                <li className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">CID-10</span>
                </li>
              )}
              {cid10Results.map((item, idx) => (
                <li key={item.code}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(item.code, item.description); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                      idx === highlightIndex ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60'
                    )}
                  >
                    <span className="inline-flex h-5 min-w-[52px] items-center justify-center rounded bg-primary/10 text-primary text-[11px] font-bold tracking-wider px-1.5 flex-shrink-0">
                      {item.code}
                    </span>
                    <span className="truncate">{item.description}</span>
                  </button>
                </li>
              ))}
            </>
          )}

          {/* Sugestões inteligentes por sintoma */}
          {symptomResults.length > 0 && (
            <>
              <li className="px-3 pt-2 pb-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-violet-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Sugestão por sintoma
                </span>
              </li>
              {symptomResults.map((item, idx) => {
                const globalIdx = cid10Results.length + idx;
                return (
                  <li key={item.code}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pick(item.code, item.description); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        globalIdx === highlightIndex ? 'bg-violet-500/10 text-foreground' : 'hover:bg-muted/60'
                      )}
                    >
                      <span className="inline-flex h-5 min-w-[52px] items-center justify-center rounded bg-violet-500/15 text-violet-600 dark:text-violet-400 text-[11px] font-bold tracking-wider px-1.5 flex-shrink-0">
                        {item.code}
                      </span>
                      <span className="truncate">{item.description}</span>
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

export function HypothesesEditor({ hypotheses, onChange, diagnosis, setDiagnosis, severity, setSeverity, readOnly }: Props) {
  const add = () => onChange([...hypotheses, { id: crypto.randomUUID(), text: '', cid10: '' }]);
  const update = (id: string, field: 'text' | 'cid10', value: string) =>
    onChange(hypotheses.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  const select = (id: string, description: string, code: string) =>
    onChange(hypotheses.map((h) => (h.id === id ? { ...h, text: description, cid10: code } : h)));
  const remove = (id: string) => onChange(hypotheses.filter((h) => h.id !== id));

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Hipóteses diagnósticas</CardTitle>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={add} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {hypotheses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma hipótese registrada.</p>
          ) : (
            hypotheses.map((h, idx) => (
              <div key={h.id} className="flex gap-2 items-start p-2 rounded-lg border border-border/50">
                <span className="text-xs text-muted-foreground mt-2.5 w-5 flex-shrink-0 text-center">{idx + 1}.</span>
                {readOnly ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr,140px] gap-2">
                    <Input value={h.text} placeholder="Hipótese diagnóstica" className="h-9 text-sm" disabled />
                    <Input value={h.cid10} placeholder="CID-10 (opcional)" className="h-9 text-sm font-mono" disabled />
                  </div>
                ) : (
                  <Cid10Autocomplete
                    textValue={h.text}
                    cid10Value={h.cid10}
                    onTextChange={(v) => update(h.id, 'text', v)}
                    onCid10Change={(v) => update(h.id, 'cid10', v)}
                    onSelect={(desc, code) => select(h.id, desc, code)}
                  />
                )}
                {!readOnly && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(h.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Diagnóstico definitivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={3}
            placeholder="Diagnóstico fechado, se houver"
            className="resize-none"
            disabled={readOnly}
          />
          <div>
            <Label className="text-xs mb-2 block">Severidade</Label>
            <div className="flex gap-2 flex-wrap">
              {SEVERITY_OPTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => !readOnly && setSeverity(severity === s.value ? '' : s.value)}
                  disabled={readOnly}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    severity === s.value
                      ? s.tone
                      : 'bg-background text-muted-foreground border-border hover:bg-muted/50',
                    readOnly && 'cursor-not-allowed opacity-60'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
