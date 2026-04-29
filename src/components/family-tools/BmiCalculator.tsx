import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SpecialtyFamily } from '@/lib/specialtyFamily';

interface BmiCalculatorProps {
  family?: SpecialtyFamily;
}

export function BmiCalculator({ family = 'medical' }: BmiCalculatorProps) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');

  const result = useMemo(() => {
    const w = parseFloat(weight.replace(',', '.'));
    const h = parseFloat(height.replace(',', '.')) / 100;
    if (!w || !h) return null;
    const bmi = w / (h * h);
    let label = 'Eutrofia';
    let color = 'text-emerald-600 dark:text-emerald-400';
    if (bmi < 18.5) { label = 'Baixo peso'; color = 'text-amber-600 dark:text-amber-400'; }
    else if (bmi >= 25 && bmi < 30) { label = 'Sobrepeso'; color = 'text-amber-600 dark:text-amber-400'; }
    else if (bmi >= 30 && bmi < 35) { label = 'Obesidade I'; color = 'text-rose-600 dark:text-rose-400'; }
    else if (bmi >= 35 && bmi < 40) { label = 'Obesidade II'; color = 'text-rose-600 dark:text-rose-400'; }
    else if (bmi >= 40) { label = 'Obesidade III'; color = 'text-rose-700 dark:text-rose-500'; }
    return { bmi: bmi.toFixed(1), label, color };
  }, [weight, height]);

  const whr = useMemo(() => {
    const wa = parseFloat(waist.replace(',', '.'));
    const hi = parseFloat(hip.replace(',', '.'));
    if (!wa || !hi) return null;
    return (wa / hi).toFixed(2);
  }, [waist, hip]);

  const showAnthro = family === 'nutrition';

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bmi-w">Peso (kg)</Label>
          <Input id="bmi-w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex: 72" />
        </div>
        <div>
          <Label htmlFor="bmi-h">Altura (cm)</Label>
          <Input id="bmi-h" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Ex: 168" />
        </div>
      </div>

      {showAnthro && (
        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
          <div>
            <Label htmlFor="bmi-waist">Circunferência abdominal (cm)</Label>
            <Input id="bmi-waist" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="Ex: 88" />
          </div>
          <div>
            <Label htmlFor="bmi-hip">Circunferência do quadril (cm)</Label>
            <Input id="bmi-hip" inputMode="decimal" value={hip} onChange={(e) => setHip(e.target.value)} placeholder="Ex: 102" />
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">IMC</p>
          <p className="text-3xl font-semibold">{result.bmi}</p>
          <p className={`text-sm font-medium mt-1 ${result.color}`}>{result.label}</p>
        </div>
      )}

      {showAnthro && whr && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">RCQ (cintura/quadril)</p>
          <p className="text-2xl font-semibold">{whr}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Risco: ♂ &gt; 0,90 · ♀ &gt; 0,85
          </p>
        </div>
      )}
    </div>
  );
}