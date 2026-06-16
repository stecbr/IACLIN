import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fetchClinicForDocs, fetchDentistForDocs, whatsappLink } from '@/lib/clinicalDocsHelpers';
import { generateReferralPdf } from '@/lib/generateReferralPdf';

const URGENCY: Array<{ value: 'rotina' | 'prioritario' | 'emergencia'; label: string }> = [
  { value: 'rotina', label: 'Rotina' },
  { value: 'prioritario', label: 'Prioritário' },
  { value: 'emergencia', label: 'Emergência' },
];

interface ReferralLetterPadProps {
  patientId?: string;
}

export function ReferralLetterPad({ patientId: initialPatientId }: ReferralLetterPadProps = {}) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [toSpecialty, setToSpecialty] = useState('');

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [urgency, setUrgency] = useState<'rotina' | 'prioritario' | 'emergencia'>('rotina');
  const [generating, setGenerating] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ['referral-patients', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('patients').select('id, full_name, phone, cpf')
        .eq('clinic_id', currentClinicId!).eq('is_active', true)
        .order('full_name').limit(500);
      return data ?? [];
    },
  });
  const patient = patients.find((p) => p.id === patientId);

  const handleGenerate = async () => {
    if (!patient || !toSpecialty.trim() || !reason.trim() || !user) {
      toast.error('Preencha paciente, especialidade de destino e motivo.');
      return;
    }
    setGenerating(true);
    try {
      const [clinic, doctor] = await Promise.all([
        fetchClinicForDocs(currentClinicId),
        fetchDentistForDocs(user.id, currentClinicId),
      ]);
      await generateReferralPdf({
        toSpecialty: toSpecialty.trim(),
        reason: reason.trim(),
        summary: summary.trim() || undefined,
        urgency,
        patient: { full_name: patient.full_name, cpf: patient.cpf },
        doctor,
        clinic,
      });
      await supabase.from('documents').insert({
        patient_id: patient.id,
        name: `Encaminhamento (${toSpecialty.trim()}) - ${new Date().toLocaleDateString('pt-BR')}`,
        file_url: 'generated://referral',
        file_type: 'application/pdf',
        category: 'referral',
        uploaded_by: user.id,
      });
      toast.success('Encaminhamento gerado e registrado no histórico.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar.');
    } finally {
      setGenerating(false);
    }
  };

  const handleWa = () => {
    if (!patient?.phone) return toast.error('Paciente sem telefone.');
    const link = whatsappLink(patient.phone, `Olá! Segue o encaminhamento para ${toSpecialty}.`);
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm"><User className="h-4 w-4" /> Paciente</Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
          <SelectContent>
            {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Encaminhar para (especialidade)</Label>
          <Input value={toSpecialty} onChange={(e) => setToSpecialty(e.target.value)} placeholder="Ex: Cardiologia, Endocrinologia..." />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Urgência</Label>
          <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {URGENCY.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Motivo do encaminhamento</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: avaliação de dor torácica recorrente" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Resumo clínico (opcional)</Label>
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Histórico, exames realizados, medicações em uso..." />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleGenerate} disabled={generating || !patient || !toSpecialty.trim() || !reason.trim()} className="gap-2">
          <FileDown className="h-4 w-4" />{generating ? 'Gerando...' : 'Gerar PDF'}
        </Button>
        <Button variant="outline" onClick={handleWa} disabled={!patient?.phone} className="gap-2">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
      </div>
    </div>
  );
}
