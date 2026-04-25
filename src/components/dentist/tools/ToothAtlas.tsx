import { useState } from 'react';
import { ToothMap } from '@/components/clinical-map/ToothMap';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToothInfo, getToothLabel } from '@/lib/toothAtlasData';

export function ToothAtlas() {
  const [selected, setSelected] = useState<string | null>(null);
  const num = selected ? parseInt(selected.replace('tooth-', ''), 10) : null;
  const info = num ? getToothInfo(num) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Toque num dente para ver anatomia e procedimentos comuns.
      </p>
      <ToothMap
        entries={[]}
        onRegionClick={setSelected}
        selectedRegion={selected ?? undefined}
      />
      {info && num && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Dente</p>
              <p className="text-2xl font-bold">{num} — {getToothLabel(num)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Raízes</p>
                <p className="font-semibold">{info.roots}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Canais</p>
                <p className="font-semibold">{info.canals}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Procedimentos comuns</p>
              <div className="flex flex-wrap gap-1.5">
                {info.commonProcedures.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}