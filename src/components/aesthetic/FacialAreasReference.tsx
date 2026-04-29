import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Row { area: string; product: string; volume: string; technique?: string }

const FILLER_ROWS: Row[] = [
  { area: 'Lábios', product: 'AH média densidade', volume: '0,5–1,0 mL', technique: 'Linear retrógrada / pontos' },
  { area: 'Sulco nasogeniano', product: 'AH média', volume: '0,5–1,0 mL por lado', technique: 'Subcutâneo profundo' },
  { area: 'Olheiras (vale lacrimal)', product: 'AH baixa hidrofilia', volume: '0,3–0,5 mL por lado', technique: 'Supraperiosteal, cânula' },
  { area: 'Malar / zigoma', product: 'AH alta G\'', volume: '0,5–1,0 mL por lado', technique: 'Bolus supraperiosteal' },
  { area: 'Mandíbula / gonion', product: 'AH alta G\'', volume: '1,0–2,0 mL por lado', technique: 'Bolus + cânula' },
  { area: 'Mento (queixo)', product: 'AH alta G\'', volume: '0,5–1,5 mL', technique: 'Bolus supraperiosteal' },
  { area: 'Linhas de marionete', product: 'AH média', volume: '0,3–0,5 mL por lado' },
  { area: 'Têmporas', product: 'AH alta G\' / Bioestim.', volume: '0,5–1,0 mL por lado', technique: 'Supraperiosteal, agulha' },
];

const PEEL_ROWS: Row[] = [
  { area: 'Superficial — manchas leves', product: 'Ácido glicólico 30–50%', volume: 'Tempo: 2–5 min' },
  { area: 'Médio — fotoenvelhecimento', product: 'Ácido tricloroacético 15–25%', volume: 'Tempo: até frosting nível I' },
  { area: 'Médio — melasma', product: 'Solução de Jessner', volume: '2–3 camadas' },
  { area: 'Profundo (especialista)', product: 'TCA 35% / Fenol', volume: 'Sob acompanhamento' },
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Área / Indicação</th>
            <th className="text-left px-3 py-2 font-medium">Produto</th>
            <th className="text-left px-3 py-2 font-medium">Volume / Tempo</th>
            <th className="text-left px-3 py-2 font-medium">Técnica</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              <td className="px-3 py-2 font-medium text-foreground">{r.area}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.product}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.volume}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.technique ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FacialAreasReference() {
  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Tabelas de referência rápida. <strong>Não substituem</strong> avaliação individual e protocolo do profissional.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="filler">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="filler">Preenchedor (AH)</TabsTrigger>
          <TabsTrigger value="peel">Peelings</TabsTrigger>
        </TabsList>
        <TabsContent value="filler" className="mt-3">
          <Table rows={FILLER_ROWS} />
        </TabsContent>
        <TabsContent value="peel" className="mt-3">
          <Table rows={PEEL_ROWS} />
        </TabsContent>
      </Tabs>
    </div>
  );
}