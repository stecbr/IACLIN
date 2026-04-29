import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Syringe } from 'lucide-react';

/**
 * Calculadora de Toxina Botulínica.
 * Doses de referência (faixas femininas/masculinas) para Botox/Dysport.
 * NÃO substitui avaliação clínica — apenas referência rápida no consultório.
 */

interface AreaDose {
  id: string;
  area: string;
  female: [number, number]; // U Botox
  male: [number, number];
  notes?: string;
}

const AREAS: AreaDose[] = [
  { id: 'glabela', area: 'Glabela', female: [16, 24], male: [20, 30], notes: '5 pontos' },
  { id: 'frontal', area: 'Frontal (testa)', female: [6, 12], male: [10, 16], notes: '4–6 pontos' },
  { id: 'periorbital', area: 'Pés-de-galinha', female: [10, 24], male: [14, 30], notes: '8–12 U por lado' },
  { id: 'bunny', area: 'Bunny lines (nariz)', female: [4, 8], male: [4, 10] },
  { id: 'labio-superior', area: 'Lábio superior', female: [2, 4], male: [2, 4], notes: 'Cuidado com competência labial' },
  { id: 'doe', area: 'Sorriso gengival', female: [4, 6], male: [4, 6] },
  { id: 'mento', area: 'Mento (queixo)', female: [4, 10], male: [6, 12] },
  { id: 'masseter', area: 'Masseter', female: [20, 30], male: [25, 40], notes: 'Por lado' },
  { id: 'platisma', area: 'Platisma (pescoço)', female: [20, 60], male: [30, 80] },
  { id: 'axilar', area: 'Hiperidrose axilar', female: [50, 100], male: [50, 100], notes: 'Por axila' },
];

export function BotoxCalculator() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [pricePerUnit, setPricePerUnit] = useState('15');

  const totals = useMemo(() => {
    let min = 0;
    let max = 0;
    AREAS.forEach((a) => {
      if (!selected[a.id]) return;
      const range = gender === 'female' ? a.female : a.male;
      min += range[0];
      max += range[1];
    });
    const price = parseFloat(pricePerUnit) || 0;
    return { min, max, priceMin: min * price, priceMax: max * price };
  }, [selected, gender, pricePerUnit]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
        <Syringe className="h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground">
          Doses em <strong>unidades de Botox®</strong> (Allergan). Para Dysport®, multiplique por 2,5–3.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Paciente</Label>
          <div className="flex gap-1 rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${gender === 'female' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >Feminino</button>
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${gender === 'male' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >Masculino</button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ppu" className="text-xs">R$ por unidade</Label>
          <Input
            id="ppu"
            type="number"
            min="0"
            step="0.01"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {AREAS.map((a) => {
          const range = gender === 'female' ? a.female : a.male;
          const active = !!selected[a.id];
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [a.id]: !s[a.id] }))}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all ${active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.area}</p>
                {a.notes && <p className="text-[10px] text-muted-foreground truncate">{a.notes}</p>}
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {range[0]}–{range[1]} U
              </Badge>
            </button>
          );
        })}
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Dose total estimada</p>
              <p className="text-2xl font-semibold text-foreground">
                {totals.min}–{totals.max} <span className="text-sm text-muted-foreground">U</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor estimado</p>
              <p className="text-lg font-semibold text-primary">
                R$ {totals.priceMin.toFixed(0)}–{totals.priceMax.toFixed(0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}