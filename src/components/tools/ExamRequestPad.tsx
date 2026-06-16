import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, MessageCircle, User, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fetchClinicForDocs, fetchDentistForDocs, whatsappLink } from '@/lib/clinicalDocsHelpers';
import { generateExamRequestPdf } from '@/lib/generateExamRequestPdf';
import { cn } from '@/lib/utils';

const TEMPLATES: Array<{ id: string; name: string; exams: string[] }> = [
  { id: 'check-up', name: 'Check-up básico', exams: ['Hemograma completo', 'Glicemia de jejum', 'Colesterol total e frações', 'Triglicerídeos', 'TSH', 'Creatinina', 'Ureia', 'TGO / TGP', 'EAS (Urina tipo I)'] },
  { id: 'cardio', name: 'Cardiológico', exams: ['ECG de repouso', 'Ecocardiograma', 'Holter 24h', 'MAPA 24h', 'Hemograma', 'Perfil lipídico'] },
  { id: 'preop', name: 'Pré-operatório', exams: ['Hemograma completo', 'Coagulograma (TP/TTPA)', 'Glicemia de jejum', 'ECG', 'Raio-X de tórax', 'Tipagem sanguínea'] },
  { id: 'pre-natal', name: 'Pré-natal inicial', exams: ['Beta-HCG quantitativo', 'Hemograma', 'Tipagem sanguínea + Rh', 'Glicemia', 'VDRL', 'HIV', 'HBsAg', 'Anti-HCV', 'Toxoplasmose IgG/IgM', 'Urocultura'] },
  { id: 'thyroid', name: 'Tireoide', exams: ['TSH', 'T4 livre', 'Anti-TPO', 'Anti-Tireoglobulina', 'USG de tireoide'] },
  { id: 'imagem-coluna', name: 'Imagem de coluna', exams: ['Raio-X coluna lombossacra (AP e perfil)', 'Ressonância magnética de coluna lombar'] },
];

interface ExamRequestPadProps {
  patientId?: string;
}

export function ExamRequestPad({ patientId: initialPatientId }: ExamRequestPadProps = {}) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [exams, setExams] = useState<string[]>(['']);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);
  const [indication, setIndication] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ['exam-patients', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, cpf')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      return data ?? [];
    },
  });
  const patient = patients.find((p) => p.id === patientId);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) setExams([...t.exams]);
  };

  const updateExam = (i: number, v: string) => setExams((p) => p.map((e, idx) => (idx === i ? v : e)));
  const addExam = () => setExams((p) => [...p, '']);
  const removeExam = (i: number) => setExams((p) => p.filter((_, idx) => idx !== i));

  const validExams = exams.map((e) => e.trim()).filter(Boolean);

  const handleGenerate = async () => {
    if (!patient || validExams.length === 0 || !user) {
      toast.error('Selecione o paciente e adicione ao menos um exame.');
      return;
    }
    setGenerating(true);
    try {
      const [clinic, doctor] = await Promise.all([
        fetchClinicForDocs(currentClinicId),
        fetchDentistForDocs(user.id, currentClinicId),
      ]);
      await generateExamRequestPdf({
        exams: validExams,
        clinicalIndication: indication || undefined,
        patient: { full_name: patient.full_name, cpf: patient.cpf },
        doctor,
        clinic,
      });
      await supabase.from('documents').insert({
        patient_id: patient.id,
        name: `Solicitação de Exames - ${new Date().toLocaleDateString('pt-BR')}`,
        file_url: 'generated://exam-request',
        file_type: 'application/pdf',
        category: 'exam_request',
        uploaded_by: user.id,
      });
      toast.success('Solicitação gerada e registrada no histórico.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar.');
    } finally {
      setGenerating(false);
    }
  };

  const handleWa = () => {
    if (!patient?.phone) return toast.error('Paciente sem telefone.');
    const link = whatsappLink(patient.phone, 'Olá! Segue a solicitação de exames. Qualquer dúvida, estou à disposição.');
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Modelos rápidos</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl.id)}
              className={cn(
                'rounded-xl border p-2.5 text-left transition-all text-sm',
                templateId === tpl.id
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <p className="font-semibold leading-tight">{tpl.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tpl.exams.length} exames</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm"><User className="h-4 w-4" /> Paciente</Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
          <SelectContent>
            {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Exames</Label>
          <Button variant="ghost" size="sm" onClick={addExam} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {exams.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
              <Input value={e} onChange={(ev) => updateExam(i, ev.target.value)} placeholder="Ex: Hemograma completo" />
              {exams.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeExam(i)} className="h-9 w-9 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Indicação clínica (opcional)</Label>
        <Textarea rows={2} value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="Ex: investigação de dispneia aos esforços" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleGenerate} disabled={generating || !patient || validExams.length === 0} className="gap-2">
          <FileDown className="h-4 w-4" />{generating ? 'Gerando...' : 'Gerar PDF'}
        </Button>
        <Button variant="outline" onClick={handleWa} disabled={!patient?.phone} className="gap-2">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
      </div>
    </div>
  );
}
