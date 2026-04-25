import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TUBETE_ML, ANTICOAGULANTS, ASA_CLASSES, EVA_SCALE, mlToTubetes, tubetesToMl } from '@/lib/clinicalReferenceData';

export function QuickReference() {
  const [ml, setMl] = useState('');
  const [tub, setTub] = useState('');

  const handleMl = (v: string) => {
    setMl(v);
    const n = parseFloat(v.replace(',', '.'));
    setTub(isNaN(n) ? '' : mlToTubetes(n).toFixed(2));
  };
  const handleTub = (v: string) => {
    setTub(v);
    const n = parseFloat(v.replace(',', '.'));
    setMl(isNaN(n) ? '' : tubetesToMl(n).toFixed(2));
  };

  const riskColor = { low: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', mid: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', high: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' };

  return (
    <Tabs defaultValue="converter">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="converter">Conversor</TabsTrigger>
        <TabsTrigger value="anticoag">Anticoag.</TabsTrigger>
        <TabsTrigger value="asa">ASA</TabsTrigger>
        <TabsTrigger value="eva">EVA</TabsTrigger>
      </TabsList>

      <TabsContent value="converter" className="space-y-4 pt-4">
        <p className="text-xs text-muted-foreground">1 tubete = {TUBETE_ML} mL</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm">Mililitros (mL)</Label>
            <Input type="number" inputMode="decimal" value={ml} onChange={(e) => handleMl(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Tubetes</Label>
            <Input type="number" inputMode="decimal" value={tub} onChange={(e) => handleTub(e.target.value)} placeholder="0" />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="anticoag" className="space-y-2 pt-4">
        {ANTICOAGULANTS.map((a) => (
          <Card key={a.name} className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{a.name}</p>
                <Badge variant="outline" className="text-[10px]">{a.hemostasisTime}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="asa" className="space-y-2 pt-4">
        {ASA_CLASSES.map((c) => (
          <Card key={c.code} className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Badge className={riskColor[c.riskColor]}>{c.code}</Badge>
                <p className="font-semibold text-sm">{c.description}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.example}</p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="eva" className="space-y-3 pt-4">
        <p className="text-sm text-muted-foreground">Escala visual de dor — mostre ao paciente.</p>
        <div className="space-y-1.5">
          {EVA_SCALE.map((l) => (
            <div key={l.value} className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: `${l.color}20` }}>
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: l.color }}>
                {l.value}
              </div>
              <div>
                <p className="font-semibold text-sm">{l.label}</p>
                <p className="text-xs text-muted-foreground">{l.description}</p>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}