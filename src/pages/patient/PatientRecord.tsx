import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, Mail, MapPin, CreditCard, FileText, Pill, FlaskConical, ArrowRight,
  ChevronDown, ChevronRight, Printer, Download, Loader2, Stethoscope,
  User, Calendar, Share2, CalendarPlus, Image as ImageIcon, File, FileCheck2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSignedFileUrl } from '@/lib/storageSignedUrl';
import { buildPrescriptionHtml } from '@/lib/generatePrescriptionPdf';
import { buildExamRequestHtml } from '@/lib/generateExamRequestPdf';
import { buildReferralHtml } from '@/lib/generateReferralPdf';
import { ShareMyChartDialog } from '@/components/patient/ShareMyChartDialog';
import { SPECIALTIES } from '@/components/patient/booking/SpecialtyStep';
import { toast } from 'sonner';
import { formatCpf, formatPhone } from '@/lib/cpf';

function specialtyLabel(slug: string | undefined | null): string | undefined {
  if (!slug) return undefined;
  return SPECIALTIES.find(s => s.id === slug)?.name
    ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DoctorData {
  id: string;
  full_name: string;
  specialty?: string;
  avatar_url?: string;
}
interface ClinicData {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  cnpj?: string;
  logo_url?: string;
}
interface RecordData {
  id: string;
  created_at: string;
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  notes?: string;
  follow_up_date?: string;
  follow_up_reason?: string;
  procedure_duration_seconds?: number;
  doctor?: DoctorData;
  clinic?: ClinicData;
  requests: any[];
  procedures: any[];
}

const URGENCY: Record<string, string> = {
  rotina: 'Rotina', routine: 'Rotina',
  prioritario: 'Prioritário', urgent: 'Prioritário',
  emergencia: 'Emergência', emergency: 'Emergência',
};

// ── Doc classifier (mirror of PatientExams) ───────────────────────────────────
const EXAM_CATEGORIES = new Set(['image', 'exam', 'lab_exam', 'imaging_exam', 'exame', 'patient_exam']);
const PRESCRIPTION_CATEGORIES = new Set(['prescription', 'receita']);
const CERTIFICATE_CATEGORIES = new Set(['medical_certificate']);
const REFERRAL_CATEGORIES = new Set(['referral', 'encaminhamento']);

type DocBucket = 'exam' | 'prescription' | 'referral' | 'certificate' | 'other';
function classifyDoc(d: { category: string | null; name: string }): DocBucket {
  const cat = (d.category ?? '').toLowerCase();
  if (PRESCRIPTION_CATEGORIES.has(cat)) return 'prescription';
  if (EXAM_CATEGORIES.has(cat)) return 'exam';
  if (CERTIFICATE_CATEGORIES.has(cat)) return 'certificate';
  if (REFERRAL_CATEGORIES.has(cat)) return 'referral';
  if (cat.startsWith('doctor_file')) {
    const n = (d.name ?? '').toLowerCase();
    if (n.startsWith('solicitação de exames') || n.startsWith('solicitacao de exames')) return 'exam';
    if (n.startsWith('receituário') || n.startsWith('receituario')) return 'prescription';
    if (n.startsWith('encaminhamento')) return 'referral';
    if (n.startsWith('atestado')) return 'certificate';
  }
  return 'other';
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function openPrintBlob(html: string) {
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const w    = window.open(url, '_blank');
  if (!w) { URL.revokeObjectURL(url); toast.error('Pop-up bloqueado'); return; }
  w.addEventListener('load', () => setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 300));
}

async function printRequestPdf(req: any, record: RecordData, patient: { full_name: string; cpf?: string }) {
  const doc = record.doctor;
  const clin = record.clinic;

  // Fetch extra doctor fields on-demand for PDF (cast to any — columns exist but aren't in generated types)
  let registration_number: string | undefined;
  let signature_url: string | undefined;
  if (doc?.id) {
    try {
      const { data: extra } = await (supabase as any)
        .from('profiles')
        .select('registration_number, signature_url')
        .eq('id', doc.id)
        .maybeSingle();
      registration_number = extra?.registration_number ?? undefined;
      signature_url = extra?.signature_url ?? undefined;
    } catch { /* optional — PDF still works without */ }
  }

  const dentist = {
    full_name: doc?.full_name ?? 'Profissional',
    specialty: doc?.specialty,
    registration_number,
    signature_url,
  };
  const clinic = clin ? {
    name: clin.name, phone: clin.phone, address: clin.address,
    city: clin.city, state: clin.state, cnpj: clin.cnpj, logo_url: clin.logo_url,
  } : undefined;

  try {
    let html = '';
    if (['prescription', 'doc_prescription'].includes(req.kind)) {
      const items = req.payload?.items ?? req.payload?.prescriptions ?? [];
      html = await buildPrescriptionHtml({ items, notes: req.payload?.notes, patient, dentist, clinic });
    } else if (['lab_exam', 'imaging_exam', 'doc_exam_request'].includes(req.kind)) {
      const exams: string[] = req.kind === 'doc_exam_request'
        ? (req.payload?.exams ?? [])
        : [req.payload?.name ?? req.kind];
      html = await buildExamRequestHtml({ exams, clinicalIndication: req.payload?.indication, patient, doctor: dentist, clinic });
    } else if (['referral', 'doc_referral'].includes(req.kind)) {
      html = await buildReferralHtml({
        toSpecialty: req.payload?.toSpecialty ?? '—',
        reason: req.payload?.reason ?? '',
        summary: req.payload?.clinicalSummary,
        urgency: req.payload?.urgency,
        patient, doctor: dentist, clinic,
      });
    }
    if (html) openPrintBlob(html);
  } catch (e: any) {
    toast.error('Não foi possível gerar o PDF', { description: e.message });
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PatientRecord() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Patient personal data
  const { data: patientRows = [], isLoading: loadingPatient } = useQuery({
    queryKey: ['patient-self', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, cpf, date_of_birth, gender, phone, email, address, city, state, zip_code, insurance_provider, insurance_number, notes, photo_url')
        .eq('patient_user_id', user!.id);
      return data ?? [];
    },
  });

  const patient: any = patientRows[0] ?? null;
  const patientIdList = patientRows.map((p: any) => p.id);
  const patientName: string = patient?.full_name ?? 'Paciente';
  const initials = patientName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  // Clinical records
  const { data: records = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['patient-full-records', patientIdList.join(',')],
    enabled: patientIdList.length > 0,
    queryFn: async () => {
      const { data: recs } = await supabase
        .from('clinical_records')
        .select('id, created_at, chief_complaint, diagnosis, treatment_plan, notes, follow_up_date, follow_up_reason, procedure_duration_seconds, dentist_id, clinic_id, clinical_record_requests(id, kind, payload), clinical_record_procedures(id, tooth_number, notes, procedures(name))')
        .in('patient_id', patientIdList)
        .order('created_at', { ascending: false });
      if (!recs?.length) return [];

      const dentistIds = [...new Set(recs.map((r: any) => r.dentist_id).filter(Boolean))];
      const clinicIds  = [...new Set(recs.map((r: any) => r.clinic_id).filter(Boolean))];
      const profMap = new Map<string, DoctorData>();
      const clinicMap = new Map<string, ClinicData>();

      if (dentistIds.length) {
        const { data: p, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, specialty, avatar_url')
          .in('id', dentistIds);
        if (!pErr) (p ?? []).forEach((x: any) => profMap.set(x.id, x));
      }
      if (clinicIds.length) {
        const { data: c } = await supabase
          .from('clinics')
          .select('id, name, phone, address, city, state, cnpj, logo_url')
          .in('id', clinicIds);
        (c ?? []).forEach((x: any) => clinicMap.set(x.id, x));
      }

      return recs.map((r: any): RecordData => ({
        id: r.id,
        created_at: r.created_at,
        chief_complaint: r.chief_complaint || undefined,
        diagnosis: r.diagnosis || undefined,
        treatment_plan: r.treatment_plan || undefined,
        notes: r.notes?.replace(/<!--SPECIALTY_DATA:.+?-->/s, '').trim() || undefined,
        follow_up_date: r.follow_up_date || undefined,
        follow_up_reason: r.follow_up_reason || undefined,
        procedure_duration_seconds: r.procedure_duration_seconds || undefined,
        doctor: r.dentist_id ? profMap.get(r.dentist_id) : undefined,
        clinic: r.clinic_id  ? clinicMap.get(r.clinic_id)  : undefined,
        requests: r.clinical_record_requests ?? [],
        procedures: r.clinical_record_procedures ?? [],
      }));
    },
  });

  // Documents
  const { data: documents = [] } = useQuery({
    queryKey: ['patient-docs-tab', patientIdList.join(',')],
    enabled: patientIdList.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, name, file_url, file_type, category, created_at, uploaded_by')
        .in('patient_id', patientIdList)
        .not('category', 'eq', 'doctor_folder')
        .order('created_at', { ascending: false })
        .limit(100);
      const rows = (data ?? []).filter((d: any) => !d.file_url?.startsWith('generated://'));
      const uploaderIds = [...new Set(rows.map((d: any) => d.uploaded_by).filter(Boolean))] as string[];
      const drMap = new Map<string, DoctorData>();
      if (uploaderIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, specialty, avatar_url')
          .in('id', uploaderIds);
        (profs ?? []).forEach((p: any) => drMap.set(p.id, p));
      }
      return rows.map((d: any) => ({ ...d, doctor: d.uploaded_by ? drMap.get(d.uploaded_by) ?? null : null }));
    },
  });

  const allRequests     = records.flatMap(r => r.requests.map(req => ({ ...req, _record: r })));
  const allPrescriptions = allRequests.filter(r => ['prescription', 'doc_prescription'].includes(r.kind));
  const allExams         = allRequests.filter(r => ['lab_exam', 'imaging_exam', 'doc_exam_request'].includes(r.kind));
  const allReferrals     = allRequests.filter(r => ['referral', 'doc_referral'].includes(r.kind));

  // Split archived docs by type using filename + category
  const examDocs: any[]         = [];
  const prescriptionDocs: any[] = [];
  const referralDocs: any[]     = [];
  const certificateDocs: any[]  = [];
  const otherDocs: any[]        = [];
  for (const d of documents as any[]) {
    switch (classifyDoc(d)) {
      case 'exam':         examDocs.push(d); break;
      case 'prescription': prescriptionDocs.push(d); break;
      case 'referral':     referralDocs.push(d); break;
      case 'certificate':  certificateDocs.push(d); break;
      default:             otherDocs.push(d);
    }
  }

  const patientForPdf = { full_name: patientName, cpf: patient?.cpf ?? undefined };

  const openDoc = async (doc: any) => {
    const url = await getSignedFileUrl(doc.file_url, { expiresIn: 3600 });
    if (!url) { toast.error('Não foi possível abrir o arquivo'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loadingPatient || loadingRecs) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Patient header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={patient?.photo_url ?? undefined} alt={patientName} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground leading-tight">{patientName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              {patient?.phone && (
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(patient.phone)}</span>
              )}
              {patient?.email && (
                <span className="flex items-center gap-1 min-w-0 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{patient.email}</span>
              )}
              {patient?.city && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{patient.city}{patient.state ? `, ${patient.state}` : ''}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-4 w-4" /> Compartilhar prontuário
          </Button>
          {records.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => records.forEach((r, i) => setTimeout(() => printRecord(r, patientName), i * 250))}
            >
              <Printer className="h-4 w-4" /> Exportar tudo
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Informações
          </TabsTrigger>
          <TabsTrigger value="consultas" className="gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Consultas
            {records.length > 0 && <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{records.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="prescricoes" className="gap-1.5">
            <Pill className="h-3.5 w-3.5" /> Prescrições
            {(allPrescriptions.length + prescriptionDocs.length) > 0 && <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{allPrescriptions.length + prescriptionDocs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="exames" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> Exames
            {(allExams.length + examDocs.length) > 0 && <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{allExams.length + examDocs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="encaminhamentos" className="gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" /> Encaminh.
            {(allReferrals.length + referralDocs.length) > 0 && <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{allReferrals.length + referralDocs.length}</Badge>}
          </TabsTrigger>
          {certificateDocs.length > 0 && (
            <TabsTrigger value="atestados" className="gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5" /> Atestados
              <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{certificateDocs.length}</Badge>
            </TabsTrigger>
          )}
          {otherDocs.length > 0 && (
            <TabsTrigger value="documentos" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Documentos
              <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{otherDocs.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Informações ─────────────────────────────────────────────────── */}
        <TabsContent value="info">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Dados Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {patient?.cpf && <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{formatCpf(patient.cpf)}</span></div>}
                {patient?.date_of_birth && <div><span className="text-muted-foreground">Nascimento:</span> <span className="font-medium">{format(new Date(patient.date_of_birth), "dd/MM/yyyy")}</span></div>}
                {patient?.gender && <div><span className="text-muted-foreground">Gênero:</span> <span className="font-medium">{patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro'}</span></div>}
                {patient?.phone && <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{formatPhone(patient.phone)}</span></div>}
                {patient?.email && <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{patient.email}</span></div>}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {patient?.address && <div>{patient.address}</div>}
                {(patient?.city || patient?.state) && <div>{[patient?.city, patient?.state].filter(Boolean).join(' — ')}</div>}
                {patient?.zip_code && <div>CEP: {patient.zip_code}</div>}
                {!patient?.address && !patient?.city && !patient?.zip_code && (
                  <p className="text-muted-foreground text-xs">Não informado</p>
                )}
              </CardContent>
            </Card>

            {patient?.insurance_provider && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Convênio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="font-medium">{patient.insurance_provider}</div>
                  {patient.insurance_number && <div><span className="text-muted-foreground">Nº:</span> {patient.insurance_number}</div>}
                </CardContent>
              </Card>
            )}

            {patient?.notes && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Observações</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{patient.notes}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Consultas ───────────────────────────────────────────────────── */}
        <TabsContent value="consultas">
          {records.length === 0 ? (
            <Empty icon={Calendar} label="Nenhum atendimento registrado" />
          ) : (
            <div className="space-y-2">
              {records.map((r) => {
                const isOpen = expanded === r.id;
                const dur = r.procedure_duration_seconds && r.procedure_duration_seconds > 0
                  ? `${Math.max(1, Math.floor(r.procedure_duration_seconds / 60))}min`
                  : null;
                const drInitials = r.doctor?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <div key={r.id} className="rounded-lg border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      {/* Doctor avatar */}
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={r.doctor?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                          {drInitials ?? <Stethoscope className="h-4 w-4 text-primary/60" />}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.diagnosis || r.chief_complaint || 'Atendimento'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.doctor?.full_name ? `Dr(a). ${r.doctor.full_name}` : 'Profissional'}
                          {r.doctor?.specialty ? ` · ${specialtyLabel(r.doctor.specialty)}` : ''}
                          {' · '}{format(parseISO(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {dur && ` · ⏱ ${dur}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {r.requests.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{r.requests.length} docs</Badge>
                        )}
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-3 pt-2 space-y-2 text-xs border-t border-border/50 bg-muted/20">
                        {r.clinic?.name && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />{r.clinic.name}
                            {r.clinic.city ? ` · ${r.clinic.city}` : ''}
                          </p>
                        )}
                        {r.chief_complaint && <p><span className="text-muted-foreground">Queixa:</span> {r.chief_complaint}</p>}
                        {r.diagnosis       && <p><span className="text-muted-foreground">Diagnóstico:</span> {r.diagnosis}</p>}
                        {r.treatment_plan  && <p><span className="text-muted-foreground">Conduta:</span> {r.treatment_plan}</p>}
                        {r.notes           && <p className="whitespace-pre-wrap">{r.notes}</p>}

                        {r.procedures.length > 0 && (
                          <div className="pt-1.5 border-t border-border/30">
                            <p className="text-muted-foreground mb-1">Procedimentos:</p>
                            <ul className="space-y-0.5">
                              {r.procedures.map((p: any) => (
                                <li key={p.id} className="flex items-center gap-1.5">
                                  <Stethoscope className="h-3 w-3 text-muted-foreground" />
                                  {p.procedures?.name ?? 'Procedimento'}
                                  {p.tooth_number && <span className="text-muted-foreground"> · Dente {p.tooth_number}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {r.requests.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            {r.requests.filter(x => ['prescription','doc_prescription'].includes(x.kind)).length > 0 && (
                              <Chip color="emerald"><Pill className="h-2.5 w-2.5" />{r.requests.filter(x => ['prescription','doc_prescription'].includes(x.kind)).length} receita(s)</Chip>
                            )}
                            {r.requests.filter(x => ['lab_exam','imaging_exam','doc_exam_request'].includes(x.kind)).length > 0 && (
                              <Chip color="violet"><FlaskConical className="h-2.5 w-2.5" />{r.requests.filter(x => ['lab_exam','imaging_exam','doc_exam_request'].includes(x.kind)).length} exame(s)</Chip>
                            )}
                            {r.requests.filter(x => ['referral','doc_referral'].includes(x.kind)).length > 0 && (
                              <Chip color="amber"><ArrowRight className="h-2.5 w-2.5" />{r.requests.filter(x => ['referral','doc_referral'].includes(x.kind)).length} encaminh.</Chip>
                            )}
                          </div>
                        )}

                        {r.follow_up_date && (
                          <p className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-md px-3 py-1.5">
                            Retorno: {format(parseISO(r.follow_up_date), "dd/MM/yyyy")}
                            {r.follow_up_reason && ` — ${r.follow_up_reason}`}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-border/30 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => navigate('/paciente/agendar', {
                              state: { initialSpecialty: r.doctor?.specialty ?? null },
                            })}
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            Agendar novamente
                            {r.doctor?.specialty ? ` com ${specialtyLabel(r.doctor.specialty)}` : ''}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 h-7 text-xs text-muted-foreground"
                            onClick={() => printRecord(r, patientName)}
                          >
                            <Printer className="h-3.5 w-3.5" /> Exportar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Prescrições ─────────────────────────────────────────────────── */}
        <TabsContent value="prescricoes">
          {allPrescriptions.length === 0 && prescriptionDocs.length === 0
            ? <Empty icon={Pill} label="Sem prescrições registradas" />
            : (
              <div className="space-y-2">
                {allPrescriptions.map((rx) => {
                  const items = rx.payload?.items ?? rx.payload?.prescriptions ?? [];
                  const r: RecordData = rx._record;
                  return (
                    <Card key={rx.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={r.doctor?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                                {r.doctor?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? <Stethoscope className="h-3 w-3 text-primary/60" />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium leading-tight">
                                {r.doctor?.full_name ? `Dr(a). ${r.doctor.full_name}` : 'Profissional'}
                              </p>
                              {r.doctor?.specialty && <p className="text-[10px] text-muted-foreground">{specialtyLabel(r.doctor.specialty)}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <time className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</time>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => printRequestPdf(rx, r, patientForPdf)}
                            >
                              <Printer className="h-3 w-3" /> PDF
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm pl-9">
                          {items.map((it: any, j: number) => (
                            <p key={j}>
                              <span className="font-medium">{it.medication ?? it.name}</span>
                              {it.dosage && <span className="text-muted-foreground"> · {it.dosage}</span>}
                              {it.instructions && <span className="text-muted-foreground"> — {it.instructions}</span>}
                              {it.duration && <span className="text-muted-foreground"> ({it.duration})</span>}
                            </p>
                          ))}
                          {rx.payload?.notes && <p className="text-xs text-muted-foreground italic pt-0.5">{rx.payload.notes}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {prescriptionDocs.length > 0 && (
                  <ArchivedFilesGrid label="Arquivos" docs={prescriptionDocs} openDoc={openDoc} accent="emerald" />
                )}
              </div>
            )
          }
        </TabsContent>

        {/* ── Exames ──────────────────────────────────────────────────────── */}
        <TabsContent value="exames">
          {allExams.length === 0 && examDocs.length === 0
            ? <Empty icon={FlaskConical} label="Sem solicitações de exames" />
            : (
              <div className="space-y-2">
                {allExams.map((ex) => {
                  const names: string[] = ex.kind === 'doc_exam_request'
                    ? (ex.payload?.exams ?? [])
                    : [ex.payload?.name ?? ex.kind];
                  const r: RecordData = ex._record;
                  return (
                    <Card key={ex.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={r.doctor?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                                {r.doctor?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? <Stethoscope className="h-3 w-3 text-primary/60" />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium leading-tight">
                                {r.doctor?.full_name ? `Dr(a). ${r.doctor.full_name}` : 'Profissional'}
                              </p>
                              {r.doctor?.specialty && <p className="text-[10px] text-muted-foreground">{specialtyLabel(r.doctor.specialty)}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <time className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</time>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => printRequestPdf(ex, r, patientForPdf)}
                            >
                              <Printer className="h-3 w-3" /> PDF
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm space-y-0.5 pl-9">
                          {names.map((e: string, i: number) => <p key={i}>• {e}</p>)}
                          {ex.payload?.indication && <p className="text-xs text-muted-foreground italic mt-1">Indicação: {ex.payload.indication}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {examDocs.length > 0 && (
                  <ArchivedFilesGrid label="Arquivos" docs={examDocs} openDoc={openDoc} accent="violet" />
                )}
              </div>
            )
          }
        </TabsContent>

        {/* ── Encaminhamentos ─────────────────────────────────────────────── */}
        <TabsContent value="encaminhamentos">
          {allReferrals.length === 0 && referralDocs.length === 0
            ? <Empty icon={ArrowRight} label="Sem encaminhamentos registrados" />
            : (
              <div className="space-y-2">
                {allReferrals.map((rf) => {
                  const r: RecordData = rf._record;
                  return (
                    <Card key={rf.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={r.doctor?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                                {r.doctor?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? <Stethoscope className="h-3 w-3 text-primary/60" />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{rf.payload?.toSpecialty ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.doctor?.full_name ? `Dr(a). ${r.doctor.full_name}` : 'Profissional'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] h-5">{URGENCY[rf.payload?.urgency] ?? 'Rotina'}</Badge>
                            <time className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</time>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => printRequestPdf(rf, r, patientForPdf)}
                            >
                              <Printer className="h-3 w-3" /> PDF
                            </Button>
                          </div>
                        </div>
                        {rf.payload?.reason && <p className="text-xs text-muted-foreground mt-2 pl-9">{rf.payload.reason}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
                {referralDocs.length > 0 && (
                  <ArchivedFilesGrid label="Arquivos" docs={referralDocs} openDoc={openDoc} accent="amber" />
                )}
              </div>
            )
          }
        </TabsContent>

        {/* ── Atestados ───────────────────────────────────────────────────── */}
        {certificateDocs.length > 0 && (
          <TabsContent value="atestados">
            <ArchivedFilesGrid docs={certificateDocs} openDoc={openDoc} accent="sky" />
          </TabsContent>
        )}

        {/* ── Documentos ──────────────────────────────────────────────────── */}
        {otherDocs.length > 0 && (
          <TabsContent value="documentos">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {otherDocs.map((d: any) => {
                const isImage = /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(d.file_url ?? '') || d.file_type?.startsWith('image/');
                return (
                  <div key={d.id} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all">
                    {/* Preview area */}
                    <div className="h-28 bg-muted/40 flex items-center justify-center relative">
                      {isImage ? (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                          <File className="h-10 w-10" />
                          <span className="text-[10px] uppercase font-medium tracking-wide">
                            {d.file_type?.split('/')[1] ?? 'arquivo'}
                          </span>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" onClick={() => openDoc(d)}>
                          <Download className="h-3.5 w-3.5" /> Baixar
                        </Button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(d.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openDoc(d)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Share dialog */}
      <ShareMyChartDialog open={shareOpen} onOpenChange={setShareOpen} patientName={patientName} />
    </div>
  );
}

// ── Print full record ─────────────────────────────────────────────────────────
function buildPrintHtml(r: RecordData, patientName: string): string {
  const rx    = r.requests.filter(x => ['prescription', 'doc_prescription'].includes(x.kind));
  const exms  = r.requests.filter(x => ['lab_exam', 'imaging_exam', 'doc_exam_request'].includes(x.kind));
  const refs  = r.requests.filter(x => ['referral', 'doc_referral'].includes(x.kind));
  const certs = r.requests.filter(x => x.kind === 'doc_certificate');

  let rxHtml = '', examHtml = '', refHtml = '', certHtml = '';
  for (const p of rx) {
    (p.payload?.items ?? p.payload?.prescriptions ?? []).forEach((it: any) => {
      rxHtml += `<p>• ${it.medication ?? it.name}${it.dosage ? ` ${it.dosage}` : ''}${it.instructions ? ` — ${it.instructions}` : ''}${it.duration ? ` (${it.duration})` : ''}</p>`;
    });
    if (p.payload?.notes) rxHtml += `<p class="note">Obs: ${p.payload.notes}</p>`;
  }
  for (const e of exms) {
    if (e.kind === 'doc_exam_request') {
      (e.payload?.exams ?? []).forEach((s: string) => { examHtml += `<p>• ${s}</p>`; });
      if (e.payload?.indication) examHtml += `<p class="note">Indicação: ${e.payload.indication}</p>`;
    } else examHtml += `<p>• ${e.payload?.name ?? e.kind}</p>`;
  }
  for (const rf of refs) {
    refHtml += `<p><b>${rf.payload?.toSpecialty ?? '—'}</b> (${URGENCY[rf.payload?.urgency] ?? 'Rotina'})</p>`;
    if (rf.payload?.reason) refHtml += `<p class="note">${rf.payload.reason}</p>`;
  }
  for (const ct of certs) {
    certHtml += ct.payload?.mode === 'leave'
      ? `<p>Afastamento de ${ct.payload.leaveDays} dia(s) a partir de ${ct.payload.leaveStartDate ?? '—'}</p>`
      : `<p>Atestado de comparecimento em ${ct.payload?.date ?? '—'}</p>`;
    if (ct.payload?.cid) certHtml += `<p class="note">CID: ${ct.payload.cid}</p>`;
  }

  const sec = (title: string, body: string) => body ? `<div class="sec"><div class="sec-title">${title}</div>${body}</div>` : '';
  const row = (label: string, value: string) => value ? `<p><b>${label}:</b> ${value}</p>` : '';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Prontuário — ${patientName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#111;padding:40px;font-size:13px;line-height:1.7}
h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:18px}
.hdr{display:flex;justify-content:space-between;margin-bottom:20px}.doctor{font-size:14px;font-weight:bold}.sub{font-size:12px;color:#666;margin-top:2px}
.sec{margin-top:14px}.sec-title{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}
.note{font-style:italic;color:#666;font-size:12px;padding-left:10px}.rtn{margin-top:14px;padding:8px 12px;background:#fff8e1;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px}
@media print{body{padding:20px}}</style></head><body>
<h1>Prontuário — ${patientName}</h1>
<div class="hdr"><div><div class="doctor">${r.doctor?.full_name ? `Dr(a). ${r.doctor.full_name}` : 'Profissional de saúde'}</div>
<div class="sub">${[r.doctor?.specialty, r.clinic?.name].filter(Boolean).join(' · ')}</div></div>
<div class="sub">${format(parseISO(r.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div></div>
${row('Queixa', r.chief_complaint ?? '')}${row('Diagnóstico', r.diagnosis ?? '')}${row('Conduta', r.treatment_plan ?? '')}${row('Observações', r.notes ?? '')}
${sec('Prescrições', rxHtml)}${sec('Exames', examHtml)}${sec('Encaminhamentos', refHtml)}${sec('Atestados', certHtml)}
${r.follow_up_date ? `<p class="rtn">Retorno: ${format(parseISO(r.follow_up_date), "dd/MM/yyyy")}${r.follow_up_reason ? ' — ' + r.follow_up_reason : ''}</p>` : ''}
</body></html>`;
}

function printRecord(r: RecordData, patientName: string) {
  openPrintBlob(buildPrintHtml(r, patientName));
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    violet:  'bg-violet-50  text-violet-700  border-violet-200  dark:bg-violet-950/30  dark:text-violet-400  dark:border-violet-800',
    amber:   'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-950/30   dark:text-amber-400   dark:border-amber-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
}

function Empty({ icon: Icon, label }: { icon: typeof Calendar; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
      <Icon className="h-8 w-8 text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Archived files grid (shows doctor name + open button) ─────────────────────
const ACCENT_BG: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  violet:  'bg-violet-500/10  text-violet-600  dark:text-violet-400',
  amber:   'bg-amber-500/10   text-amber-600   dark:text-amber-400',
  sky:     'bg-sky-500/10     text-sky-600     dark:text-sky-400',
};

function ArchivedFilesGrid({ label, docs, openDoc, accent = 'violet' }: {
  label?: string;
  docs: any[];
  openDoc: (d: any) => void;
  accent?: 'emerald' | 'violet' | 'amber' | 'sky';
}) {
  const bg = ACCENT_BG[accent] ?? ACCENT_BG.violet;
  return (
    <div className="space-y-2 pt-2">
      {label && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-1">{label}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {docs.map((d: any) => {
          const dr = d.doctor;
          const drInitials = dr?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <button
              key={d.id}
              onClick={() => openDoc(d)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/40 transition-all text-left"
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={d.name}>{d.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {dr?.full_name ? `Dr(a). ${dr.full_name}` : 'Profissional'}
                  {' · '}{format(parseISO(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              {dr ? (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={dr.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                    {drInitials ?? <Stethoscope className="h-3 w-3 text-primary/60" />}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
