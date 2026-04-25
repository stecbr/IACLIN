import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Syringe, User, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ANESTHETICS,
  calculateMaxDose,
  detectAnestheticAllergy,
  TUBETE_ML,
} from '@/lib/anestheticDoses';

interface HistoryItem {
  patientName?: string;
  weightKg: number;
  anestheticId: string;
  anestheticName: string;
  maxTubetes: number;
  at: number;
}

const HISTORY_KEY = 'iaclin.anesthetic.history';

function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 5)));
}

export function AnestheticCalculator() {
  const { currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [anestheticId, setAnestheticId] = useState<string>(ANESTHETICS[0].id);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());

  const { data: patients = [] } = useQuery({
    queryKey: ['anesthetic-patients', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('clinic_id', currentClinicId)
        .eq('is_active', true)
        .order('full_name')
        .limit(200);
      return data ?? [];
    },
    enabled: !!currentClinicId,
  });

  const { data: anamnese } = useQuery({
    queryKey: ['anesthetic-anamnese', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await supabase
        .from('anamneses')
        .select('allergies, medical_conditions, notes')
        .eq('patient_id', patientId)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId,
  });

  const allergyMatches = useMemo(
    () => detectAnestheticAllergy(anamnese?.allergies),
    [anamnese?.allergies],
  );

  const weightKg = parseFloat(weight.replace(',', '.'));
  const result = useMemo(
    () => (weightKg > 0 ? calculateMaxDose(anestheticId, weightKg) : null),
    [anestheticId, weightKg],
  );

  // Persist on result change (avoid spamming on each keystroke — only when valid)
  useEffect(() => {
    if (!result) return;
    const patient = patients.find((p) => p.id === patientId);
    const item: HistoryItem = {
      patientName: patient?.full_name,
      weightKg: result.weightKg,
      anestheticId: result.anesthetic.id,
      anestheticName: result.anesthetic.name,
      maxTubetes: result.maxTubetes,
      at: Date.now(),
    };
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => !(h.anestheticId === item.anestheticId && h.weightKg === item.weightKg && h.patientName === item.patientName))].slice(0, 5);
      saveHistory(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.anesthetic.id, result?.weightKg]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" /> Paciente (opcional)
          </Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione para checar alergias" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Weight className="h-4 w-4" /> Peso (kg)
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="ex: 70"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min={1}
            step={0.5}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Syringe className="h-4 w-4" /> Anestésico
        </Label>
        <Select value={anestheticId} onValueChange={setAnestheticId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANESTHETICS.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {allergyMatches.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alerta de alergia</AlertTitle>
          <AlertDescription>
            A anamnese deste paciente menciona: <strong>{allergyMatches.join(', ')}</strong>. Confirme antes de aplicar.
          </AlertDescription>
        </Alert>
      )}

      {result ? (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Dose máxima segura</p>
              <p className="text-4xl font-bold text-primary mt-1">
                Até {result.maxTubetes} tubete{result.maxTubetes === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ({TUBETE_ML} mL por tubete · {result.maxMl.toFixed(2)} mL totais · {result.effectiveMaxMg.toFixed(0)} mg)
              </p>
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
              <div className="flex justify-between">
                <span>Limite por peso ({result.anesthetic.maxMgPerKg} mg/kg × {result.weightKg} kg)</span>
                <span className="font-mono">{result.maxMgByWeight.toFixed(0)} mg</span>
              </div>
              <div className="flex justify-between">
                <span>Máximo absoluto</span>
                <span className="font-mono">{result.anesthetic.absoluteMaxMg} mg</span>
              </div>
              <div className="flex justify-between font-medium text-foreground">
                <span>Limitado por</span>
                <span>{result.limitedBy === 'weight' ? 'peso' : 'dose absoluta'}</span>
              </div>
            </div>
            {result.anesthetic.notes && (
              <p className="text-xs italic text-muted-foreground">{result.anesthetic.notes}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Informe o peso do paciente para calcular.
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Últimos cálculos</p>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setWeight(String(h.weightKg));
                  setAnestheticId(h.anestheticId);
                }}
                className="w-full flex items-center justify-between text-left text-xs px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
              >
                <span className="truncate">
                  {h.patientName ? `${h.patientName} · ` : ''}
                  {h.weightKg}kg · {h.anestheticName}
                </span>
                <span className="font-medium text-primary flex-shrink-0 ml-3">{h.maxTubetes} tub.</span>
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setHistory([]);
              saveHistory([]);
            }}
          >
            Limpar histórico
          </Button>
        </div>
      )}
    </div>
  );
}