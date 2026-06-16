import { useState, useEffect, useRef } from 'react';
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
import { cn } from '@/lib/utils';

// ── Lista de especialidades e destinos de encaminhamento ────────────────────
const SPECIALTY_SUGGESTIONS = [
  // Clínicas médicas gerais
  'Clínica Médica',
  'Medicina de Família e Comunidade',
  'Medicina Preventiva e Social',
  'Medicina do Trabalho',
  'Medicina do Esporte e do Exercício',
  'Medicina Intensiva',
  'Medicina de Urgência e Emergência',
  'Geriatria',
  'Pediatria',
  'Neonatologia',

  // Cardiologia
  'Cardiologia',
  'Cardiologia Pediátrica',
  'Cirurgia Cardiovascular',
  'Eletrofisiologia Cardíaca',
  'Hemodinâmica e Cardiologia Intervencionista',
  'Insuficiência Cardíaca e Transplante Cardíaco',

  // Neurologia
  'Neurologia',
  'Neurologia Pediátrica',
  'Neurocirurgia',
  'Neuropsicologia',
  'Neuropediatria',
  'Epilepsia',
  'Cefaleia',
  'Neurologia do Sono',

  // Aparelho digestivo / Gastroenterologia
  'Gastroenterologia',
  'Hepatologia',
  'Coloproctologia',
  'Proctologia',
  'Endoscopia Digestiva',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Bariátrica e Metabólica',

  // Cirurgias
  'Cirurgia Geral',
  'Cirurgia Vascular',
  'Cirurgia Torácica',
  'Cirurgia Plástica e Reparadora',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia Oncológica',
  'Cirurgia Pediátrica',
  'Cirurgia Robótica',
  'Microcirurgia Reconstrutiva',
  'Transplante de Órgãos',

  // Oncologia
  'Oncologia Clínica',
  'Oncologia Pediátrica',
  'Oncologia Ginecológica',
  'Hematologia e Oncologia',
  'Radioterapia',
  'Cuidados Paliativos e Dor Oncológica',

  // Ortopedia
  'Ortopedia e Traumatologia',
  'Cirurgia do Joelho',
  'Cirurgia do Ombro e Cotovelo',
  'Cirurgia do Quadril',
  'Cirurgia da Coluna Vertebral',
  'Cirurgia do Pé e Tornozelo',
  'Ortopedia Pediátrica',

  // Respiratório
  'Pneumologia',
  'Pneumologia Pediátrica',
  'Medicina do Sono',

  // Rim / Urologia
  'Nefrologia',
  'Urologia',
  'Urologia Pediátrica',
  'Uroginecologia',
  'Transplante Renal',

  // Endocrinologia / Metabólico
  'Endocrinologia e Metabologia',
  'Diabetologia',
  'Endocrinologia Pediátrica',
  'Nutrologia',
  'Nutrologia Pediátrica',
  'Obesidade e Síndrome Metabólica',

  // Ginecologia / Obstetrícia
  'Ginecologia',
  'Obstetrícia',
  'Ginecologia e Obstetrícia',
  'Mastologia',
  'Medicina Fetal',
  'Reprodução Assistida e Infertilidade',
  'Climaterio e Menopausa',
  'Uroginecologia e Assoalho Pélvico',

  // Dermatologia
  'Dermatologia',
  'Dermatologia Pediátrica',
  'Cirurgia Dermatológica',
  'Flebologia',

  // Oftalmologia
  'Oftalmologia',
  'Glaucoma',
  'Retina e Vítreo',
  'Córnea e Doenças Externas',
  'Oculoplástica',
  'Estrabismo',

  // Otorrinolaringologia
  'Otorrinolaringologia',
  'Audiologia',
  'Laringologia e Voz',
  'Rinologia',
  'Otologia',
  'Otorrinolaringologia Pediátrica',

  // Psiquiatria / Saúde mental
  'Psiquiatria',
  'Psiquiatria da Infância e Adolescência',
  'Saúde Mental',
  'Psicologia Clínica',
  'Neuropsiquiatria',
  'Dependência Química e Alcoolismo',

  // Hematologia / Imunologia
  'Hematologia',
  'Hemoterapia',
  'Transplante de Medula Óssea',
  'Alergologia e Imunologia Clínica',
  'Imunologia Pediátrica',

  // Reumatologia / Conectivopatias
  'Reumatologia',
  'Doenças Autoimunes',
  'Fibromialgia e Dor Crônica',

  // Infectologia
  'Infectologia',
  'HIV / AIDS',
  'Infectologia Pediátrica',
  'Medicina Tropical',
  'Hansenologia',

  // Reabilitação / Terapias
  'Fisiatria (Medicina Física e Reabilitação)',
  'Fisioterapia',
  'Terapia Ocupacional',
  'Fonoaudiologia',
  'Psicopedagogia',
  'Neuroreabilitação',
  'Reabilitação Cardiovascular',
  'Reabilitação Respiratória',
  'Reabilitação do Assoalho Pélvico',

  // Genética
  'Genética Médica',
  'Genética Pediátrica',
  'Aconselhamento Genético',

  // Angiologia / Vascular
  'Angiologia',
  'Cirurgia Endovascular',
  'Linfologia',

  // Outros
  'Acupuntura',
  'Medicina Nuclear',
  'Medicina Hiperbárica',
  'Patologia',
  'Sexologia',
  'Terapia da Dor',
  'Toxicologia Clínica',
  'Odontologia',
  'Cirurgia Bucomaxilofacial',
  'Nutrição Clínica',
  'Psicomotricidade',
  'Assistência Social',
];

// ── Autocomplete de especialidade ───────────────────────────────────────────
interface SpecialtyAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function SpecialtyAutocomplete({ value, onChange, placeholder }: SpecialtyAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = value.trim().length >= 2
    ? SPECIALTY_SUGGESTIONS.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
      ).slice(0, 8)
    : [];

  const showDropdown = open && suggestions.length > 0;

  useEffect(() => { setHighlighted(0); }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, suggestions.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); select(suggestions[highlighted]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg text-sm">
          {suggestions.map((s, idx) => {
            const q = value.trim();
            const lo = s.toLowerCase();
            const start = lo.indexOf(q.toLowerCase());
            const before = s.slice(0, start);
            const match = s.slice(start, start + q.length);
            const after = s.slice(start + q.length);
            return (
              <li
                key={s}
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
                onMouseEnter={() => setHighlighted(idx)}
                className={cn(
                  'px-3 py-2 cursor-pointer',
                  idx === highlighted ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                )}
              >
                {before}<strong>{match}</strong>{after}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
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
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [urgency, setUrgency] = useState<'rotina' | 'prioritario' | 'emergencia'>('rotina');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

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
          <SpecialtyAutocomplete
            value={toSpecialty}
            onChange={setToSpecialty}
            placeholder="Ex: Cardiologia, Endocrinologia..."
          />
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
