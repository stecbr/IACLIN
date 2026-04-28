import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DSM_REFERENCE, EMOTIONAL_EVA } from '@/lib/psiReferenceData';
import { PSI_SCALES } from '@/lib/psiScales';

export function PsiReference() {
  const [tab, setTab] = useState('dsm');

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-3">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="dsm" className="text-xs">DSM-5</TabsTrigger>
        <TabsTrigger value="eva" className="text-xs">EVA Emocional</TabsTrigger>
        <TabsTrigger value="cuts" className="text-xs">Pontos de corte</TabsTrigger>
      </TabsList>

      <TabsContent value="dsm">
        <Accordion type="single" collapsible className="space-y-2">
          {DSM_REFERENCE.map((d) => (
            <AccordionItem key={d.code} value={d.code} className="border border-border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-left">
                  <Badge variant="outline" className="text-[10px] font-mono">{d.code}</Badge>
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-xs">
                <p className="text-muted-foreground">{d.summary}</p>
                <p><strong>Duração:</strong> {d.duration}</p>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  {d.criteria.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-[10px] text-muted-foreground mt-3 italic">
          Resumo de referência. Sempre consultar o DSM-5-TR para diagnóstico formal.
        </p>
      </TabsContent>

      <TabsContent value="eva">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Escala Visual Analógica de sofrimento emocional (0–10)</p>
            <div className="space-y-2">
              {EMOTIONAL_EVA.map((e) => (
                <div key={e.value} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold tabular-nums" style={{ backgroundColor: e.color }}>
                    {e.value}
                  </div>
                  <span className="text-sm font-medium">{e.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cuts">
        <div className="space-y-2">
          {PSI_SCALES.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-semibold">{s.shortName}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {s.classifications.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="font-mono text-muted-foreground">{c.min}-{c.max}</span>
                      <span className="font-medium truncate">{c.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
