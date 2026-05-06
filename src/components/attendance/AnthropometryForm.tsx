import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMemo } from 'react';

export interface Anthropometry {
  weight?: string;       // kg
  height?: string;       // cm
  body_fat?: string;     // %
  waist?: string;        // cm
  hip?: string;          // cm
  arm?: string;          // cm
  thigh?: string;        // cm
}

interface Props {
  value: Anthropometry;
  onChange: (next: Anthropometry) => void;
}

/** Antropometria para nutrição. Calcula IMC automaticamente. */
export function AnthropometryForm({ value, onChange }: Props) {
  const set = (k: keyof Anthropometry) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  const bmi = useMemo(() => {
    const w = parseFloat((value.weight ?? '').replace(',', '.'));
    const h = parseFloat((value.height ?? '').replace(',', '.'));
    if (!w || !h || h <= 0) return null;
    return (w / Math.pow(h / 100, 2)).toFixed(1);
  }, [value.weight, value.height]);

  const bmiLabel = useMemo(() => {
    if (!bmi) return null;
    const n = parseFloat(bmi);
    if (n < 18.5) return { label: 'Abaixo do peso', color: 'text-blue-500' };
    if (n < 25) return { label: 'Peso normal', color: 'text-success' };
    if (n < 30) return { label: 'Sobrepeso', color: 'text-warning' };
    return { label: 'Obesidade', color: 'text-destructive' };
  }, [bmi]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Antropometria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Peso (kg)</Label>
            <Input value={value.weight ?? ''} onChange={set('weight')} placeholder="70" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Altura (cm)</Label>
            <Input value={value.height ?? ''} onChange={set('height')} placeholder="170" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">% Gordura</Label>
            <Input value={value.body_fat ?? ''} onChange={set('body_fat')} placeholder="22" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">IMC</Label>
            <div className="h-9 flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3">
              <span className="text-sm font-semibold tabular-nums">{bmi ?? '—'}</span>
              {bmiLabel && <span className={`text-[10px] ${bmiLabel.color}`}>{bmiLabel.label}</span>}
            </div>
          </div>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Cintura (cm)</Label>
            <Input value={value.waist ?? ''} onChange={set('waist')} placeholder="80" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quadril (cm)</Label>
            <Input value={value.hip ?? ''} onChange={set('hip')} placeholder="95" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Braço (cm)</Label>
            <Input value={value.arm ?? ''} onChange={set('arm')} placeholder="30" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Coxa (cm)</Label>
            <Input value={value.thigh ?? ''} onChange={set('thigh')} placeholder="55" inputMode="decimal" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}