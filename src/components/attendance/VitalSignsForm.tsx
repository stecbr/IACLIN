import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface VitalSigns {
  bp_sys?: string;
  bp_dia?: string;
  hr?: string;
  rr?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
  height?: string;
  glycemia?: string;
}

interface Props {
  value: VitalSigns;
  onChange: (v: VitalSigns) => void;
  readOnly?: boolean;
}

function classifyBmi(bmi: number): { label: string; tone: string } {
  if (bmi < 18.5) return { label: 'Abaixo do peso', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' };
  if (bmi < 25) return { label: 'Peso normal', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' };
  if (bmi < 30) return { label: 'Sobrepeso', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' };
  if (bmi < 35) return { label: 'Obesidade I', tone: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' };
  if (bmi < 40) return { label: 'Obesidade II', tone: 'bg-red-500/15 text-red-700 dark:text-red-300' };
  return { label: 'Obesidade III', tone: 'bg-red-600/20 text-red-700 dark:text-red-300' };
}

// Defined outside VitalSignsForm to avoid recreating on every render (which causes focus loss)
interface FieldProps {
  fieldKey: keyof VitalSigns;
  label: string;
  suffix?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}

function VitalField({ fieldKey: _fieldKey, label, suffix, placeholder, value, onChange, readOnly }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm pr-12"
          disabled={readOnly}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export function VitalSignsForm({ value, onChange, readOnly }: Props) {
  const set = (k: keyof VitalSigns, v: string) => onChange({ ...value, [k]: v });

  const bmi = useMemo(() => {
    const w = parseFloat(value.weight ?? '');
    const h = parseFloat(value.height ?? '');
    if (!w || !h || h <= 0) return null;
    const heightM = h / 100;
    const result = w / (heightM * heightM);
    return isFinite(result) ? result : null;
  }, [value.weight, value.height]);

  const bmiClass = bmi ? classifyBmi(bmi) : null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Sinais vitais e antropometria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Pressão arterial</p>
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <VitalField fieldKey="bp_sys" label="Sistólica" suffix="mmHg" placeholder="120" value={value.bp_sys ?? ''} onChange={(v) => set('bp_sys', v)} readOnly={readOnly} />
            <VitalField fieldKey="bp_dia" label="Diastólica" suffix="mmHg" placeholder="80" value={value.bp_dia ?? ''} onChange={(v) => set('bp_dia', v)} readOnly={readOnly} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Vitais</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <VitalField fieldKey="hr" label="FC" suffix="bpm" placeholder="72" value={value.hr ?? ''} onChange={(v) => set('hr', v)} readOnly={readOnly} />
            <VitalField fieldKey="rr" label="FR" suffix="rpm" placeholder="16" value={value.rr ?? ''} onChange={(v) => set('rr', v)} readOnly={readOnly} />
            <VitalField fieldKey="temp" label="Temp." suffix="°C" placeholder="36.5" value={value.temp ?? ''} onChange={(v) => set('temp', v)} readOnly={readOnly} />
            <VitalField fieldKey="spo2" label="SpO₂" suffix="%" placeholder="98" value={value.spo2 ?? ''} onChange={(v) => set('spo2', v)} readOnly={readOnly} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Antropometria</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <VitalField fieldKey="weight" label="Peso" suffix="kg" placeholder="70" value={value.weight ?? ''} onChange={(v) => set('weight', v)} readOnly={readOnly} />
            <VitalField fieldKey="height" label="Altura" suffix="cm" placeholder="170" value={value.height ?? ''} onChange={(v) => set('height', v)} readOnly={readOnly} />
            <div className="space-y-1">
              <Label className="text-xs">IMC</Label>
              <div className="h-9 px-3 rounded-md border border-border/50 bg-muted/30 flex items-center gap-2">
                {bmi ? (
                  <>
                    <span className="text-sm font-medium">{bmi.toFixed(1)}</span>
                    {bmiClass && <Badge variant="secondary" className={`text-[10px] ${bmiClass.tone} border-0`}>{bmiClass.label}</Badge>}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Outros</p>
          <div className="max-w-[160px]">
            <VitalField fieldKey="glycemia" label="Glicemia capilar" suffix="mg/dL" placeholder="90" value={value.glycemia ?? ''} onChange={(v) => set('glycemia', v)} readOnly={readOnly} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}