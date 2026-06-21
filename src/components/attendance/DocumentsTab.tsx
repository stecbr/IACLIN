import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Printer, ChevronLeft, ChevronRight,
  ClipboardList, Pill, Send, FileText,
  Plus, Trash2, Check, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Hypothesis } from '@/components/attendance/HypothesesEditor';
import { fetchClinicForDocs, fetchDentistForDocs } from '@/lib/clinicalDocsHelpers';
import type { PrescriptionItem } from '@/lib/prescriptionTemplates';
import { buildMedicalDocumentsHtml, ensureConsultationFolder, uploadPdfToFolder, type MedicalDocumentsDraft } from '@/lib/archiveAttendanceFiles';

// ── Sugestões ───────────────────────────────────────────────────────────────

const EXAM_LIST = [
  'Hemograma completo','Hemoglobina glicada (HbA1c)','Glicemia de jejum','Glicemia pós-prandial',
  'Colesterol total','Colesterol HDL','Colesterol LDL','Triglicerídeos','Perfil lipídico completo',
  'TSH','T4 livre','T3 livre','Anti-TPO (anticorpos anti-tireoperoxidase)',
  'Creatinina','Ureia','Ácido úrico','Taxa de filtração glomerular (TFG)',
  'TGO (AST)','TGP (ALT)','Gama-GT (GGT)','Fosfatase alcalina','Bilirrubinas (total e frações)',
  'PCR (Proteína C Reativa)','VHS (Velocidade de Hemossedimentação)','Ferritina','Ferro sérico',
  'Vitamina D (25-OH)','Vitamina B12','Ácido fólico',
  'Coagulograma completo (TP/TTPA/INR)','D-dímero','Fibrinogênio',
  'Sódio','Potássio','Magnésio','Cálcio total','Fósforo',
  'EAS (Urina tipo I)','Urocultura com antibiograma','Microalbuminúria',
  'PSA total','PSA livre','CEA','CA-125','CA-19.9','CA-15.3','AFP',
  'TSH','Prolactina','FSH','LH','Estradiol','Testosterona total','Cortisol sérico (manhã)',
  'HIV (Anti-HIV 1 e 2)','VDRL (sífilis)','HBsAg (hepatite B)','Anti-HCV (hepatite C)',
  'Toxoplasmose IgG e IgM','FAN (fator antinuclear)','Fator reumatoide','Anti-CCP',
  'Troponina I','BNP (Peptídeo natriurético)','CK-MB','CK total',
  'ECG de repouso (eletrocardiograma)','Ecocardiograma transtorácico','Holter 24 horas','MAPA 24 horas',
  'Teste ergométrico (esteira)','Espirometria',
  'Radiografia de tórax (PA e perfil)','Radiografia de coluna lombossacra (AP e perfil)',
  'Radiografia de coluna cervical (AP e perfil)','Radiografia de joelho direito',
  'Ultrassonografia abdominal total','Ultrassonografia pélvica (transvaginal)',
  'Ultrassonografia de tireoide','Ultrassonografia de mama bilateral',
  'Tomografia computadorizada de crânio','Tomografia computadorizada de tórax',
  'Tomografia computadorizada de abdômen e pelve',
  'Ressonância magnética de crânio','Ressonância magnética de coluna lombar',
  'Ressonância magnética de joelho direito','Densitometria óssea',
  'Endoscopia digestiva alta (EDA)','Colonoscopia',
  'Papanicolau (colpocitologia)','Mamografia bilateral',
  'Parasitológico de fezes (3 amostras)','Sangue oculto nas fezes','Coprocultura',
];

