import { useMemo, useState } from 'react';
import { Heart, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Field {
  key: keyof Vitals;
  label: string;
  unit: string;
  placeholder: string;
  step?: string;
}

interface Vitals {
  weight: string;
  height: string;
  bpSystolic: string;
  bpDiastolic: string;
  hr: string;
  rr: string;
  spo2: string;
  temp: string;
}

const EMPTY: Vitals = {
  weight: '', height: '', bpSystolic: '', bpDiastolic: '', hr: '', rr: '', spo2: '', temp: '',
};

const FIELDS: Field[] = [
  { key: 'weight', label: 'Peso', unit: 'kg', placeholder: '70', step: '0.1' },
  { key: 'height', label: 'Altura', unit: 'cm', placeholder: '170' },
  { key: 'bpSystolic', label: 'PA Sist.', unit: 'mmHg', placeholder: '120' },
  { key: 'bpDiastolic', label: 'PA Diast.', unit: 'mmHg', placeholder: '80' },
  { key: 'hr', label: 'FC', unit: 'bpm', placeholder: '72' },
  { key: 'rr', label: 'FR', unit: 'irpm', placeholder: '16' },
  { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98' },
  { key: 'temp', label: 'Temp.', unit: '°C', placeholder: '36.5', step: '0.1' },
];

function bmiClassification(bmi: number): { label: string; tone: string } {
  if (bmi < 18.5) return { label: 'Abaixo do peso', tone: 'text-amber-600 dark:text-amber-400' };
  if (bmi < 25) return { label: 'Peso normal', tone: 'text-emerald-600 dark:text-emerald-400' };
  if (bmi < 30) return { label: 'Sobrepeso', tone: 'text-amber-600 dark:text-amber-400' };
  if (bmi < 35) return { label: 'Obesidade I', tone: 'text-rose-600 dark:text-rose-400' };
  if (bmi < 40) return { label: 'Obesidade II', tone: 'text-rose-600 dark:text-rose-400' };
  return { label: 'Obesidade III', tone: 'text-rose-700 dark:text-rose-400' };
}

function bpClassification(s: number, d: number): { label: string; tone: string } {
  if (s >= 180 || d >= 110) return { label: 'Crise hipertensiva', tone: 'text-rose-700 dark:text-rose-400' };
  if (s >= 140 || d >= 90) return { label: 'Hipertensão', tone: 'text-rose-600 dark:text-rose-400' };
  if (s >= 130 || d >= 85) return { label: 'Pré-hipertensão', tone: 'text-amber-600 dark:text-amber-400' };
  if (s >= 90 && d >= 60) return { label: 'Normal', tone: 'text-emerald-600 dark:text-emerald-400' };
  return { label: 'Hipotensão', tone: 'text-amber-600 dark:text-amber-400' };
}

export function VitalSignsQuick() {
  const [v, setV] = useState<Vitals>(EMPTY);

  const set = (k: keyof Vitals, val: string) => setV((p) => ({ ...p, [k]: val }));

  const bmi = useMemo(() => {
    const w = parseFloat(v.weight);
    const h = parseFloat(v.height) / 100;
    if (!w || !h) return null;
    return w / (h * h);
  }, [v.weight, v.height]);

  const bp = useMemo(() => {
    const s = parseInt(v.bpSystolic, 10);
    const d = parseInt(v.bpDiastolic, 10);
    if (!s || !d) return null;
    return bpClassification(s, d);
  }, [v.bpSystolic, v.bpDiastolic]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</Label>
            <div className="relative">
              <Input
                type="number"
                step={f.step}
                value={v[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="pr-10 text-sm"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">IMC</p>
              {bmi ? (
                <>
                  <p className="text-xl font-bold leading-tight">{bmi.toFixed(1)}</p>
                  <p className={cn('text-xs font-medium', bmiClassification(bmi).tone)}>
                    {bmiClassification(bmi).label}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Informe peso e altura</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pressão Arterial</p>
              {bp ? (
                <>
                  <p className="text-xl font-bold leading-tight">{v.bpSystolic}/{v.bpDiastolic} <span className="text-xs font-normal text-muted-foreground">mmHg</span></p>
                  <p className={cn('text-xs font-medium', bp.tone)}>{bp.label}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Informe PA sistólica e diastólica</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cálculo rápido para conferência. Para registrar no prontuário, use a aba "Sinais Vitais" do atendimento.
      </p>
    </div>
  );
}
