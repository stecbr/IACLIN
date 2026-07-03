import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Plus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { RequestItem } from '@/components/attendance/RequestsEditor';
import { toast } from 'sonner';

interface Medication {
  medication: string;
  concentration?: string;
  dosage?: string;
  duration?: string;
  route?: string;
  controlled?: boolean;
  justification?: string;
}

interface SuggestionResult {
  medications: Medication[];
  treatment_suggestions: string[];
  notes?: string;
}

interface Props {
  chiefComplaint: string;
  hypotheses: Array<{ text: string; cid10?: string }>;
  diagnosis: string;
  specialty?: string;
  treatmentPlan: string;
  onAddToRequests: (items: RequestItem[]) => void;
  onUpdateTreatmentPlan: (text: string) => void;
}

export function AiSuggestionsCard({
  chiefComplaint, hypotheses, diagnosis, specialty,
  treatmentPlan, onAddToRequests, onUpdateTreatmentPlan,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [addedMeds, setAddedMeds] = useState<Set<number>>(new Set());

  const hasContext = chiefComplaint.trim() || hypotheses.length > 0 || diagnosis.trim();

  const suggest = async () => {
    if (!hasContext) {
      toast.warning('Preencha a queixa principal ou hipóteses diagnósticas antes de pedir sugestões.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setAddedMeds(new Set());

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('suggest-treatment', {
        body: { chief_complaint: chiefComplaint, hypotheses, diagnosis, specialty },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setResult(data.result as SuggestionResult);
      setExpanded(true);
    } catch (e: any) {
      setError(e.message || 'Erro ao obter sugestões da IA');
    } finally {
      setLoading(false);
    }
  };

  const addMedToRecipe = (med: Medication, idx: number) => {
    const item: RequestItem = {
      id: crypto.randomUUID(),
      kind: 'prescription',
      payload: {
        medication:    med.medication,
        concentration: med.concentration || '',
        dosage:        med.dosage || '',
        duration:      med.duration || '',
        route:         med.route || 'oral',
        type:          med.controlled ? 'controlled' : 'common',
      },
    };
    onAddToRequests([item]);
    setAddedMeds((prev) => new Set([...prev, idx]));
    toast.success(`${med.medication} adicionado à receita`);
  };

  const appendTreatment = (suggestion: string) => {
    const current = treatmentPlan.trim();
    onUpdateTreatmentPlan(current ? `${current}\n• ${suggestion}` : `• ${suggestion}`);
    toast.success('Sugestão adicionada ao plano de tratamento');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={suggest}
          disabled={loading}
          className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? 'Consultando IA...' : 'Sugerir com IA'}
        </Button>

        {result && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Recolher' : 'Ver sugestões'}
          </button>
        )}
      </div>

      {!hasContext && (
        <p className="text-xs text-muted-foreground">
          Preencha a queixa principal ou hipóteses diagnósticas para ativar sugestões da IA.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result && expanded && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <CardTitle className="text-sm text-primary">Sugestões da IA</CardTitle>
              <Badge variant="outline" className="text-xs text-muted-foreground ml-auto">Apoio à decisão</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revise antes de aplicar. A IA não substitui a avaliação clínica.
            </p>
          </CardHeader>

          <CardContent className="px-4 pb-4 space-y-4">
            {result.medications.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Medicamentos sugeridos
                </p>
                <div className="space-y-2">
                  {result.medications.map((med, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-border/50 bg-background px-3 py-2 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{med.medication}</span>
                          {med.concentration && (
                            <span className="text-muted-foreground text-sm"> {med.concentration}</span>
                          )}
                          {med.controlled && (
                            <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1">Controlado</Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={addedMeds.has(idx) ? 'secondary' : 'outline'}
                          className="shrink-0 h-7 gap-1 text-xs"
                          disabled={addedMeds.has(idx)}
                          onClick={() => addMedToRecipe(med, idx)}
                        >
                          <Plus className="h-3 w-3" />
                          {addedMeds.has(idx) ? 'Adicionado' : 'Add à receita'}
                        </Button>
                      </div>
                      {(med.dosage || med.duration || med.route) && (
                        <p className="text-xs text-muted-foreground">
                          {[med.dosage, med.duration, med.route ? `Via ${med.route}` : ''].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {med.justification && (
                        <p className="text-xs text-muted-foreground italic">{med.justification}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.treatment_suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Conduta / Orientações
                </p>
                <div className="space-y-1.5">
                  {result.treatment_suggestions.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground text-sm mt-0.5 shrink-0">•</span>
                      <span className="text-sm flex-1">{s}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs shrink-0"
                        onClick={() => appendTreatment(s)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.notes && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">{result.notes}</p>
              </div>
            )}

            {result.medications.length === 0 && result.treatment_suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                A IA não gerou sugestões específicas para este contexto.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
