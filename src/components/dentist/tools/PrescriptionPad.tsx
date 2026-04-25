import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, FileDown, MessageCircle, Pill, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  DEFAULT_PRESCRIPTION_TEMPLATES,
  findTemplate,
  type PrescriptionItem,
} from '@/lib/prescriptionTemplates';
import { generatePrescriptionPdf } from '@/lib/generatePrescriptionPdf';
import {
  fetchClinicForDocs,
  fetchDentistForDocs,
  whatsappLink,
} from '@/lib/clinicalDocsHelpers';
import { cn } from '@/lib/utils';

interface PrescriptionPadProps {
  patientId?: string;
}

const EMPTY_ITEM: PrescriptionItem = {
  medication: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
};

export function PrescriptionPad({ patientId: initialPatientId }: PrescriptionPadProps = {}) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState<string>(initialPatientId ?? '');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

  const { data: patients = [] } = useQuery({
    queryKey: ['rx-patients', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, cpf')
        .eq('clinic_id', currentClinicId)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      return data ?? [];
    },
    enabled: !!currentClinicId,
  });

  const patient = patients.find((p) => p.id === patientId);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = findTemplate(id);
    if (tpl) setItems(tpl.items.map((i) => ({ ...i })));
  };

  const updateItem = (idx: number, field: keyof PrescriptionItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const validItems = items.filter((it) => it.medication.trim());

  const handleGenerate = async () => {
    if (!patient || validItems.length === 0 || !user) {
      toast.error('Selecione o paciente e adicione ao menos um medicamento.');
      return;
    }
    setGenerating(true);
    try {
      const [clinic, dentist] = await Promise.all([
        fetchClinicForDocs(currentClinicId),
        fetchDentistForDocs(user.id, currentClinicId),
      ]);
      await generatePrescriptionPdf({
        items: validItems,
        patient: { full_name: patient.full_name, cpf: patient.cpf },
        dentist,
        clinic,
        notes,
      });
      // Register in documents table
      await supabase.from('documents').insert({
        patient_id: patient.id,
        name: `Receita - ${new Date().toLocaleDateString('pt-BR')}`,
        file_url: 'generated://prescription',
        file_type: 'application/pdf',
        category: 'prescription',
        uploaded_by: user.id,
      });
      toast.success('Receita gerada e registrada no histórico.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar receita.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!patient?.phone) {
      toast.error('Paciente sem telefone cadastrado.');
      return;
    }
    const link = whatsappLink(patient.phone, 'Olá! Segue sua receita do atendimento. Em caso de dúvidas, entre em contato.');
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Templates */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Modelo</Label>
        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_PRESCRIPTION_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                templateId === tpl.id
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <p className="text-sm font-semibold">{tpl.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Patient */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> Paciente
        </Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o paciente" />
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

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Medicamentos</Label>
          <Button variant="ghost" size="sm" onClick={addItem} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
        {items.map((item, idx) => (
          <Card key={idx} className="border-border/60">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {idx + 1}
                </span>
                <Input
                  placeholder="Medicamento (ex: Dipirona 500mg)"
                  value={item.medication}
                  onChange={(e) => updateItem(idx, 'medication', e.target.value)}
                  className="flex-1"
                />
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-9 w-9 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 ml-8">
                <Input placeholder="Dose" value={item.dosage} onChange={(e) => updateItem(idx, 'dosage', e.target.value)} />
                <Input placeholder="Frequência" value={item.frequency} onChange={(e) => updateItem(idx, 'frequency', e.target.value)} />
                <Input placeholder="Duração" value={item.duration} onChange={(e) => updateItem(idx, 'duration', e.target.value)} />
              </div>
              <Input
                placeholder="Instruções (opcional)"
                value={item.instructions ?? ''}
                onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                className="ml-8 w-[calc(100%-2rem)] text-xs"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Observações (opcional)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Orientações adicionais..." />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleGenerate} disabled={generating || !patient || validItems.length === 0} className="gap-2">
          <FileDown className="h-4 w-4" />
          {generating ? 'Gerando...' : 'Gerar PDF'}
        </Button>
        <Button variant="outline" onClick={handleSendWhatsApp} disabled={!patient?.phone} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}