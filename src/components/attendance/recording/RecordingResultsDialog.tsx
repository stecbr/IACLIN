import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Save } from 'lucide-react';
import type { AiAttendanceResult } from '@/lib/applyAiResultToAttendance';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  result: AiAttendanceResult & { transcript?: string } | null;
  onApply: (edited: AiAttendanceResult) => void;
}

export function RecordingResultsDialog({ open, onOpenChange, result, onApply }: Props) {
  const [data, setData] = useState<any>(result || {});
  useEffect(() => { setData(result || {}); }, [result]);

  const update = (path: string[], value: any) => {
    setData((prev: any) => {
      const next = { ...prev };
      let ref = next;
      for (let i = 0; i < path.length - 1; i++) {
        ref[path[i]] = { ...(ref[path[i]] || {}) };
        ref = ref[path[i]];
      }
      ref[path[path.length - 1]] = value;
      return next;
    });
  };

  if (!result) return null;

  const hypothesesText = (data.hypotheses || []).map((h: any) => h.cid10 ? `${h.text} (${h.cid10})` : h.text).join('\n');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Resultados da consulta</DialogTitle>
              <DialogDescription>Revise e edite antes de preencher o atendimento.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="summary" className="space-y-3">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="transcript">Transcrição</TabsTrigger>
            <TabsTrigger value="hypotheses">Hipóteses</TabsTrigger>
            <TabsTrigger value="soap">SOAP</TabsTrigger>
            <TabsTrigger value="anamnesis">Anamnese</TabsTrigger>
            <TabsTrigger value="vitals">Sinais Vitais</TabsTrigger>
            <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Resumo</label>
              <Textarea rows={6} value={data.summary || ''} onChange={(e) => update(['summary'], e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Queixa principal</label>
                <Textarea rows={2} value={data.chief_complaint || ''} onChange={(e) => update(['chief_complaint'], e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Diagnóstico</label>
                <Textarea rows={2} value={data.diagnosis || ''} onChange={(e) => update(['diagnosis'], e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">HPI / História da doença atual</label>
              <Textarea rows={4} value={data.history_present_illness || ''} onChange={(e) => update(['history_present_illness'], e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Plano de tratamento</label>
              <Textarea rows={3} value={data.treatment_plan || ''} onChange={(e) => update(['treatment_plan'], e.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="transcript">
            <Textarea rows={18} value={data.transcript || ''} onChange={(e) => update(['transcript'], e.target.value)} />
          </TabsContent>

          <TabsContent value="hypotheses">
            <p className="text-xs text-muted-foreground mb-2">Uma hipótese por linha. Use "(CID)" no final para informar o CID-10.</p>
            <Textarea
              rows={10}
              value={hypothesesText}
              onChange={(e) => {
                const list = e.target.value.split('\n').filter(Boolean).map((line) => {
                  const m = line.match(/^(.*?)\s*\(([A-Z0-9.]+)\)\s*$/);
                  return m ? { text: m[1].trim(), cid10: m[2] } : { text: line.trim() };
                });
                update(['hypotheses'], list);
              }}
            />
          </TabsContent>

          <TabsContent value="soap" className="space-y-3">
            {(['s','o','a','p'] as const).map((k) => (
              <div key={k}>
                <label className="text-xs text-muted-foreground uppercase">{k}</label>
                <Textarea rows={3} value={data.soap?.[k] || ''} onChange={(e) => update(['soap', k], e.target.value)} />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="anamnesis" className="space-y-3">
            {(['allergies','medications','surgeries','family_history','social_history'] as const).map((k) => (
              <div key={k}>
                <label className="text-xs text-muted-foreground capitalize">{k.replace('_',' ')}</label>
                <Textarea rows={2} value={data.anamnesis?.[k] || ''} onChange={(e) => update(['anamnesis', k], e.target.value)} />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="vitals" className="space-y-3">
            <p className="text-xs text-muted-foreground">Apenas valores mencionados em voz alta durante a consulta são extraídos. Edite conforme necessário.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['bp_sys',   'Sistólica (mmHg)'],
                ['bp_dia',   'Diastólica (mmHg)'],
                ['hr',       'FC (bpm)'],
                ['rr',       'FR (rpm)'],
                ['temp',     'Temperatura (°C)'],
                ['spo2',     'SpO₂ (%)'],
                ['weight',   'Peso (kg)'],
                ['height',   'Altura (cm)'],
                ['glycemia', 'Glicemia (mg/dL)'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={data.vital_signs?.[key] || ''}
                    onChange={(e) => update(['vital_signs', key], e.target.value)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="procedures" className="space-y-3">
            <p className="text-xs text-muted-foreground">Procedimentos mencionados durante a consulta. Serão adicionados como entradas manuais — ajuste nome e valor antes de salvar.</p>
            {(!data.procedures_mentioned || data.procedures_mentioned.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum procedimento identificado na gravação.</p>
            ) : (
              <div className="space-y-2">
                {(data.procedures_mentioned as Array<{ name: string; price?: number }>).map((p: { name: string; price?: number }, i: number) => (
                  <div key={i} className="flex gap-2 items-center rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                    <input
                      className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={p.name}
                      onChange={(e) => {
                        const next = [...(data.procedures_mentioned || [])];
                        next[i] = { ...next[i], name: e.target.value };
                        update(['procedures_mentioned'], next);
                      }}
                      placeholder="Nome do procedimento"
                    />
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <input
                        className="flex h-8 w-full rounded-md border border-input bg-transparent pl-7 pr-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.price ?? 0}
                        onChange={(e) => {
                          const next = [...(data.procedures_mentioned || [])];
                          next[i] = { ...next[i], price: parseFloat(e.target.value) || 0 };
                          update(['procedures_mentioned'], next);
                        }}
                        placeholder="0,00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (data.procedures_mentioned || []).filter((_: any, idx: number) => idx !== i);
                        update(['procedures_mentioned'], next);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="Remover"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => { onApply(data); onOpenChange(false); }} className="gap-2">
            <Save className="h-4 w-4" /> Salvar informações no atendimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}