import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Save } from 'lucide-react';
import { PSI_SCALES, getScale, computeScore, classifyScore, type ScaleId } from '@/lib/psiScales';

interface Props {
  patientId?: string;
  clinicalRecordId?: string | null;
}

export function PsiScales({ patientId: initialPatientId, clinicalRecordId }: Props) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [scaleId, setScaleId] = useState<ScaleId>('phq9');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ['psi-scales-patients'],
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('id, full_name').eq('is_active', true).order('full_name');
      return data ?? [];
    },
    enabled: !initialPatientId,
  });

  const scale = getScale(scaleId)!;
  const answered = Object.keys(answers).length;
  const total = scale.questions.length;
  const complete = answered === total;
  const score = useMemo(() => (complete ? computeScore(scale, answers) : 0), [scale, answers, complete]);
  const classification = complete ? classifyScore(scale, score) : null;

  const handleScaleChange = (id: ScaleId) => {
    setScaleId(id);
    setAnswers({});
  };

  const save = async () => {
    if (!complete) return;
    if (!patientId && !clinicalRecordId) {
      toast.error('Selecione um paciente.');
      return;
    }
    setSaving(true);
    try {
      let recordId = clinicalRecordId;
      // If we don't have a clinical record yet, create a lightweight one to attach the scale
      if (!recordId && patientId) {
        const { data: cr, error: crErr } = await supabase
          .from('clinical_records')
          .insert({
            patient_id: patientId,
            dentist_id: user!.id,
            clinic_id: currentClinicId,
            status: 'completed',
            chief_complaint: `Aplicação de escala ${scale.shortName}`,
            notes: `Escore: ${score} — ${classification!.label}`,
          })
          .select('id')
          .single();
        if (crErr) throw crErr;
        recordId = cr.id;
      }

      await supabase.from('clinical_record_requests').insert({
        clinical_record_id: recordId!,
        kind: 'psi_scale',
        payload: {
          scale: scale.id,
          scale_name: scale.name,
          answers,
          score,
          classification: classification!.label,
          severity: classification!.severity,
          applied_at: new Date().toISOString(),
        },
      });
      toast.success('Escala salva no prontuário.');
      setAnswers({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const isRiskScale = scale.id === 'cssrs';
  const showRiskAlert = isRiskScale && Object.values(answers).some((v) => v > 0);

  return (
    <div className="space-y-4">
      {!initialPatientId && (
        <div className="space-y-1.5">
          <Label className="text-xs">Paciente</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Escala</Label>
        <Select value={scaleId} onValueChange={(v) => handleScaleChange(v as ScaleId)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PSI_SCALES.map((s) => <SelectItem key={s.id} value={s.id}>{s.shortName}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{scale.description}</p>
      </div>

      {showRiskAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção clínica.</strong> Resposta(s) afirmativa(s) detectada(s). Avalie risco e formule plano de segurança imediato.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
        {scale.questions.map((q, idx) => (
          <Card key={q.id} className="border-border/60">
            <CardContent className="p-3 space-y-2">
              <p className="text-sm font-medium leading-snug">
                <span className="text-muted-foreground mr-1">{idx + 1}.</span>{q.text}
              </p>
              <RadioGroup
                value={answers[q.id]?.toString() ?? ''}
                onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: parseInt(v, 10) }))}
                className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
              >
                {scale.options.map((o) => (
                  <label
                    key={o.value}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 cursor-pointer transition-colors text-xs ${
                      answers[q.id] === o.value ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={o.value.toString()} className="h-3 w-3" />
                    <span className="leading-tight">{o.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{answered}/{total} respondidas</span>
        <span className="text-[10px]">{scale.reference}</span>
      </div>

      {complete && classification && (
        <Card style={{ borderColor: classification.color }} className="border-2">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Resultado</p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums" style={{ color: classification.color }}>{score}</span>
              <span className="text-sm font-semibold" style={{ color: classification.color }}>{classification.label}</span>
            </div>
            {classification.recommendation && (
              <p className="text-xs text-muted-foreground pt-1">{classification.recommendation}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Button onClick={save} disabled={!complete || saving} className="w-full gap-2">
        <Save className="h-4 w-4" />
        {saving ? 'Salvando...' : 'Salvar no prontuário'}
      </Button>
    </div>
  );
}
