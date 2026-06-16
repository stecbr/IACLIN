import { useState, useEffect, useRef } from 'react';
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

// ── Lista completa de sugestões ─────────────────────────────────────────────
const EXAM_SUGGESTIONS = [
  // Hematologia
  'Hemograma completo',
  'Hemograma com diferencial',
  'Hematócrito',
  'Hemoglobina',
  'Contagem de plaquetas',
  'Reticulócitos',
  'VHS (Velocidade de Hemossedimentação)',
  'PCR (Proteína C Reativa)',
  'PCR ultrassensível',
  'Ferritina',
  'Ferro sérico',
  'Transferrina',
  'Vitamina B12',
  'Ácido fólico',
  'Vitamina D (25-OH)',

  // Coagulação
  'Coagulograma completo (TP/TTPA/INR)',
  'Tempo de Protrombina (TP/INR)',
  'Tempo de Tromboplastina Parcial (TTPA)',
  'Fibrinogênio',
  'D-dímero',

  // Glicemia / Metabolismo
  'Glicemia de jejum',
  'Glicemia pós-prandial',
  'Hemoglobina glicada (HbA1c)',
  'Teste de tolerância à glicose (TOTG 75g)',
  'Insulina de jejum',
  'Peptídeo C',
  'Microalbuminúria',
  'Frutosamine',

  // Lipídeos
  'Colesterol total',
  'Colesterol HDL',
  'Colesterol LDL',
  'Colesterol VLDL',
  'Triglicerídeos',
  'Perfil lipídico completo',
  'Lipoproteína (a)',
  'Apolipoproteína A1',
  'Apolipoproteína B',

  // Função renal
  'Creatinina',
  'Ureia',
  'Ácido úrico',
  'Taxa de filtração glomerular (TFG)',
  'Cistatina C',
  'Eletrólitos (Na/K/Cl)',
  'Sódio',
  'Potássio',
  'Cloro',
  'Magnésio',
  'Cálcio total',
  'Cálcio iônico',
  'Fósforo',
  'EAS (Urina tipo I)',
  'Urocultura com antibiograma',
  'Microalbuminúria de 24h',
  'Creatinina urinária',

  // Função hepática
  'TGO (AST)',
  'TGP (ALT)',
  'Gama-GT (GGT)',
  'Fosfatase alcalina',
  'Bilirrubinas (total e frações)',
  'Albumina sérica',
  'Proteínas totais e frações',
  'LDH (Desidrogenase láctica)',
  'Amilase',
  'Lipase',

  // Tireoide
  'TSH',
  'T4 livre',
  'T4 total',
  'T3 livre',
  'T3 total',
  'Anti-TPO (anticorpos anti-tireoperoxidase)',
  'Anti-tireoglobulina',
  'TRAb (anticorpos anti-receptor de TSH)',
  'Calcitonina',
  'Tireoglobulina',
  'Ultrassonografia de tireoide',

  // Hormônios / Endocrinologia
  'Cortisol sérico (manhã)',
  'Cortisol livre urinário 24h',
  'ACTH',
  'GH (Hormônio do crescimento)',
  'IGF-1',
  'Prolactina',
  'FSH',
  'LH',
  'Estradiol',
  'Progesterona',
  'Testosterona total',
  'Testosterona livre',
  'DHEA-S',
  'Androstenediona',
  '17-OH Progesterona',
  'SHBG',
  'AMH (Hormônio Anti-Mülleriano)',

  // Marcadores cardíacos
  'Troponina I',
  'Troponina T',
  'CK-MB',
  'CK total',
  'BNP (Peptídeo natriurético)',
  'NT-proBNP',
  'Mioglobina',
  'Homocisteína',

  // Doenças infecciosas / Sorologias
  'HIV (Anti-HIV 1 e 2)',
  'VDRL (sífilis)',
  'FTA-ABS',
  'HBsAg (hepatite B)',
  'Anti-HBs',
  'Anti-HBc total',
  'Anti-HCV (hepatite C)',
  'Toxoplasmose IgG e IgM',
  'CMV IgG e IgM',
  'Rubéola IgG e IgM',
  'HTLV I e II',
  'Chagas (sorologia)',
  'Dengue NS1 + IgG/IgM',
  'COVID-19 (sorologia)',
  'EBV (mononucleose) IgG e IgM',
  'HSV 1 e 2 IgG e IgM',
  'Varicela (VZV) IgG',
  'TORCH completo',

  // Imunologia / Reumatologia
  'FAN (fator antinuclear)',
  'Fator reumatoide',
  'Anti-CCP',
  'Complemento C3',
  'Complemento C4',
  'Anti-DNA nativo',
  'Anti-Sm',
  'Anti-SSA/Ro',
  'Anti-SSB/La',
  'Anti-Scl70',
  'ANCA c (Anti-PR3)',
  'ANCA p (Anti-MPO)',
  'Imunoglobulinas (IgG/IgA/IgM)',
  'Crioglobulinas',

  // Oncologia / Marcadores tumorais
  'PSA total',
  'PSA livre',
  'CEA (antígeno carcinoembriogênico)',
  'CA-125',
  'CA-19.9',
  'CA-15.3',
  'AFP (alfafetoproteína)',
  'Beta-HCG quantitativo',
  'DHL (LDH)',
  'Calcitonina',

  // Exames de imagem
  'Radiografia de tórax (PA e perfil)',
  'Radiografia de abdômen',
  'Radiografia de coluna cervical (AP e perfil)',
  'Radiografia de coluna torácica (AP e perfil)',
  'Radiografia de coluna lombossacra (AP e perfil)',
  'Radiografia de joelho direito',
  'Radiografia de joelho esquerdo',
  'Radiografia de quadril',
  'Radiografia de ombro direito',
  'Radiografia de ombro esquerdo',
  'Radiografia de mão direita',
  'Radiografia de mão esquerda',
  'Radiografia de pé direito',
  'Radiografia de pé esquerdo',
  'Ultrassonografia abdominal total',
  'Ultrassonografia pélvica (transvaginal)',
  'Ultrassonografia pélvica',
  'Ultrassonografia de abdômen superior',
  'Ultrassonografia de vias urinárias',
  'Ultrassonografia de partes moles',
  'Ultrassonografia de mama bilateral',
  'Ultrassonografia de tireoide',
  'Ultrassonografia de testículos',
  'Ultrassonografia obstétrica',
  'Ultrassonografia morfológica',
  'Doppler de carótidas',
  'Doppler venoso de membros inferiores',
  'Doppler arterial de membros inferiores',
  'Tomografia computadorizada de crânio',
  'Tomografia computadorizada de tórax',
  'Tomografia computadorizada de abdômen e pelve',
  'Tomografia computadorizada de coluna lombar',
  'Tomografia computadorizada de seios da face',
  'Ressonância magnética de crânio',
  'Ressonância magnética de coluna cervical',
  'Ressonância magnética de coluna lombar',
  'Ressonância magnética de joelho direito',
  'Ressonância magnética de joelho esquerdo',
  'Ressonância magnética de ombro direito',
  'Ressonância magnética de ombro esquerdo',
  'Ressonância magnética de abdômen',
  'Ressonância magnética de pelve',
  'Densitometria óssea',
  'Cintilografia óssea',
  'PET-CT',
  'Mamografia bilateral',

  // Cardiologia
  'ECG de repouso (eletrocardiograma)',
  'Ecocardiograma transtorácico',
  'Ecocardiograma transesofágico',
  'Holter 24 horas',
  'MAPA 24 horas',
  'Teste ergométrico (esteira)',
  'Cintilografia miocárdica',
  'Angiotomografia coronária',
  'Cateterismo cardíaco',

  // Pneumologia
  'Espirometria',
  'Espirometria com broncodilatador',
  'Gasometria arterial',
  'Peak flow',
  'Polissonografia',
  'Teste de caminhada de 6 minutos',
  'DLCO (difusão do CO)',

  // Gastroenterologia / Endoscopia
  'Endoscopia digestiva alta (EDA)',
  'Colonoscopia',
  'Retossigmoidoscopia',
  'Cápsula endoscópica',
  'Teste respiratório para H. pylori',
  'Calprotectina fecal',
  'Parasitológico de fezes (3 amostras)',
  'Sangue oculto nas fezes',
  'Coprocultura',
  'Elastase fecal',

  // Urologia / Nefrologia
  'Urodinâmica',
  'Urofluxometria',
  'Biopsia de próstata',
  'Citologia urinária',
  'Clearance de creatinina 24h',
  'Proteinúria de 24h',

  // Neurologia
  'Eletroencefalograma (EEG)',
  'Eletroneuromiografia (ENMG)',
  'Potencial evocado auditivo (BERA)',
  'Potencial evocado visual',
  'Punção lombar (líquor)',

  // Oftalmologia
  'Mapeamento de retina',
  'Campimetria',
  'Tomografia de coerência óptica (OCT)',
  'Tonometria',
  'Biometria ocular',

  // Otorrinolaringologia
  'Audiometria tonal',
  'Audiometria vocal',
  'Timpanometria',
  'Rinoscopia',

  // Ginecologia / Obstetrícia
  'Papanicolau (colpocitologia)',
  'Colposcopia',
  'Biópsia de colo uterino',
  'Histeroscopia',
  'Histerossalpingografia',
  'Sonoistero (avaliação endometrial)',
  'Cultura de secreção vaginal',
  'Pesquisa de HPV',

  // Dermatologia
  'Biópsia de pele',
  'Pesquisa de fungo (KOH)',
  'Cultura para fungo',
  'Prick test (teste de alergia cutânea)',
  'Patch test',

  // Outros
  'Tipagem sanguínea ABO e Rh',
  'Coombs direto',
  'Coombs indireto',
  'Eletroforese de proteínas',
  'Eletroforese de hemoglobina',
  'Pesquisa de células LE',
  'Parasitológico de fezes',
  'Urocultura',
  'Hemocultura',
  'Cultura de escarro',
  'PPD (teste tuberculínico)',
  'IGRA (Quantiferon-TB)',
  'Swab nasal',
];

