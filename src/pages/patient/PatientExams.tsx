import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Download, Loader2, Pill, MessageCircle, ClipboardList,
  FlaskConical, Upload, Trash2, Send, FileCheck2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePatientData, type DocumentRow } from '@/hooks/usePatientData';
import { generatePrescriptionPdf } from '@/lib/generatePrescriptionPdf';
import { generateExamRequestPdf } from '@/lib/generateExamRequestPdf';
import { generateReferralPdf } from '@/lib/generateReferralPdf';
import { generateCertificatePdf } from '@/lib/generateCertificatePdf';
import { registrationLabelForSpecialty } from '@/components/SpecialtySelect';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const EXAM_CATEGORIES = new Set(['image', 'exam', 'lab_exam', 'imaging_exam', 'exame', 'patient_exam']);
const PRESCRIPTION_CATEGORIES = new Set(['prescription', 'receita']);
const CERTIFICATE_CATEGORIES = new Set(['medical_certificate']);

// ── Urgency helpers ──────────────────────────────────────────────────────────
const URGENCY_PT: Record<string, string> = {
  routine: 'Rotina', urgent: 'Prioritário', emergency: 'Emergência',
  rotina: 'Rotina', prioritario: 'Prioritário', emergencia: 'Emergência',
};
const URGENCY_COLOR: Record<string, string> = {
  routine: 'border-blue-300 bg-blue-50 text-blue-700',
  urgent: 'border-amber-300 bg-amber-50 text-amber-700',
  emergency: 'border-red-300 bg-red-50 text-red-700',
  rotina: 'border-blue-300 bg-blue-50 text-blue-700',
  prioritario: 'border-amber-300 bg-amber-50 text-amber-700',
  emergencia: 'border-red-300 bg-red-50 text-red-700',
};
const URGENCY_PDF_MAP: Record<string, 'rotina' | 'prioritario' | 'emergencia'> = {
  routine: 'rotina', urgent: 'prioritario', emergency: 'emergencia',
  rotina: 'rotina', prioritario: 'prioritario', emergencia: 'emergencia',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface DentistInfo {
  full_name: string;
  registration_number: string | null;
  specialty: string | null;
  signature_url: string | null;
}
interface ClinicInfo {
  name: string; phone: string | null; address: string | null;
  city: string | null; state: string | null; cnpj: string | null; logo_url: string | null;
}
interface PatientInfo { full_name: string; cpf: string | null; date_of_birth: string | null; }

interface RxItemPayload {
  medication?: string; concentration?: string; dosage?: string;
  duration?: string; route?: string; type?: string; instructions?: string;
}

interface PrescriptionFromRecord {
  id: string;
  date: string;
  items: RxItemPayload[];
  dentist: DentistInfo | null;
  clinic: ClinicInfo | null;
  patient: PatientInfo | null;
}

interface DocPrescriptionItem {
  medication: string; dosage: string; frequency: string; duration: string; instructions?: string;
}
interface DocPrescriptionFromRecord {
  reqId: string; date: string;
  items: DocPrescriptionItem[]; notes?: string;
  dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null;
}

interface ExamRequestFromRecord {
  reqId: string; date: string;
  exams: string[]; indication?: string;
  dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null;
}

interface ReferralFromRecord {
  reqId: string; date: string;
  specialty: string; reason: string; summary?: string; urgency?: string;
  dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null;
}

interface CertificateFromRecord {
  reqId: string; date: string;
  mode: 'attendance' | 'leave';
  attendanceDate?: string; startTime?: string; endTime?: string;
  leaveStartDate?: string; leaveDays?: number; cid?: string; notes?: string;
  dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PatientExams() {
  const { documents, patientIds, loading } = usePatientData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const targetPatientId = patientIds[0];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user || !targetPatientId) {
      if (!targetPatientId) toast.error('Você ainda não está vinculado a uma clínica.');
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) { toast.error(`"${file.name}" excede o limite de 20 MB`); continue; }
        const ext = file.name.split('.').pop();
        const path = `${targetPatientId}/patient-uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('patient-files').upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from('documents').insert({
          patient_id: targetPatientId, name: file.name, file_url: path,
          file_type: file.type, category: 'patient_exam', uploaded_by: user.id,
        });
        if (dbErr) throw dbErr;
      }
      toast.success('Exame enviado para sua clínica.');
      queryClient.invalidateQueries({ queryKey: ['patient-data', user.id] });
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao enviar o arquivo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    try {
      await supabase.storage.from('patient-files').remove([doc.file_url]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast.success('Arquivo removido.');
      queryClient.invalidateQueries({ queryKey: ['patient-data', user?.id] });
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao remover.');
    }
  };

  const { data: recordDocs, isLoading: docsLoading } = useQuery({
    queryKey: ['patient-docs-from-records', patientIds.join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data: records } = await supabase
        .from('clinical_records')
        .select('id, created_at, dentist_id, clinic_id, patient_id, clinical_record_requests(id, kind, payload)')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false })
        .limit(100);

      const recs = records ?? [];
      const dentistIds = [...new Set(recs.map((r: any) => r.dentist_id).filter(Boolean))];
      const clinicIds  = [...new Set(recs.map((r: any) => r.clinic_id).filter(Boolean))];

      const profMap = new Map<string, any>();
      if (dentistIds.length > 0) {
        const { data: profs } = await supabase.from('profiles')
          .select('id, full_name, registration_number, specialty, signature_url').in('id', dentistIds);
        (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
      }
      const clinicMap = new Map<string, any>();
      if (clinicIds.length > 0) {
        const { data: clins } = await supabase.from('clinics')
          .select('id, name, phone, address, city, state, cnpj, logo_url').in('id', clinicIds);
        (clins ?? []).forEach((c: any) => clinicMap.set(c.id, c));
      }
      const patientMap = new Map<string, any>();
      {
        const { data: pats } = await supabase.from('patients')
          .select('id, full_name, cpf, date_of_birth').in('id', patientIds);
        (pats ?? []).forEach((p: any) => patientMap.set(p.id, p));
      }

      const prescriptions: PrescriptionFromRecord[] = [];
      const docPrescriptions: DocPrescriptionFromRecord[] = [];
      const examRequests: ExamRequestFromRecord[] = [];
      const referrals: ReferralFromRecord[] = [];
      const certificates: CertificateFromRecord[] = [];

      for (const r of recs as any[]) {
        const prof  = r.dentist_id ? profMap.get(r.dentist_id)  : null;
        const clin  = r.clinic_id  ? clinicMap.get(r.clinic_id)  : null;
        const pat   = r.patient_id ? patientMap.get(r.patient_id) : null;

        const dentist: DentistInfo | null = prof ? {
          full_name: prof.full_name ?? 'Médico(a)',
          registration_number: prof.registration_number ?? null,
          specialty: prof.specialty ?? null,
          signature_url: prof.signature_url ?? null,
        } : null;
        const clinic: ClinicInfo | null = clin ? {
          name: clin.name ?? 'Clínica', phone: clin.phone ?? null, address: clin.address ?? null,
          city: clin.city ?? null, state: clin.state ?? null, cnpj: clin.cnpj ?? null, logo_url: clin.logo_url ?? null,
        } : null;
        const patient: PatientInfo | null = pat ? {
          full_name: pat.full_name ?? '', cpf: pat.cpf ?? null, date_of_birth: pat.date_of_birth ?? null,
        } : null;

        const reqs: any[] = r.clinical_record_requests ?? [];

        // Prescriptions from RequestsEditor (kind='prescription')
        const rxReqs = reqs.filter((x: any) => x.kind === 'prescription');
        if (rxReqs.length > 0) {
          prescriptions.push({ id: r.id, date: r.created_at, items: rxReqs.map((x: any) => x.payload ?? {}), dentist, clinic, patient });
        }

        // Prescriptions from DocumentsTab (kind='doc_prescription')
        for (const req of reqs.filter((x: any) => x.kind === 'doc_prescription')) {
          const p = req.payload as any;
          docPrescriptions.push({ reqId: req.id, date: r.created_at, items: p.items ?? [], notes: p.notes || undefined, dentist, clinic, patient });
        }

        // Exam requests from DocumentsTab (kind='doc_exam_request')
        for (const req of reqs.filter((x: any) => x.kind === 'doc_exam_request')) {
          const p = req.payload as any;
          examRequests.push({ reqId: req.id, date: r.created_at, exams: p.exams ?? [], indication: p.indication || undefined, dentist, clinic, patient });
        }

        // Referrals: from RequestsEditor (kind='referral') + DocumentsTab (kind='doc_referral')
        for (const req of reqs.filter((x: any) => x.kind === 'referral' || x.kind === 'doc_referral')) {
          const p = req.payload as any;
          referrals.push({
            reqId: req.id, date: r.created_at,
            specialty: p.toSpecialty ?? p.specialty ?? '',
            reason: p.reason ?? '', summary: p.summary || undefined, urgency: p.urgency || undefined,
            dentist, clinic, patient,
          });
        }

        // Certificates from DocumentsTab (kind='doc_certificate')
        for (const req of reqs.filter((x: any) => x.kind === 'doc_certificate')) {
          const p = req.payload as any;
          certificates.push({
            reqId: req.id, date: r.created_at,
            mode: (p.mode ?? 'attendance') as 'attendance' | 'leave',
            attendanceDate: p.date || undefined, startTime: p.startTime || undefined, endTime: p.endTime || undefined,
            leaveStartDate: p.leaveStartDate || undefined,
            leaveDays: p.leaveDays ? (parseInt(String(p.leaveDays)) || undefined) : undefined,
            cid: p.cid || undefined, notes: p.notes || undefined,
            dentist, clinic, patient,
          });
        }
      }

      return { prescriptions, docPrescriptions, examRequests, referrals, certificates };
    },
  });

  const { exams, prescriptionDocs, certificateDocs, others } = useMemo(() => {
    const exams: DocumentRow[] = [];
    const prescriptionDocs: DocumentRow[] = [];
    const certificateDocs: DocumentRow[] = [];
    const others: DocumentRow[] = [];
    for (const d of documents) {
      const cat = (d.category ?? '').toLowerCase();
      if (PRESCRIPTION_CATEGORIES.has(cat)) prescriptionDocs.push(d);
      else if (EXAM_CATEGORIES.has(cat)) exams.push(d);
      else if (CERTIFICATE_CATEGORIES.has(cat)) certificateDocs.push(d);
      else others.push(d);
    }
    return { exams, prescriptionDocs, certificateDocs, others };
  }, [documents]);

  const prescriptions     = recordDocs?.prescriptions     ?? [];
  const docPrescriptions  = recordDocs?.docPrescriptions  ?? [];
  const examRequests      = recordDocs?.examRequests      ?? [];
  const referrals         = recordDocs?.referrals         ?? [];
  const certificates      = recordDocs?.certificates      ?? [];

  const totalRx   = prescriptionDocs.length + prescriptions.length + docPrescriptions.length;
  const totalExam = exams.length + examRequests.length;
  const totalRef  = referrals.length;
  const totalCert = certificateDocs.length + certificates.length;

  const defaultTab = totalExam > 0 ? 'exames'
    : totalRx > 0 ? 'receitas'
    : totalRef > 0 ? 'encaminhamentos'
    : totalCert > 0 ? 'atestados'
    : 'exames';

  const downloadDoc = async (doc: DocumentRow) => {
    try {
      const { data, error } = await supabase.storage.from('patient-files').createSignedUrl(doc.file_url, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Não foi possível gerar o link seguro.');
      window.open(doc.file_url, '_blank');
    }
  };

  if (loading || docsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Exames, receitas e documentos enviados pela sua clínica.</p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading || !targetPatientId}>
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Enviando…' : 'Enviar exame'}
        </Button>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="exames" className="flex-1 gap-1 min-w-fit">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Exames</span>
            {totalExam > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{totalExam}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="receitas" className="flex-1 gap-1 min-w-fit">
            <Pill className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Receitas</span>
            {totalRx > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{totalRx}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="encaminhamentos" className="flex-1 gap-1 min-w-fit">
            <Send className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Encaminh.</span>
            {totalRef > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{totalRef}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="atestados" className="flex-1 gap-1 min-w-fit">
            <FileCheck2 className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Atestados</span>
            {totalCert > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{totalCert}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="outros" className="flex-1 gap-1 min-w-fit">
            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Outros</span>
            {others.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{others.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Exames ── */}
        <TabsContent value="exames" className="mt-4 space-y-2">
          {totalExam === 0 ? (
            <EmptyTab icon={FlaskConical} title="Nenhum exame ainda" desc="Envie seus exames pelo botão acima ou aguarde a clínica anexar." />
          ) : (
            <>
              {examRequests.map((er) => <ExamRequestCard key={er.reqId} er={er} />)}
              {exams.map((d) => (
                <DocumentItem key={d.id} doc={d} onDownload={downloadDoc}
                  onDelete={d.category === 'patient_exam' ? handleDelete : undefined} />
              ))}
            </>
          )}
        </TabsContent>

        {/* ── Receitas ── */}
        <TabsContent value="receitas" className="mt-4 space-y-2">
          {totalRx === 0 ? (
            <EmptyTab icon={Pill} title="Nenhuma receita ainda" desc="As receitas prescritas pelo seu médico aparecerão aqui." />
          ) : (
            <>
              {prescriptions.map((rx) => <PrescriptionCard key={`rx-${rx.id}`} rx={rx} />)}
              {docPrescriptions.map((rx) => <DocPrescriptionCard key={`doc-rx-${rx.reqId}`} rx={rx} />)}
              {prescriptionDocs.map((d) => <DocumentItem key={d.id} doc={d} onDownload={downloadDoc} accent="rx" />)}
            </>
          )}
        </TabsContent>

        {/* ── Encaminhamentos ── */}
        <TabsContent value="encaminhamentos" className="mt-4 space-y-2">
          {totalRef === 0 ? (
            <EmptyTab icon={Send} title="Nenhum encaminhamento" desc="Encaminhamentos emitidos pelo seu médico aparecerão aqui." />
          ) : (
            referrals.map((ref) => <ReferralCard key={ref.reqId} referral={ref} />)
          )}
        </TabsContent>

        {/* ── Atestados ── */}
        <TabsContent value="atestados" className="mt-4 space-y-2">
          {totalCert === 0 ? (
            <EmptyTab icon={FileCheck2} title="Nenhum atestado" desc="Atestados emitidos pelo seu médico aparecerão aqui." />
          ) : (
            <>
              {certificates.map((cert) => <CertificateCard key={cert.reqId} cert={cert} />)}
              {certificateDocs.map((d) => <DocumentItem key={d.id} doc={d} onDownload={downloadDoc} accent="cert" />)}
            </>
          )}
        </TabsContent>

        {/* ── Outros ── */}
        <TabsContent value="outros" className="mt-4 space-y-2">
          {others.length === 0 ? (
            <EmptyTab icon={ClipboardList} title="Nenhum documento" desc="Outros arquivos enviados aparecerão aqui." />
          ) : (
            others.map((d) => <DocumentItem key={d.id} doc={d} onDownload={downloadDoc} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DocumentItem({ doc, onDownload, onDelete, accent }: {
  doc: DocumentRow; onDownload: (d: DocumentRow) => void;
  onDelete?: (d: DocumentRow) => void; accent?: 'rx' | 'cert';
}) {
  const Icon = accent === 'rx' ? Pill : accent === 'cert' ? FileCheck2 : FileText;
  const colorClass = accent === 'rx'
    ? 'bg-emerald-500/10 text-emerald-600'
    : accent === 'cert'
    ? 'bg-sky-500/10 text-sky-600'
    : 'bg-primary/10 text-primary';
  return (
    <div className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
      <button onClick={() => onDownload(doc)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{doc.name}</p>
            {doc.category === 'patient_exam' && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Enviado por você</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {doc.file_type && ` · ${doc.file_type}`}
          </p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
      {onDelete && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => onDelete(doc)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function ExamRequestCard({ er }: { er: ExamRequestFromRecord }) {
  const download = async () => {
    if (!er.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generateExamRequestPdf({
        exams: er.exams,
        clinicalIndication: er.indication,
        patient: er.patient,
        doctor: er.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null },
        clinic: er.clinic,
      });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar pedido.'); }
  };

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">Pedido de Exames</p>
              <Badge variant="secondary" className="text-[10px] h-5">{er.exams.length} {er.exams.length === 1 ? 'exame' : 'exames'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{format(parseISO(er.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            {er.dentist && <p className="text-xs text-muted-foreground mt-0.5">Dr(a). {er.dentist.full_name}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-violet-600 hover:bg-violet-500/10 flex-shrink-0" onClick={download}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
        <ul className="space-y-1 pl-1">
          {er.exams.map((exam, i) => (
            <li key={i} className="text-sm flex gap-2 items-start">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/10 text-violet-700 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
              <span>{exam}</span>
            </li>
          ))}
        </ul>
        {er.indication && <p className="text-xs text-muted-foreground pl-7">Indicação: {er.indication}</p>}
        <Button size="sm" className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Baixar pedido de exames
        </Button>
      </CardContent>
    </Card>
  );
}

function PrescriptionCard({ rx }: { rx: PrescriptionFromRecord }) {
  const dentistLine = rx.dentist
    ? [
        `Dr(a). ${rx.dentist.full_name}`,
        rx.dentist.registration_number
          ? `${registrationLabelForSpecialty(rx.dentist.specialty)} ${rx.dentist.registration_number}`
          : null,
      ].filter(Boolean).join(' · ')
    : null;

  const downloadPdf = async () => {
    if (!rx.patient) { toast.error('Não foi possível carregar os dados do paciente.'); return; }
    try {
      await generatePrescriptionPdf({
        items: rx.items.map((it) => ({
          medication: [it.medication, it.concentration].filter(Boolean).join(' ') || 'Medicamento',
          dosage: it.dosage ?? '', frequency: '',
          duration: it.duration ?? '',
          instructions: [it.route, it.instructions].filter(Boolean).join(' · ') || undefined,
        })) as any,
        patient: rx.patient,
        dentist: rx.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null },
        clinic: rx.clinic,
      });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar receituário.'); }
  };

  const shareWhatsApp = () => {
    const lines = rx.items.map((it, i) => {
      const med = [it.medication, it.concentration].filter(Boolean).join(' ');
      const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
      return `${i + 1}. ${med}${dose ? ' — ' + dose : ''}`;
    });
    const who = rx.dentist?.full_name ? ` (Dr(a). ${rx.dentist.full_name})` : '';
    const msg = `Minha receita${who} — ${format(parseISO(rx.date), 'dd/MM/yyyy')}:\n\n${lines.join('\n')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Pill className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">Receita médica</p>
              <Badge variant="secondary" className="text-[10px] h-5">{rx.items.length} {rx.items.length === 1 ? 'item' : 'itens'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{format(parseISO(rx.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            {dentistLine && <p className="text-xs text-muted-foreground mt-0.5">{dentistLine}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0" onClick={downloadPdf}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
        <ul className="space-y-1.5 pl-1">
          {rx.items.map((it, i) => {
            const med = [it.medication, it.concentration].filter(Boolean).join(' ');
            const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
            return (
              <li key={i}>
                <button type="button" onClick={downloadPdf}
                  className="w-full text-left flex gap-2 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{med || 'Medicamento'}</p>
                    {dose && <p className="text-xs text-muted-foreground">{dose}</p>}
                    {it.type === 'controlled' && <Badge variant="outline" className="text-[10px] mt-1">Controlada</Badge>}
                  </div>
                  <Download className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 mt-1" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-2" onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5" /> Baixar receituário
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={shareWhatsApp}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocPrescriptionCard({ rx }: { rx: DocPrescriptionFromRecord }) {
  const downloadPdf = async () => {
    if (!rx.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generatePrescriptionPdf({
        items: rx.items.map((it) => ({
          medication: it.medication,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
        })),
        notes: rx.notes,
        patient: rx.patient,
        dentist: rx.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null },
        clinic: rx.clinic,
      });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar receituário.'); }
  };

  const shareWhatsApp = () => {
    const lines = rx.items.map((it, i) => {
      const dose = [it.dosage, it.frequency, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' ');
      return `${i + 1}. ${it.medication}${dose ? ' — ' + dose : ''}`;
    });
    const who = rx.dentist?.full_name ? ` (Dr(a). ${rx.dentist.full_name})` : '';
    const msg = `Minha receita${who} — ${format(parseISO(rx.date), 'dd/MM/yyyy')}:\n\n${lines.join('\n')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Pill className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">Receita médica</p>
              <Badge variant="secondary" className="text-[10px] h-5">{rx.items.length} {rx.items.length === 1 ? 'item' : 'itens'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{format(parseISO(rx.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            {rx.dentist && <p className="text-xs text-muted-foreground mt-0.5">Dr(a). {rx.dentist.full_name}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-primary hover:bg-primary/10 flex-shrink-0" onClick={downloadPdf}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
        <ul className="space-y-1 pl-1">
          {rx.items.map((it, i) => {
            const dose = [it.dosage, it.frequency, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' · ');
            return (
              <li key={i} className="text-sm flex gap-2 items-start">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="font-medium">{it.medication}</p>
                  {dose && <p className="text-xs text-muted-foreground">{dose}</p>}
                  {it.instructions && <p className="text-xs text-muted-foreground">{it.instructions}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-2" onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5" /> Baixar receituário
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={shareWhatsApp}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard({ referral }: { referral: ReferralFromRecord }) {
  const download = async () => {
    if (!referral.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generateReferralPdf({
        toSpecialty: referral.specialty,
        reason: referral.reason,
        summary: referral.summary,
        urgency: referral.urgency ? URGENCY_PDF_MAP[referral.urgency] : undefined,
        patient: referral.patient,
        doctor: referral.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null },
        clinic: referral.clinic,
      });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar encaminhamento.'); }
  };

  const urgencyLabel = referral.urgency ? (URGENCY_PT[referral.urgency] ?? referral.urgency) : null;
  const urgencyColor = referral.urgency ? (URGENCY_COLOR[referral.urgency] ?? '') : '';

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Send className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">{referral.specialty || 'Encaminhamento'}</p>
              {urgencyLabel && (
                <Badge variant="outline" className={`text-[10px] h-5 ${urgencyColor}`}>{urgencyLabel}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{format(parseISO(referral.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            {referral.dentist && <p className="text-xs text-muted-foreground mt-0.5">Dr(a). {referral.dentist.full_name}</p>}
            {referral.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{referral.reason}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-amber-600 hover:bg-amber-500/10 flex-shrink-0" onClick={download}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
        <Button size="sm" className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Baixar encaminhamento
        </Button>
      </CardContent>
    </Card>
  );
}

function CertificateCard({ cert }: { cert: CertificateFromRecord }) {
  const download = async () => {
    if (!cert.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generateCertificatePdf({
        mode: cert.mode,
        attendanceDate: cert.attendanceDate,
        startTime: cert.startTime,
        endTime: cert.endTime,
        leaveStartDate: cert.leaveStartDate,
        leaveDays: cert.leaveDays,
        cid: cert.cid,
        notes: cert.notes,
        patient: cert.patient,
        dentist: cert.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null },
        clinic: cert.clinic,
      });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar atestado.'); }
  };

  const modeLabel = cert.mode === 'attendance' ? 'Comparecimento' : 'Afastamento';
  const dateInfo = cert.mode === 'attendance' && cert.attendanceDate
    ? format(parseISO(cert.attendanceDate), 'dd/MM/yyyy', { locale: ptBR })
    : cert.leaveStartDate
    ? `${cert.leaveDays ?? 1} dia(s) a partir de ${format(parseISO(cert.leaveStartDate), 'dd/MM/yyyy', { locale: ptBR })}`
    : null;

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center flex-shrink-0">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Atestado de {modeLabel}</p>
            <p className="text-xs text-muted-foreground">{format(parseISO(cert.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            {dateInfo && <p className="text-xs text-muted-foreground mt-0.5">{dateInfo}</p>}
            {cert.dentist && <p className="text-xs text-muted-foreground mt-0.5">Dr(a). {cert.dentist.full_name}</p>}
            {cert.cid && <p className="text-xs text-muted-foreground mt-0.5">CID: {cert.cid}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-sky-600 hover:bg-sky-500/10 flex-shrink-0" onClick={download}>
            <Download className="h-5 w-5" />
          </Button>
        </div>
        <Button size="sm" className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Baixar atestado
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyTab({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}