const MED_LIST = [
  'Dipirona 500mg comprimido','Dipirona 500mg/mL solução oral (gotas)',
  'Paracetamol 500mg comprimido','Paracetamol 750mg comprimido','Paracetamol 200mg/mL solução oral (gotas)',
  'Ibuprofeno 400mg comprimido','Ibuprofeno 600mg comprimido',
  'Nimesulida 100mg comprimido','Diclofenaco sódico 50mg comprimido',
  'Celecoxibe 200mg cápsula','Etoricoxibe 90mg comprimido','Meloxicam 15mg comprimido',
  'Prednisona 20mg comprimido','Prednisona 5mg comprimido','Dexametasona 4mg comprimido',
  'Prednisolona 20mg comprimido','Betametasona 0,5mg comprimido','Metilprednisolona 4mg comprimido',
  'Amoxicilina 500mg cápsula','Amoxicilina 875mg comprimido',
  'Amoxicilina + Clavulanato 875mg/125mg comprimido',
  'Azitromicina 500mg comprimido','Claritromicina 500mg comprimido',
  'Cefalexina 500mg cápsula','Ciprofloxacino 500mg comprimido','Levofloxacino 500mg comprimido',
  'Metronidazol 400mg comprimido','Clindamicina 300mg cápsula','Doxiciclina 100mg comprimido',
  'Nitrofurantoína 100mg cápsula','Sulfametoxazol + Trimetoprima 800mg/160mg comprimido',
  'Fluconazol 150mg cápsula','Nistatina 100.000 UI/mL suspensão oral',
  'Loratadina 10mg comprimido','Cetirizina 10mg comprimido','Fexofenadina 180mg comprimido',
  'Hidroxizina 25mg comprimido','Desloratadina 5mg comprimido',
  'Omeprazol 20mg cápsula','Omeprazol 40mg cápsula','Pantoprazol 40mg comprimido',
  'Esomeprazol 40mg comprimido','Lansoprazol 30mg cápsula',
  'Metoclopramida 10mg comprimido','Domperidona 10mg comprimido','Ondansetrona 8mg comprimido',
  'Losartana potássica 50mg comprimido','Enalapril 10mg comprimido',
  'Anlodipino 5mg comprimido','Anlodipino 10mg comprimido',
  'Atenolol 50mg comprimido','Carvedilol 6,25mg comprimido','Metoprolol 50mg comprimido',
  'Hidroclorotiazida 25mg comprimido','Furosemida 40mg comprimido','Espironolactona 25mg comprimido',
  'Atorvastatina 20mg comprimido','Atorvastatina 40mg comprimido','Sinvastatina 40mg comprimido',
  'Rosuvastatina 10mg comprimido','Rosuvastatina 20mg comprimido',
  'Metformina 850mg comprimido','Metformina 1g comprimido','Glimepirida 2mg comprimido',
  'Dapagliflozina 10mg comprimido','Empagliflozina 10mg comprimido',
  'Levotiroxina 50mcg comprimido','Levotiroxina 75mcg comprimido','Levotiroxina 100mcg comprimido',
  'Sertralina 50mg comprimido','Fluoxetina 20mg cápsula','Escitalopram 10mg comprimido',
  'Venlafaxina 75mg cápsula','Bupropiona 150mg comprimido','Amitriptilina 25mg comprimido',
  'Clonazepam 0,5mg comprimido','Clonazepam 1mg comprimido','Diazepam 5mg comprimido',
  'Alprazolam 0,5mg comprimido','Zolpidem 10mg comprimido','Quetiapina 25mg comprimido',
  'Carbamazepina 200mg comprimido','Pregabalina 75mg cápsula','Gabapentina 300mg cápsula',
  'Salbutamol 100mcg aerossol inalatório','Montelucaste 10mg comprimido',
  'Ambroxol 30mg/5mL xarope','Dextrometorfano 15mg/5mL xarope',
  'Tramadol 50mg cápsula','Codeína 30mg comprimido',
  'Vitamina D3 2.000 UI cápsula','Vitamina D3 7.000 UI cápsula',
  'Ácido fólico 5mg comprimido','Sulfato ferroso 40mg comprimido','Vitamina B12 1mg comprimido sublingual',
  'Ácido acetilsalicílico 100mg comprimido','Clopidogrel 75mg comprimido',
];