const TEMPLATES: Array<{ id: string; name: string; exams: string[] }> = [
  { id: 'check-up', name: 'Check-up básico', exams: ['Hemograma completo', 'Glicemia de jejum', 'Colesterol total', 'Colesterol HDL', 'Colesterol LDL', 'Triglicerídeos', 'TSH', 'Creatinina', 'Ureia', 'TGO (AST)', 'TGP (ALT)', 'EAS (Urina tipo I)'] },
  { id: 'cardio', name: 'Cardiológico', exams: ['ECG de repouso (eletrocardiograma)', 'Ecocardiograma transtorácico', 'Holter 24 horas', 'MAPA 24 horas', 'Hemograma completo', 'Perfil lipídico completo', 'Troponina I', 'BNP (Peptídeo natriurético)'] },
  { id: 'preop', name: 'Pré-operatório', exams: ['Hemograma completo', 'Coagulograma completo (TP/TTPA/INR)', 'Glicemia de jejum', 'Creatinina', 'Sódio', 'Potássio', 'ECG de repouso (eletrocardiograma)', 'Radiografia de tórax (PA e perfil)', 'Tipagem sanguínea ABO e Rh'] },
  { id: 'pre-natal', name: 'Pré-natal inicial', exams: ['Beta-HCG quantitativo', 'Hemograma completo', 'Tipagem sanguínea ABO e Rh', 'Glicemia de jejum', 'VDRL (sífilis)', 'HIV (Anti-HIV 1 e 2)', 'HBsAg (hepatite B)', 'Anti-HCV (hepatite C)', 'Toxoplasmose IgG e IgM', 'Rubéola IgG e IgM', 'Urocultura com antibiograma', 'EAS (Urina tipo I)'] },
  { id: 'thyroid', name: 'Tireoide', exams: ['TSH', 'T4 livre', 'T3 livre', 'Anti-TPO (anticorpos anti-tireoperoxidase)', 'Anti-tireoglobulina', 'Ultrassonografia de tireoide'] },
  { id: 'diabetes', name: 'Diabetes / Metabólico', exams: ['Glicemia de jejum', 'Hemoglobina glicada (HbA1c)', 'Insulina de jejum', 'Peptídeo C', 'Microalbuminúria', 'Creatinina', 'Colesterol total', 'Triglicerídeos', 'TSH'] },
  { id: 'renal', name: 'Função Renal', exams: ['Creatinina', 'Ureia', 'Ácido úrico', 'Taxa de filtração glomerular (TFG)', 'Eletrólitos (Na/K/Cl)', 'EAS (Urina tipo I)', 'Urocultura com antibiograma', 'Proteinúria de 24h', 'Microalbuminúria'] },
  { id: 'hepatic', name: 'Função Hepática', exams: ['TGO (AST)', 'TGP (ALT)', 'Gama-GT (GGT)', 'Fosfatase alcalina', 'Bilirrubinas (total e frações)', 'Albumina sérica', 'Proteínas totais e frações', 'Coagulograma completo (TP/TTPA/INR)'] },
  { id: 'imagem-coluna', name: 'Coluna', exams: ['Radiografia de coluna lombossacra (AP e perfil)', 'Radiografia de coluna cervical (AP e perfil)', 'Ressonância magnética de coluna lombar', 'Ressonância magnética de coluna cervical'] },
  { id: 'reumatologia', name: 'Reumatologia', exams: ['Hemograma completo', 'VHS (Velocidade de Hemossedimentação)', 'PCR (Proteína C Reativa)', 'Fator reumatoide', 'FAN (fator antinuclear)', 'Anti-CCP', 'Ácido úrico', 'Complemento C3', 'Complemento C4'] },
];

// ── Autocomplete de exame ───────────────────────────────────────────────────
interface ExamAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function ExamAutocomplete({ value, onChange, placeholder }: ExamAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = value.trim().length >= 2
    ? EXAM_SUGGESTIONS.filter((s) =>
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
    <div ref={wrapperRef} className="relative flex-1">
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
interface ExamRequestPadProps {
  patientId?: string;
}

export function ExamRequestPad({ patientId: initialPatientId }: ExamRequestPadProps = {}) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [exams, setExams] = useState<string[]>(['']);
  const [indication, setIndication] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
              <p className="font-semibold leading-tight text-xs">{tpl.name}</p>
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
              <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
              <ExamAutocomplete
                value={e}
                onChange={(v) => updateExam(i, v)}
                placeholder="Digite para buscar ou escreva livremente..."
              />
              {exams.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeExam(i)} className="h-9 w-9 shrink-0 text-destructive">
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
