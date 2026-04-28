import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

interface Props { patientId?: string; clinicalRecordId?: string | null }

const RISK_LEVELS = [
  { value: 'none', label: 'Sem risco identificado' },
  { value: 'low', label: 'Baixo' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'high', label: 'Alto — plano de segurança ativado' },
];

export function SoapNote({ patientId: initialPatientId, clinicalRecordId }: Props) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [s, setS] = useState('');
  const [o, setO] = useState('');
  const [a, setA] = useState('');
  const [p, setP] = useState('');
  const [homework, setHomework] = useState('');
  const [risk, setRisk] = useState('none');
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ['soap-patients'],
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('id, full_name').eq('is_active', true).order('full_name');
      return data ?? [];
    },
    enabled: !initialPatientId && !clinicalRecordId,
  });

  const save = async () => {
    if (!patientId && !clinicalRecordId) {
      toast.error('Selecione um paciente.');
      return;
    }
    setSaving(true);
    try {
      const noteText = [
        `S (Subjetivo): ${s || '—'}`,
        `O (Objetivo): ${o || '—'}`,
        `A (Avaliação): ${a || '—'}`,
        `P (Plano): ${p || '—'}`,
        homework ? `Tarefa de casa: ${homework}` : null,
        `Risco: ${RISK_LEVELS.find((r) => r.value === risk)?.label}`,
      ].filter(Boolean).join('\n\n');

      if (clinicalRecordId) {
        const { data: existing } = await supabase.from('clinical_records').select('notes').eq('id', clinicalRecordId).maybeSingle();
        const newNotes = [existing?.notes, noteText].filter(Boolean).join('\n\n---\n\n');
        await supabase.from('clinical_records').update({ notes: newNotes }).eq('id', clinicalRecordId);
      } else {
        await supabase.from('clinical_records').insert({
          patient_id: patientId,
          dentist_id: user!.id,
          clinic_id: currentClinicId,
          status: 'completed',
          chief_complaint: 'Sessão psicoterapêutica',
          notes: noteText,
        });
      }
      toast.success('Evolução SOAP salva.');
      setS(''); setO(''); setA(''); setP(''); setHomework(''); setRisk('none');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!initialPatientId && !clinicalRecordId && (
        <div className="space-y-1.5">
          <Label className="text-xs">Paciente</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {patients.map((pt) => <SelectItem key={pt.id} value={pt.id}>{pt.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs"><strong>S</strong> — Subjetivo (queixa, relato)</Label>
        <Textarea rows={3} value={s} onChange={(e) => setS(e.target.value)} placeholder="O que o paciente trouxe..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs"><strong>O</strong> — Objetivo (observações, comportamento)</Label>
        <Textarea rows={3} value={o} onChange={(e) => setO(e.target.value)} placeholder="Postura, afeto, fala, choro..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs"><strong>A</strong> — Avaliação (impressão clínica)</Label>
        <Textarea rows={3} value={a} onChange={(e) => setA(e.target.value)} placeholder="Hipótese, formulação, evolução..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs"><strong>P</strong> — Plano (próximos passos)</Label>
        <Textarea rows={3} value={p} onChange={(e) => setP(e.target.value)} placeholder="Intervenção planejada para próxima sessão..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tarefa de casa</Label>
        <Textarea rows={2} value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="Ex: registro de pensamentos, exposição gradual..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Avaliação de risco</Label>
        <Select value={risk} onValueChange={setRisk}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={save} disabled={saving} className="w-full gap-2">
        <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar evolução'}
      </Button>
    </div>
  );
}