const SPECIALTY_LIST = [
  'Cardiologia','Neurologia','Gastroenterologia','Endocrinologia e Metabologia',
  'Ortopedia e Traumatologia','Reumatologia','Nefrologia','Pneumologia',
  'Dermatologia','Ginecologia','Obstetrícia','Urologia','Oftalmologia',
  'Otorrinolaringologia','Psiquiatria','Infectologia','Hematologia',
  'Oncologia Clínica','Cirurgia Geral','Cirurgia Vascular','Cirurgia Plástica e Reparadora',
  'Cirurgia do Aparelho Digestivo','Cirurgia da Coluna Vertebral',
  'Cirurgia do Joelho','Cirurgia do Quadril','Cirurgia do Ombro e Cotovelo',
  'Neurocirurgia','Mastologia','Coloproctologia','Hepatologia',
  'Geriatria','Pediatria','Neonatologia','Medicina de Família e Comunidade',
  'Fisiatria (Medicina Física e Reabilitação)','Fisioterapia','Fonoaudiologia',
  'Alergologia e Imunologia Clínica','Genética Médica','Medicina do Trabalho',
  'Nutrição Clínica','Psicologia Clínica','Saúde Mental',
  'Angiologia','Cirurgia Bariátrica e Metabólica','Reprodução Assistida e Infertilidade',
  'Cirurgia Bucomaxilofacial','Odontologia',
];

// ── Autocomplete genérico ───────────────────────────────────────────────────
interface ACProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

