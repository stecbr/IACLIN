import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

interface Props {
  patientId: string;
  chiefComplaint: string;
  setChiefComplaint: (v: string) => void;
  hpi: string;
  setHpi: (v: string) => void;
  durationValue: string;
  setDurationValue: (v: string) => void;
  durationUnit: string;
  setDurationUnit: (v: string) => void;
  physicalExam: string;
  setPhysicalExam: (v: string) => void;
  readOnly?: boolean;
}

export function AssessmentForm({
  patientId, chiefComplaint, setChiefComplaint, hpi, setHpi,
  durationValue, setDurationValue, durationUnit, setDurationUnit,
  physicalExam, setPhysicalExam, readOnly,
}: Props) {
  const { data: anamnese } = useQuery({
    queryKey: ['anamnese-summary', patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('anamneses')
        .select('allergies, medications, medical_conditions')
        .eq('patient_id', patientId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId,
  });

  const hasAnamnese = anamnese && (anamnese.allergies || anamnese.medications || anamnese.medical_conditions);

  return (
    <div className="space-y-4">
      {hasAnamnese && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-amber-700 dark:text-amber-400">Antecedentes do paciente</p>
              {anamnese.allergies && <p><span className="text-muted-foreground">Alergias:</span> {anamnese.allergies}</p>}
              {anamnese.medications && <p><span className="text-muted-foreground">Medicações em uso:</span> {anamnese.medications}</p>}
              {anamnese.medical_conditions && <p><span className="text-muted-foreground">Condições:</span> {anamnese.medical_conditions}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Queixa principal</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Ex: Dor no dente inferior direito"
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">História da doença atual (HDA)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={hpi}
            onChange={(e) => setHpi(e.target.value)}
            rows={4}
            placeholder="Descrição detalhada do quadro clínico, evolução, fatores associados..."
            className="resize-none"
            disabled={readOnly}
          />
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div className="space-y-1">
              <Label className="text-xs">Duração</Label>
              <Input
                type="number"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                placeholder="Ex: 3"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade</Label>
              <Select value={durationUnit} onValueChange={setDurationUnit} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                  <SelectItem value="weeks">Semanas</SelectItem>
                  <SelectItem value="months">Meses</SelectItem>
                  <SelectItem value="years">Anos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Exame físico / inspeção</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={physicalExam}
            onChange={(e) => setPhysicalExam(e.target.value)}
            rows={4}
            placeholder="Achados ao exame físico, inspeção, palpação..."
            className="resize-none"
            disabled={readOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}