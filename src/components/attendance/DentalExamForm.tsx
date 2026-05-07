import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToothMap } from '@/components/clinical-map/ToothMap';
import { Trash2 } from 'lucide-react';

export interface ToothFinding {
  tooth: number;
  condition: string;
  surface?: string;
  notes?: string;
}

export interface DentalExam {
  teeth: ToothFinding[];
  gingiva?: string;
  plaqueIndex?: string;
  bleedingIndex?: string;
}

const CONDITIONS = [
  { value: 'cavity', label: 'Cárie' },
  { value: 'restoration', label: 'Restauração' },
  { value: 'missing', label: 'Ausente' },
  { value: 'crown', label: 'Coroa / Prótese' },
  { value: 'root_canal', label: 'Canal' },
  { value: 'extraction', label: 'Extração' },
  { value: 'implant', label: 'Implante' },
];

const SURFACES = ['M', 'D', 'V', 'L', 'O', 'I'];

const GINGIVA_STATES = [
  { value: 'healthy', label: 'Saudável' },
  { value: 'mild', label: 'Gengivite leve' },
  { value: 'moderate', label: 'Gengivite moderada' },
  { value: 'severe', label: 'Gengivite severa / Periodontite' },
];

interface Props {
  value: DentalExam;
  onChange: (next: DentalExam) => void;
}

export function DentalExamForm({ value, onChange }: Props) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const teeth = value.teeth ?? [];

  const upsertTooth = (tooth: number, patch: Partial<ToothFinding>) => {
    const existing = teeth.find((t) => t.tooth === tooth);
    let next: ToothFinding[];
    if (existing) {
      next = teeth.map((t) => (t.tooth === tooth ? { ...t, ...patch } : t));
    } else {
      next = [...teeth, { tooth, condition: patch.condition ?? 'cavity', ...patch }];
    }
    onChange({ ...value, teeth: next });
  };

  const removeTooth = (tooth: number) => {
    onChange({ ...value, teeth: teeth.filter((t) => t.tooth !== tooth) });
    setSelectedTooth(null);
  };

  // Build entries para o ToothMap (ele espera region_code + condition)
  const entries = teeth.map((t) => ({
    id: String(t.tooth),
    region_code: `tooth-${t.tooth}`,
    condition: t.condition,
  })) as any;

  const current = selectedTooth ? teeth.find((t) => t.tooth === selectedTooth) : null;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Exame Odontológico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Toque num dente para registrar achados clínicos. Cada dente aceita condição, face e observação.
          </p>
          <ToothMap
            patientId=""
            entries={entries}
            onRegionClick={(code) => {
              const m = code.match(/^tooth-(\d+)/);
              if (m) setSelectedTooth(parseInt(m[1], 10));
            }}
            selectedRegion={selectedTooth ? `tooth-${selectedTooth}` : null}
          />

          {selectedTooth && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Dente {selectedTooth}</p>
                  {current && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeTooth(selectedTooth)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Condição</Label>
                    <Select
                      value={current?.condition ?? ''}
                      onValueChange={(v) => upsertTooth(selectedTooth, { condition: v })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Face</Label>
                    <Select
                      value={current?.surface ?? ''}
                      onValueChange={(v) => upsertTooth(selectedTooth, { surface: v })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {SURFACES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observação</Label>
                  <Input
                    value={current?.notes ?? ''}
                    onChange={(e) => upsertTooth(selectedTooth, { notes: e.target.value })}
                    placeholder="Detalhes do achado…"
                    className="h-9 text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {teeth.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
              {teeth.map((t) => {
                const cond = CONDITIONS.find((c) => c.value === t.condition)?.label ?? t.condition;
                return (
                  <Badge key={t.tooth} variant="secondary" className="cursor-pointer" onClick={() => setSelectedTooth(t.tooth)}>
                    Dente {t.tooth} · {cond}{t.surface ? ` (${t.surface})` : ''}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avaliação Periodontal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Estado da gengiva</Label>
            <Select value={value.gingiva ?? ''} onValueChange={(v) => onChange({ ...value, gingiva: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {GINGIVA_STATES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Índice de Placa (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={value.plaqueIndex ?? ''}
              onChange={(e) => onChange({ ...value, plaqueIndex: e.target.value })}
              className="h-9 text-sm"
              placeholder="Ex: 25"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sangramento à sondagem (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={value.bleedingIndex ?? ''}
              onChange={(e) => onChange({ ...value, bleedingIndex: e.target.value })}
              className="h-9 text-sm"
              placeholder="Ex: 10"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}