import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function HypothesesEditor({ hypotheses, onChange, diagnosis, setDiagnosis, severity, setSeverity, readOnly }: Props) {
  const add = () => onChange([...hypotheses, { id: crypto.randomUUID(), text: '', cid10: '' }]);
  const update = (id: string, field: 'text' | 'cid10', value: string) =>
    onChange(hypotheses.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
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
                <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr,140px] gap-2">
                  <Input
                    value={h.text}
                    onChange={(e) => update(h.id, 'text', e.target.value)}
                    placeholder="Hipótese diagnóstica"
                    className="h-9 text-sm"
                    disabled={readOnly}
                  />
                  <Input
                    value={h.cid10}
                    onChange={(e) => update(h.id, 'cid10', e.target.value)}
                    placeholder="CID-10 (opcional)"
                    className="h-9 text-sm"
                    disabled={readOnly}
                  />
                </div>
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