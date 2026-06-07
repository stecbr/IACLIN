import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToothMap } from '@/components/clinical-map/ToothMap';
import { Plus, Trash2, X } from 'lucide-react';

export interface ToothFinding {
  id?: string;
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
  { value: 'cavity',      label: 'Cárie' },
  { value: 'restoration', label: 'Restauração' },
  { value: 'missing',     label: 'Ausente' },
  { value: 'crown',       label: 'Coroa / Prótese' },
  { value: 'root_canal',  label: 'Canal' },
  { value: 'extraction',  label: 'Extração' },
  { value: 'implant',     label: 'Implante' },
];

const SURFACES = ['M', 'D', 'V', 'L', 'O', 'I'];

const GINGIVA_STATES = [
  { value: 'healthy',  label: 'Saudável' },
  { value: 'mild',     label: 'Gengivite leve' },
  { value: 'moderate', label: 'Gengivite moderada' },
  { value: 'severe',   label: 'Gengivite severa / Periodontite' },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function withId(f: ToothFinding): ToothFinding & { id: string } {
  return { ...f, id: f.id ?? genId() };
}

interface Props {
  value: DentalExam;
  onChange: (next: DentalExam) => void;
}

export function DentalExamForm({ value, onChange }: Props) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [dentition, setDentition] = useState<'permanent' | 'deciduous'>('permanent');

  const teeth = (value.teeth ?? []).map(withId);

  const findingsFor = (tooth: number) => teeth.filter((t) => t.tooth === tooth);

  const addFinding = (tooth: number) => {
    const next = [...teeth, { id: genId(), tooth, condition: 'cavity' }];
    onChange({ ...value, teeth: next });
  };

  const updateFinding = (id: string, patch: Partial<ToothFinding>) => {
    onChange({ ...value, teeth: teeth.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const removeFinding = (id: string) => {
    onChange({ ...value, teeth: teeth.filter((t) => t.id !== id) });
  };

  const handleToothClick = (n: number) => {
    if (selectedTooth === n) {
      setSelectedTooth(null);
      return;
    }
    setSelectedTooth(n);
    if (findingsFor(n).length === 0) {
      // auto-add first finding so the form shows immediately
      const next = [...teeth, { id: genId(), tooth: n, condition: 'cavity' }];
      onChange({ ...value, teeth: next });
    }
  };

  // entries for the ToothMap (one entry per finding = correct count per tooth)
  const entries = teeth.map((t) => ({
    id: t.id!,
    region_code: `tooth-${t.tooth}`,
    condition: t.condition,
  })) as any;

  const toothFindings = selectedTooth ? findingsFor(selectedTooth) : [];

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exame Odontológico</CardTitle>
            <Tabs
              value={dentition}
              onValueChange={(v) => { setDentition(v as 'permanent' | 'deciduous'); setSelectedTooth(null); }}
            >
              <TabsList className="h-7">
                <TabsTrigger value="permanent" className="text-xs h-6 px-3">Permanentes</TabsTrigger>
                <TabsTrigger value="deciduous" className="text-xs h-6 px-3">Decíduos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Toque num dente para registrar achados clínicos. Um dente pode ter múltiplos procedimentos.
          </p>

          <ToothMap
            patientId=""
            entries={entries}
            onRegionClick={(code) => {
              const m = code.match(/^tooth-(\d+)/);
              if (m) handleToothClick(parseInt(m[1], 10));
            }}
            selectedRegion={selectedTooth ? `tooth-${selectedTooth}` : null}
            mode={dentition}
          />

          {/* Tooth panel */}
          {selectedTooth && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Dente {selectedTooth}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => addFinding(selectedTooth)}
                    >
                      <Plus className="h-3 w-3" />
                      Procedimento
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setSelectedTooth(null)}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {toothFindings.map((finding, idx) => (
                    <div
                      key={finding.id}
                      className="p-3 rounded-lg border border-border/50 bg-background space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {toothFindings.length > 1 ? `Procedimento ${idx + 1}` : 'Procedimento'}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removeFinding(finding.id!)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Condição</Label>
                          <Select
                            value={finding.condition}
                            onValueChange={(v) => updateFinding(finding.id!, { condition: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Face</Label>
                          <Select
                            value={finding.surface ?? ''}
                            onValueChange={(v) => updateFinding(finding.id!, { surface: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {SURFACES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Observação</Label>
                        <Input
                          value={finding.notes ?? ''}
                          onChange={(e) => updateFinding(finding.id!, { notes: e.target.value })}
                          placeholder="Detalhes do achado…"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Badge summary */}
          {teeth.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
              {Array.from(new Set(teeth.map((t) => t.tooth)))
                .sort((a, b) => a - b)
                .map((tooth) => {
                  const findings = findingsFor(tooth);
                  return findings.map((f, idx) => {
                    const cond = CONDITIONS.find((c) => c.value === f.condition)?.label ?? f.condition;
                    return (
                      <Badge
                        key={f.id}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => { setSelectedTooth(tooth); setDentition(tooth >= 50 ? 'deciduous' : 'permanent'); }}
                      >
                        {tooth >= 50 && <span className="mr-1 text-[9px] text-muted-foreground">D</span>}
                        Dente {tooth}{findings.length > 1 ? ` #${idx + 1}` : ''} · {cond}
                        {f.surface ? ` (${f.surface})` : ''}
                      </Badge>
                    );
                  });
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
                {GINGIVA_STATES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Índice de Placa (%)</Label>
            <Input
              type="number" min={0} max={100}
              value={value.plaqueIndex ?? ''}
              onChange={(e) => onChange({ ...value, plaqueIndex: e.target.value })}
              className="h-9 text-sm"
              placeholder="Ex: 25"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sangramento à sondagem (%)</Label>
            <Input
              type="number" min={0} max={100}
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