function AC({ value, onChange, suggestions, placeholder, className }: ACProps) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);

  const hits = value.trim().length >= 2
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()).slice(0, 8)
    : [];
  const show = open && hits.length > 0;

  useEffect(() => { setHi(0); }, [value]);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const pick = (s: string) => { onChange(s); setOpen(false); inRef.current?.blur(); };

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <Input
        ref={inRef}
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); pick(hits[hi]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {show && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg text-sm">
          {hits.map((s, idx) => {
            const q = value.trim();
            const lo = s.toLowerCase();
            const st = lo.indexOf(q.toLowerCase());
            return (
              <li
                key={s}
                onMouseDown={e => { e.preventDefault(); pick(s); }}
                onMouseEnter={() => setHi(idx)}
                className={cn('px-3 py-2 cursor-pointer', idx === hi ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60')}
              >
                {s.slice(0, st)}<strong>{s.slice(st, st + q.length)}</strong>{s.slice(st + q.length)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Stepper ─────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Exames', icon: ClipboardList },
  { label: 'Receituário', icon: Pill },
  { label: 'Encaminhamento', icon: Send },
  { label: 'Atestado', icon: FileText },
] as const;

function Stepper({ current, hasData }: { current: number; hasData: boolean[] }) {
  return (
    <div className="flex items-center w-full mb-6">
      {STEPS.map((s, i) => {
        const active = i === current;
        const done = hasData[i];
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-[60px]">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                active
                  ? 'bg-primary border-primary text-primary-foreground'
                  : done
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-background border-border text-muted-foreground'
              )}>
                {done && !active ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-[11px] font-medium text-center leading-tight',
                active ? 'text-primary' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              )}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-[2px] mx-1 rounded-full transition-colors mb-4',
                hasData[i] ? 'bg-emerald-400' : 'bg-border'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tipos ───────────────────────────────────────────────────────────────────
const EMPTY_RX: PrescriptionItem = { medication: '', dosage: '', frequency: '', duration: '', instructions: '' };
const URGENCY_OPTS = [
  { value: 'rotina', label: 'Rotina' },
  { value: 'prioritario', label: 'Prioritário' },
  { value: 'emergencia', label: 'Emergência' },
] as const;

// ── Componente principal ────────────────────────────────────────────────────
const DOC_KINDS = ['doc_exam_request', 'doc_prescription', 'doc_referral', 'doc_certificate'];

interface DocumentsTabProps {
  patientId: string;
  hypotheses?: Hypothesis[];
  clinicalRecordId?: string;
  appointmentId?: string;
  appointmentStartTime?: string;
  onDraftChange?: (draft: MedicalDocumentsDraft) => void;
}

export function DocumentsTab({ patientId, hypotheses, clinicalRecordId, appointmentId, appointmentStartTime, onDraftChange }: DocumentsTabProps) {
  const { user, currentClinicId } = useAuth();
  const [step, setStep] = useState(0);
  const [printing, setPrinting] = useState(false);

  // Step 1 — Exames
  const [exams, setExams] = useState<string[]>(['']);
  const [examIndication, setExamIndication] = useState('');

  // Step 2 — Receituário
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([{ ...EMPTY_RX }]);
  const [rxNotes, setRxNotes] = useState('');

  // Step 3 — Encaminhamento
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refUrgency, setRefUrgency] = useState<'rotina' | 'prioritario' | 'emergencia'>('rotina');
  const [refReason, setRefReason] = useState('');
  const [refSummary, setRefSummary] = useState('');

  // Step 4 — Atestado
  const [emitCert, setEmitCert] = useState(false);
  const [certMode, setCertMode] = useState<'attendance' | 'leave'>('attendance');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [certDate, setCertDate] = useState(today);
  const [certStart, setCertStart] = useState('');
  const [certEnd, setCertEnd] = useState('');
  const [leaveStart, setLeaveStart] = useState(today);
  const [leaveDays, setLeaveDays] = useState('1');
  const [certCid, setCertCid] = useState('');
  const [certCidEdited, setCertCidEdited] = useState(false);
  const [certNotes, setCertNotes] = useState('');

  // Draft persistence key: por agendamento (não vaza entre consultas do mesmo dia).
  // Fallback antigo só quando não houver appointmentId (ex.: telas fora do fluxo).
  const draftKey = appointmentId ? `doc-draft-apt-${appointmentId}` : `doc-draft-${patientId}-${today}`;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.exams?.length)  setExams(d.exams);
      if (d.examIndication) setExamIndication(d.examIndication);
      if (d.rxItems?.length) setRxItems(d.rxItems);
      if (d.rxNotes)        setRxNotes(d.rxNotes);
      if (d.refSpecialty)   setRefSpecialty(d.refSpecialty);
      if (d.refUrgency)     setRefUrgency(d.refUrgency);
      if (d.refReason)      setRefReason(d.refReason);
      if (d.refSummary)     setRefSummary(d.refSummary);
      if (d.emitCert != null) setEmitCert(d.emitCert);
      if (d.certMode)       setCertMode(d.certMode);
      if (d.certDate)       setCertDate(d.certDate);
      if (d.certStart)      setCertStart(d.certStart);
      if (d.certEnd)        setCertEnd(d.certEnd);
      if (d.leaveStart)     setLeaveStart(d.leaveStart);
      if (d.leaveDays)      setLeaveDays(d.leaveDays);
      if (d.certCid != null)      setCertCid(d.certCid);
      if (d.certCidEdited != null) setCertCidEdited(d.certCidEdited);
      if (d.certNotes)      setCertNotes(d.certNotes);
    } catch { void 0; }
  }, [draftKey]);

  // Auto-save to localStorage whenever any field changes (debounced 600ms)
  useEffect(() => {
    const draft = {
      exams, examIndication, rxItems, rxNotes,
      refSpecialty, refUrgency, refReason, refSummary,
      emitCert, certMode, certDate, certStart, certEnd,
      leaveStart, leaveDays, certCid, certNotes,
    };
    onDraftChange?.(draft);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ ...draft, certCidEdited }));
      } catch { void 0; }
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [draftKey, exams, examIndication, rxItems, rxNotes, refSpecialty, refUrgency, refReason, refSummary, emitCert, certMode, certDate, certStart, certEnd, leaveStart, leaveDays, certCid, certCidEdited, certNotes, onDraftChange]);

  // Sync CID from hypotheses
  useEffect(() => {
    if (certCidEdited) return;
    const codes = (hypotheses ?? []).map(h => h.cid10?.trim()).filter(Boolean).join(', ');
    setCertCid(codes);
  }, [hypotheses, certCidEdited]);

  // Auto-fill attendance time from today's appointment (skip if draft already restored)
  useEffect(() => {
    if (!patientId || !user) return;
    if (localStorage.getItem(draftKey)) return;
    const fetchToday = async () => {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
      const { data } = await supabase.from('appointments')
        .select('start_time, end_time')
        .eq('patient_id', patientId).eq('dentist_id', user.id)
        .gte('start_time', dayStart.toISOString()).lte('start_time', dayEnd.toISOString())
        .order('start_time', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        const s = new Date(data.start_time);
        const e = new Date(data.end_time);
        setCertDate(format(s, 'yyyy-MM-dd'));
        setCertStart(format(s, 'HH:mm'));
        setCertEnd(format(e, 'HH:mm'));
      }
    };
    fetchToday();
  }, [patientId, user, draftKey]);

  // Patient data
  const { data: patient } = useQuery({
    queryKey: ['docs-patient', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('full_name, cpf').eq('id', patientId).single();
      return data;
    },
  });

  // "Has data" per step
  const hasData = [
    exams.some(e => e.trim()),
    rxItems.some(it => it.medication.trim()),
    !!(refSpecialty.trim() && refReason.trim()),
    emitCert,
  ];

  const clearCurrentStep = () => {
    if (step === 0) { setExams(['']); setExamIndication(''); }
    if (step === 1) { setRxItems([{ ...EMPTY_RX }]); setRxNotes(''); }
    if (step === 2) { setRefSpecialty(''); setRefUrgency('rotina'); setRefReason(''); setRefSummary(''); }
    if (step === 3) { setEmitCert(false); setCertMode('attendance'); setCertDate(today); setCertStart(''); setCertEnd(''); setLeaveStart(today); setLeaveDays('1'); setCertCid(''); setCertCidEdited(false); setCertNotes(''); }
  };

  const filledCount = hasData.filter(Boolean).length;

  // Print all filled docs — ONE window, one page per document
  const handlePrint = async () => {
    if (!patient || !user) { toast.error('Dados do paciente não disponíveis.'); return; }
    if (filledCount === 0) { toast.error('Preencha ao menos um documento antes de imprimir.'); return; }
    setPrinting(true);
    try {
      const [clinic, doctor] = await Promise.all([
        fetchClinicForDocs(currentClinicId),
        fetchDentistForDocs(user.id, currentClinicId),
      ]);
      const pat = { full_name: patient.full_name, cpf: patient.cpf };

      const combined = await buildMedicalDocumentsHtml({
        draft: {
          exams, examIndication, rxItems, rxNotes,
          refSpecialty, refUrgency, refReason, refSummary,
          emitCert, certMode, certDate, certStart, certEnd,
          leaveStart, leaveDays, certCid, certNotes,
        },
        patient: pat,
        professional: doctor,
        clinic,
      });
      if (!combined) throw new Error('Nenhum documento preenchido.');

      const w = window.open('', '_blank');
      if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
      w.document.write(combined);
      w.document.close();
      w.onload = () => setTimeout(() => w.print(), 400);

      toast.success(`${filledCount} documento${filledCount > 1 ? 's' : ''} enviado${filledCount > 1 ? 's' : ''} para impressão.`);

      // Persist documents to patient portal via clinical_record_requests
      if (clinicalRecordId) {
        const { data: existing } = await supabase
          .from('clinical_record_requests')
          .select('id')
          .eq('clinical_record_id', clinicalRecordId)
          .in('kind', DOC_KINDS);
        if ((existing ?? []).length > 0) {
          await supabase.from('clinical_record_requests').delete().in('id', (existing ?? []).map((r) => r.id));
        }
        const toInsert: Array<{ clinical_record_id: string; kind: string; payload: Json }> = [];
        if (hasData[0]) {
          toInsert.push({ clinical_record_id: clinicalRecordId, kind: 'doc_exam_request', payload: { exams: exams.filter(e => e.trim()), indication: examIndication || null } });
        }
        if (hasData[1]) {
          toInsert.push({ clinical_record_id: clinicalRecordId, kind: 'doc_prescription', payload: { items: rxItems.filter(it => it.medication.trim()), notes: rxNotes || null } });
        }
        if (hasData[2]) {
          toInsert.push({ clinical_record_id: clinicalRecordId, kind: 'doc_referral', payload: { toSpecialty: refSpecialty, reason: refReason, summary: refSummary || null, urgency: refUrgency } });
        }
        if (hasData[3]) {
          toInsert.push({ clinical_record_id: clinicalRecordId, kind: 'doc_certificate', payload: { mode: certMode, date: certDate, startTime: certStart || null, endTime: certEnd || null, leaveStartDate: leaveStart, leaveDays, cid: certCid.trim() || null, notes: certNotes || null } });
        }
        if (toInsert.length > 0) {
          await supabase.from('clinical_record_requests').insert(toInsert);
        }
      }

      // Arquiva PDF "Documentos Médicos" na pasta da consulta do paciente
      if (appointmentId && appointmentStartTime && user) {
        try {
          const folderId = await ensureConsultationFolder({
            patientId, userId: user.id, appointmentId, startTime: appointmentStartTime,
          });
          await uploadPdfToFolder({
            patientId, userId: user.id, appointmentId, folderId,
            slug: 'documentos-medicos',
            name: 'Documentos Médicos.pdf',
            html: combined,
          });
        } catch (e: unknown) {
          toast.warning('Documentos impressos, mas falhou arquivar na pasta: ' + (e instanceof Error ? e.message : String(e)));
        }
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar documentos.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Documentos clínicos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
      <Stepper current={step} hasData={hasData} />

      {/* ── Step 1: Exames ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Exames solicitados</Label>
              <div className="flex items-center gap-1">
                {hasData[0] && (
                  <Button variant="ghost" size="sm" onClick={clearCurrentStep} className="gap-1 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                    <RotateCcw className="h-3 w-3" /> Limpar
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setExams(p => [...p, ''])} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {exams.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                  <AC
                    value={e}
                    onChange={v => setExams(p => p.map((x, idx) => idx === i ? v : x))}
                    suggestions={EXAM_LIST}
                    placeholder="Digite para buscar ou escreva livremente..."
                    className="flex-1"
                  />
                  {exams.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setExams(p => p.filter((_, idx) => idx !== i))} className="h-8 w-8 shrink-0 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Indicação clínica (opcional)</Label>
            <Textarea rows={2} value={examIndication} onChange={e => setExamIndication(e.target.value)} placeholder="Ex: investigação de dispneia aos esforços" />
          </div>
        </div>
      )}

      {/* ── Step 2: Receituário ── */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Medicamentos</Label>
            <div className="flex items-center gap-1">
              {hasData[1] && (
                <Button variant="ghost" size="sm" onClick={clearCurrentStep} className="gap-1 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                  <RotateCcw className="h-3 w-3" /> Limpar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setRxItems(p => [...p, { ...EMPTY_RX }])} className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
          </div>
          {rxItems.map((item, idx) => (
            <Card key={idx} className="border-border/60">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">{idx + 1}</span>
                  <AC
                    value={item.medication}
                    onChange={v => setRxItems(p => p.map((it, i) => i === idx ? { ...it, medication: v } : it))}
                    suggestions={MED_LIST}
                    placeholder="Medicamento (ex: Dipirona 500mg comprimido)"
                    className="flex-1"
                  />
                  {rxItems.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setRxItems(p => p.filter((_, i) => i !== idx))} className="h-8 w-8 shrink-0 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 ml-8">
                  {(['dosage', 'frequency', 'duration'] as const).map(field => (
                    <Input key={field} placeholder={field === 'dosage' ? 'Dose' : field === 'frequency' ? 'Frequência' : 'Duração'}
                      value={item[field]} onChange={e => setRxItems(p => p.map((it, i) => i === idx ? { ...it, [field]: e.target.value } : it))} />
                  ))}
                </div>
                <Input placeholder="Instruções (opcional)" value={item.instructions ?? ''}
                  onChange={e => setRxItems(p => p.map((it, i) => i === idx ? { ...it, instructions: e.target.value } : it))}
                  className="ml-8 w-[calc(100%-2rem)] text-xs" />
              </CardContent>
            </Card>
          ))}
          <div className="space-y-1.5">
            <Label className="text-sm">Observações (opcional)</Label>
            <Textarea rows={2} value={rxNotes} onChange={e => setRxNotes(e.target.value)} placeholder="Orientações adicionais..." />
          </div>
        </div>
      )}

      {/* ── Step 3: Encaminhamento ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dados do encaminhamento</Label>
            {(refSpecialty || refReason || refSummary) && (
              <Button variant="ghost" size="sm" onClick={clearCurrentStep} className="gap-1 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                <RotateCcw className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Encaminhar para (especialidade)</Label>
              <AC value={refSpecialty} onChange={setRefSpecialty} suggestions={SPECIALTY_LIST} placeholder="Ex: Cardiologia, Neurologia..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Urgência</Label>
              <Select value={refUrgency} onValueChange={v => setRefUrgency(v as typeof refUrgency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Motivo do encaminhamento <span className="text-destructive">*</span></Label>
            <Textarea rows={2} value={refReason} onChange={e => setRefReason(e.target.value)} placeholder="Ex: avaliação de dor torácica recorrente" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Resumo clínico (opcional)</Label>
            <Textarea rows={3} value={refSummary} onChange={e => setRefSummary(e.target.value)} placeholder="Histórico, exames realizados, medicações em uso..." />
          </div>
          {refSpecialty && !refReason && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Preencha o motivo para incluir o encaminhamento na impressão.</p>
          )}
        </div>
      )}

      {/* ── Step 4: Atestado ── */}
      {step === 3 && (
        <div className="space-y-4">
          {emitCert && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearCurrentStep} className="gap-1 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                <RotateCcw className="h-3 w-3" /> Limpar
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl border border-border p-4">
            <Switch checked={emitCert} onCheckedChange={setEmitCert} />
            <div>
              <p className="text-sm font-medium">Emitir atestado nesta consulta</p>
              <p className="text-xs text-muted-foreground">Se desligado, nenhum atestado será gerado</p>
            </div>
          </div>

          {emitCert && (
            <>
              <Tabs value={certMode} onValueChange={v => setCertMode(v as typeof certMode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="attendance">Comparecimento</TabsTrigger>
                  <TabsTrigger value="leave">Afastamento</TabsTrigger>
                </TabsList>
                <TabsContent value="attendance" className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Data</Label>
                    <Input type="date" value={certDate} onChange={e => setCertDate(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Horário início</Label>
                      <Input type="time" value={certStart} onChange={e => setCertStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Horário fim</Label>
                      <Input type="time" value={certEnd} onChange={e => setCertEnd(e.target.value)} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="leave" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Data início</Label>
                      <Input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Dias de afastamento</Label>
                      <Input type="number" min={1} value={leaveDays} onChange={e => setLeaveDays(e.target.value)} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-1.5">
                <Label className="text-sm">CID-10 (opcional)</Label>
                <Input
                  value={certCid}
                  onChange={e => { setCertCid(e.target.value); setCertCidEdited(true); }}
                  placeholder="Ex: J45.0"
                  className="font-mono"
                />
                {certCid && !certCidEdited && (
                  <p className="text-[11px] text-muted-foreground">Preenchido automaticamente das hipóteses diagnósticas</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Observações (opcional)</Label>
                <Textarea rows={2} value={certNotes} onChange={e => setCertNotes(e.target.value)} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Navegação ── */}
      <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-4">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>

        <div className="flex items-center gap-2">
          {filledCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {filledCount} documento{filledCount > 1 ? 's' : ''} preenchido{filledCount > 1 ? 's' : ''}
            </span>
          )}
          <Button
            onClick={handlePrint}
            disabled={printing || filledCount === 0}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            {printing ? 'Gerando...' : 'Imprimir documentos'}
          </Button>
        </div>

        {step < STEPS.length - 1 ? (
          <Button variant="outline" onClick={() => setStep(s => s + 1)} className="gap-1.5">
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-24" />
        )}
      </div>
      </CardContent>
    </Card>
  );
}
