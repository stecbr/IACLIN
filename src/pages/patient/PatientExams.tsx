import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Download, Loader2, Pill, MessageCircle,
  FlaskConical, Upload, Trash2, Send, FileCheck2, FolderOpen,
  FileImage, File, Search, FileDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { openDocHistoryPdf, type DocHistoryEntry } from '@/lib/generateDocHistoryPdf';
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

const URGENCY_PT: Record<string, string> = {
  routine: 'Rotina', urgent: 'Prioritário', emergency: 'Emergência',
  rotina: 'Rotina', prioritario: 'Prioritário', emergencia: 'Emergência',
};
const URGENCY_COLOR: Record<string, string> = {
  routine: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  urgent: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  emergency: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  rotina: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  prioritario: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  emergencia: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
};
const URGENCY_PDF_MAP: Record<string, 'rotina' | 'prioritario' | 'emergencia'> = {
  routine: 'rotina', urgent: 'prioritario', emergency: 'emergencia',
  rotina: 'rotina', prioritario: 'prioritario', emergencia: 'emergencia',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface DentistInfo { full_name: string; registration_number: string | null; specialty: string | null; signature_url: string | null; }
interface ClinicInfo { name: string; phone: string | null; address: string | null; city: string | null; state: string | null; cnpj: string | null; logo_url: string | null; }
interface PatientInfo { full_name: string; cpf: string | null; date_of_birth: string | null; }
interface RxItemPayload { medication?: string; concentration?: string; dosage?: string; duration?: string; route?: string; type?: string; instructions?: string; }

interface PrescriptionFromRecord { id: string; date: string; items: RxItemPayload[]; dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null; }
interface DocPrescriptionItem { medication: string; dosage: string; frequency: string; duration: string; instructions?: string; }
interface DocPrescriptionFromRecord { reqId: string; date: string; items: DocPrescriptionItem[]; notes?: string; dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null; }
interface ExamRequestFromRecord { reqId: string; date: string; exams: string[]; indication?: string; dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null; }
interface ReferralFromRecord { reqId: string; date: string; specialty: string; reason: string; summary?: string; urgency?: string; dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null; }
interface CertificateFromRecord { reqId: string; date: string; mode: 'attendance' | 'leave'; attendanceDate?: string; startTime?: string; endTime?: string; leaveStartDate?: string; leaveDays?: number; cid?: string; notes?: string; dentist: DentistInfo | null; clinic: ClinicInfo | null; patient: PatientInfo | null; }

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PatientExams() {
  const { documents, patientIds, loading } = usePatientData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState('exames');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'all' | '30d' | '90d' | '180d' | '1y'>('all');
  const targetPatientId = patientIds[0];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user || !targetPatientId) { if (!targetPatientId) toast.error('Você ainda não está vinculado a uma clínica.'); return; }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) { toast.error(`"${file.name}" excede o limite de 20 MB`); continue; }
        const ext = file.name.split('.').pop();
        const path = `${targetPatientId}/patient-uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('patient-files').upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from('documents').insert({ patient_id: targetPatientId, name: file.name, file_url: path, file_type: file.type, category: 'patient_exam', uploaded_by: user.id });
        if (dbErr) throw dbErr;
      }
      toast.success('Exame enviado para sua clínica.');
      queryClient.invalidateQueries({ queryKey: ['patient-data', user.id] });
    } catch (err: any) { toast.error(err.message ?? 'Erro ao enviar o arquivo.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDelete = async (doc: DocumentRow) => {
    try {
      await supabase.storage.from('patient-files').remove([doc.file_url]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast.success('Arquivo removido.');
      queryClient.invalidateQueries({ queryKey: ['patient-data', user?.id] });
    } catch (err: any) { toast.error(err.message ?? 'Erro ao remover.'); }
  };

  const { data: recordDocs, isLoading: docsLoading } = useQuery({
    queryKey: ['patient-docs-from-records', patientIds.join(',')],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data: records } = await supabase
        .from('clinical_records')
        .select('id, created_at, dentist_id, clinic_id, patient_id, clinical_record_requests(id, kind, payload)')
        .in('patient_id', patientIds).order('created_at', { ascending: false }).limit(100);
      const recs = records ?? [];
      const dentistIds = [...new Set(recs.map((r: any) => r.dentist_id).filter(Boolean))];
      const clinicIds  = [...new Set(recs.map((r: any) => r.clinic_id).filter(Boolean))];
      const profMap = new Map<string, any>(); const clinicMap = new Map<string, any>(); const patientMap = new Map<string, any>();
      if (dentistIds.length > 0) { const { data: p } = await supabase.from('profiles').select('id, full_name, registration_number, specialty, signature_url').in('id', dentistIds); (p ?? []).forEach((x: any) => profMap.set(x.id, x)); }
      if (clinicIds.length > 0) { const { data: c } = await supabase.from('clinics').select('id, name, phone, address, city, state, cnpj, logo_url').in('id', clinicIds); (c ?? []).forEach((x: any) => clinicMap.set(x.id, x)); }
      { const { data: pa } = await supabase.from('patients').select('id, full_name, cpf, date_of_birth').in('id', patientIds); (pa ?? []).forEach((x: any) => patientMap.set(x.id, x)); }

      const prescriptions: PrescriptionFromRecord[] = [];
      const docPrescriptions: DocPrescriptionFromRecord[] = [];
      const examRequests: ExamRequestFromRecord[] = [];
      const referrals: ReferralFromRecord[] = [];
      const certificates: CertificateFromRecord[] = [];

      for (const r of recs as any[]) {
        const prof = r.dentist_id ? profMap.get(r.dentist_id) : null;
        const clin = r.clinic_id  ? clinicMap.get(r.clinic_id) : null;
        const pat  = r.patient_id ? patientMap.get(r.patient_id) : null;
        const dentist: DentistInfo | null = prof ? { full_name: prof.full_name ?? 'Médico(a)', registration_number: prof.registration_number ?? null, specialty: prof.specialty ?? null, signature_url: prof.signature_url ?? null } : null;
        const clinic: ClinicInfo | null = clin ? { name: clin.name ?? 'Clínica', phone: clin.phone ?? null, address: clin.address ?? null, city: clin.city ?? null, state: clin.state ?? null, cnpj: clin.cnpj ?? null, logo_url: clin.logo_url ?? null } : null;
        const patient: PatientInfo | null = pat ? { full_name: pat.full_name ?? '', cpf: pat.cpf ?? null, date_of_birth: pat.date_of_birth ?? null } : null;
        const reqs: any[] = r.clinical_record_requests ?? [];

        const rxReqs = reqs.filter((x: any) => x.kind === 'prescription');
        if (rxReqs.length > 0) prescriptions.push({ id: r.id, date: r.created_at, items: rxReqs.map((x: any) => x.payload ?? {}), dentist, clinic, patient });

        for (const req of reqs.filter((x: any) => x.kind === 'doc_prescription')) {
          const p = req.payload as any;
          docPrescriptions.push({ reqId: req.id, date: r.created_at, items: p.items ?? [], notes: p.notes || undefined, dentist, clinic, patient });
        }
        for (const req of reqs.filter((x: any) => x.kind === 'doc_exam_request')) {
          const p = req.payload as any;
          examRequests.push({ reqId: req.id, date: r.created_at, exams: p.exams ?? [], indication: p.indication || undefined, dentist, clinic, patient });
        }
        for (const req of reqs.filter((x: any) => x.kind === 'referral' || x.kind === 'doc_referral')) {
          const p = req.payload as any;
          referrals.push({ reqId: req.id, date: r.created_at, specialty: p.toSpecialty ?? p.specialty ?? '', reason: p.reason ?? '', summary: p.summary || undefined, urgency: p.urgency || undefined, dentist, clinic, patient });
        }
        for (const req of reqs.filter((x: any) => x.kind === 'doc_certificate')) {
          const p = req.payload as any;
          certificates.push({ reqId: req.id, date: r.created_at, mode: (p.mode ?? 'attendance') as 'attendance' | 'leave', attendanceDate: p.date || undefined, startTime: p.startTime || undefined, endTime: p.endTime || undefined, leaveStartDate: p.leaveStartDate || undefined, leaveDays: p.leaveDays ? (parseInt(String(p.leaveDays)) || undefined) : undefined, cid: p.cid || undefined, notes: p.notes || undefined, dentist, clinic, patient });
        }
      }
      return { prescriptions, docPrescriptions, examRequests, referrals, certificates };
    },
  });

  const { exams, prescriptionDocs, certificateDocs, others } = useMemo(() => {
    const exams: DocumentRow[] = [], prescriptionDocs: DocumentRow[] = [], certificateDocs: DocumentRow[] = [], others: DocumentRow[] = [];
    for (const d of documents) {
      const cat = (d.category ?? '').toLowerCase();
      if (PRESCRIPTION_CATEGORIES.has(cat)) prescriptionDocs.push(d);
      else if (EXAM_CATEGORIES.has(cat)) exams.push(d);
      else if (CERTIFICATE_CATEGORIES.has(cat)) certificateDocs.push(d);
      else others.push(d);
    }
    return { exams, prescriptionDocs, certificateDocs, others };
  }, [documents]);

  const prescriptions    = recordDocs?.prescriptions    ?? [];
  const docPrescriptions = recordDocs?.docPrescriptions ?? [];
  const examRequests     = recordDocs?.examRequests     ?? [];
  const referrals        = recordDocs?.referrals        ?? [];
  const certificates     = recordDocs?.certificates     ?? [];

  const periodCutoff = useMemo<Date | null>(() => {
    if (period === 'all') return null;
    const d = new Date();
    if (period === '30d')  d.setDate(d.getDate() - 30);
    if (period === '90d')  d.setDate(d.getDate() - 90);
    if (period === '180d') d.setDate(d.getDate() - 180);
    if (period === '1y')   d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [period]);

  const filteredExamRequests = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return examRequests.filter(er => {
      if (cutoff && parseISO(er.date) < cutoff) return false;
      if (q) { const t = [...er.exams, er.dentist?.full_name ?? '', er.indication ?? ''].join(' ').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
  }, [examRequests, periodCutoff, search]);

  const filteredPrescriptions = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return prescriptions.filter(rx => {
      if (cutoff && parseISO(rx.date) < cutoff) return false;
      if (q) { const t = [...rx.items.map(i => i.medication ?? ''), rx.dentist?.full_name ?? ''].join(' ').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
  }, [prescriptions, periodCutoff, search]);

  const filteredDocPrescriptions = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return docPrescriptions.filter(rx => {
      if (cutoff && parseISO(rx.date) < cutoff) return false;
      if (q) { const t = [...rx.items.map(i => i.medication), rx.dentist?.full_name ?? ''].join(' ').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
  }, [docPrescriptions, periodCutoff, search]);

  const filteredReferrals = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return referrals.filter(ref => {
      if (cutoff && parseISO(ref.date) < cutoff) return false;
      if (q) { const t = [ref.specialty, ref.reason, ref.dentist?.full_name ?? ''].join(' ').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
  }, [referrals, periodCutoff, search]);

  const filteredCertificates = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return certificates.filter(cert => {
      if (cutoff && parseISO(cert.date) < cutoff) return false;
      if (q) { const t = [cert.mode, cert.cid ?? '', cert.dentist?.full_name ?? ''].join(' ').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
  }, [certificates, periodCutoff, search]);

  const filteredExams = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return exams.filter(d => {
      if (cutoff && parseISO(d.created_at) < cutoff) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exams, periodCutoff, search]);

  const filteredPrescriptionDocs = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return prescriptionDocs.filter(d => {
      if (cutoff && parseISO(d.created_at) < cutoff) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prescriptionDocs, periodCutoff, search]);

  const filteredCertificateDocs = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return certificateDocs.filter(d => {
      if (cutoff && parseISO(d.created_at) < cutoff) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [certificateDocs, periodCutoff, search]);

  const filteredOthers = useMemo(() => {
    const cutoff = periodCutoff; const q = search.toLowerCase();
    return others.filter(d => {
      if (cutoff && parseISO(d.created_at) < cutoff) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [others, periodCutoff, search]);

  const counts = {
    exames: filteredExams.length + filteredExamRequests.length,
    receitas: filteredPrescriptionDocs.length + filteredPrescriptions.length + filteredDocPrescriptions.length,
    encaminhamentos: filteredReferrals.length,
    atestados: filteredCertificateDocs.length + filteredCertificates.length,
    outros: filteredOthers.length,
  };

  const navSections = [
    { id: 'exames',           label: 'Exames',            icon: FlaskConical },
    { id: 'receitas',         label: 'Receitas',          icon: Pill },
    { id: 'encaminhamentos',  label: 'Encaminhamentos',   icon: Send },
    { id: 'atestados',        label: 'Atestados',         icon: FileCheck2 },
    { id: 'outros',           label: 'Outros',            icon: FolderOpen },
  ] as const;

  const downloadDoc = async (doc: DocumentRow) => {
    try {
      const { data, error } = await supabase.storage.from('patient-files').createSignedUrl(doc.file_url, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch { toast.error('Não foi possível gerar o link.'); window.open(doc.file_url, '_blank'); }
  };

  const downloadHistory = () => {
    try {
      const patientName =
        prescriptions[0]?.patient?.full_name ??
        examRequests[0]?.patient?.full_name ??
        certificates[0]?.patient?.full_name ?? null;

      const entries: DocHistoryEntry[] = [
        ...filteredPrescriptions.map(rx => ({
          type: 'receita' as const, date: rx.date, doctor: rx.dentist?.full_name,
          details: rx.items.map(i => [i.medication, (i as any).concentration].filter(Boolean).join(' ')),
        })),
        ...filteredDocPrescriptions.map(rx => ({
          type: 'receita' as const, date: rx.date, doctor: rx.dentist?.full_name,
          details: rx.items.map(i => i.medication),
        })),
        ...filteredExamRequests.map(er => ({
          type: 'exame' as const, date: er.date, doctor: er.dentist?.full_name,
          details: er.exams, extra: er.indication ?? null,
        })),
        ...filteredReferrals.map(ref => ({
          type: 'encaminhamento' as const, date: ref.date, doctor: ref.dentist?.full_name,
          details: [ref.specialty], extra: ref.reason,
        })),
        ...filteredCertificates.map(cert => ({
          type: 'atestado' as const, date: cert.date, doctor: cert.dentist?.full_name,
          details: [cert.mode === 'attendance' ? 'Comparecimento' : `Afastamento — ${cert.leaveDays ?? 1} dia(s)`],
          extra: cert.cid ? `CID: ${cert.cid}` : null,
        })),
        ...[...filteredExams, ...filteredPrescriptionDocs, ...filteredCertificateDocs, ...filteredOthers].map(d => ({
          type: 'arquivo' as const, date: d.created_at, details: [d.name],
        })),
      ];

      if (entries.length === 0) { toast.info('Nenhum documento encontrado para os filtros selecionados.'); return; }
      openDocHistoryPdf({ patientName, entries });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao gerar histórico.');
    }
  };

  if (loading || docsLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Exames, receitas e documentos da sua clínica.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadHistory}>
            <FileDown className="h-3.5 w-3.5" />
            Baixar histórico
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading || !targetPatientId}>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Enviando…' : 'Enviar exame'}
          </Button>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
      </div>

      {/* Busca + período */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar por nome, medicamento, médico…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-8 text-sm border border-input rounded-md px-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={period}
          onChange={e => setPeriod(e.target.value as typeof period)}
        >
          <option value="all">Todo período</option>
          <option value="30d">Último mês</option>
          <option value="90d">Últimos 3 meses</option>
          <option value="180d">Últimos 6 meses</option>
          <option value="1y">Último ano</option>
        </select>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
        <nav className="flex md:flex-col gap-1 md:w-52 overflow-x-auto md:overflow-x-visible shrink-0 pb-2 md:pb-0">
          {navSections.map((s) => {
            const count = counts[s.id];
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
                {count > 0 && (
                  <Badge variant="secondary" className={`ml-auto h-5 px-1.5 text-[10px] ${activeSection === s.id ? 'bg-primary/20 text-primary' : ''}`}>
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'exames' && (
            <SectionWrapper empty={counts.exames === 0} icon={FlaskConical} emptyTitle="Nenhum exame encontrado" emptyDesc="Tente ajustar a busca ou o período, ou envie um exame pelo botão acima.">
              {filteredExamRequests.length > 0 && (
                <DocGrid label={filteredExams.length > 0 ? 'Pedidos de exames' : undefined}>
                  {filteredExamRequests.map((er) => <ExamRequestCard key={er.reqId} er={er} />)}
                </DocGrid>
              )}
              {filteredExams.length > 0 && (
                <DocGrid label={filteredExamRequests.length > 0 ? 'Arquivos' : undefined}>
                  {filteredExams.map((d) => <DriveFileCard key={d.id} doc={d} onDownload={downloadDoc} onDelete={d.category === 'patient_exam' ? handleDelete : undefined} />)}
                </DocGrid>
              )}
            </SectionWrapper>
          )}

          {activeSection === 'receitas' && (
            <SectionWrapper empty={counts.receitas === 0} icon={Pill} emptyTitle="Nenhuma receita encontrada" emptyDesc="Tente ajustar a busca ou o período.">
              {filteredPrescriptions.length > 0 && (
                <DocGrid>
                  {filteredPrescriptions.map((rx) => <PrescriptionCard key={`rx-${rx.id}`} rx={rx} />)}
                </DocGrid>
              )}
              {filteredDocPrescriptions.length > 0 && (
                <DocGrid>
                  {filteredDocPrescriptions.map((rx) => <DocPrescriptionCard key={`doc-rx-${rx.reqId}`} rx={rx} />)}
                </DocGrid>
              )}
              {filteredPrescriptionDocs.length > 0 && (
                <DocGrid label="Arquivos">
                  {filteredPrescriptionDocs.map((d) => <DriveFileCard key={d.id} doc={d} onDownload={downloadDoc} accent="rx" />)}
                </DocGrid>
              )}
            </SectionWrapper>
          )}

          {activeSection === 'encaminhamentos' && (
            <SectionWrapper empty={counts.encaminhamentos === 0} icon={Send} emptyTitle="Nenhum encaminhamento encontrado" emptyDesc="Tente ajustar a busca ou o período.">
              <DocGrid>
                {filteredReferrals.map((ref) => <ReferralCard key={ref.reqId} referral={ref} />)}
              </DocGrid>
            </SectionWrapper>
          )}

          {activeSection === 'atestados' && (
            <SectionWrapper empty={counts.atestados === 0} icon={FileCheck2} emptyTitle="Nenhum atestado encontrado" emptyDesc="Tente ajustar a busca ou o período.">
              {filteredCertificates.length > 0 && (
                <DocGrid>
                  {filteredCertificates.map((cert) => <CertificateCard key={cert.reqId} cert={cert} />)}
                </DocGrid>
              )}
              {filteredCertificateDocs.length > 0 && (
                <DocGrid label={filteredCertificates.length > 0 ? 'Arquivos' : undefined}>
                  {filteredCertificateDocs.map((d) => <DriveFileCard key={d.id} doc={d} onDownload={downloadDoc} accent="cert" />)}
                </DocGrid>
              )}
            </SectionWrapper>
          )}

          {activeSection === 'outros' && (
            <SectionWrapper empty={counts.outros === 0} icon={FolderOpen} emptyTitle="Nenhum documento encontrado" emptyDesc="Tente ajustar a busca ou o período.">
              <DocGrid>
                {filteredOthers.map((d) => <DriveFileCard key={d.id} doc={d} onDownload={downloadDoc} />)}
              </DocGrid>
            </SectionWrapper>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Layout helpers ───────────────────────────────────────────────────────────

function SectionWrapper({ children, empty, icon: Icon, emptyTitle, emptyDesc }: {
  children?: React.ReactNode; empty: boolean; icon: any; emptyTitle: string; emptyDesc: string;
}) {
  if (empty) {
    return (
      <Card>
        <CardContent className="p-10 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">{emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{emptyDesc}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return <div className="space-y-5">{children}</div>;
}

function DocGrid({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}

// ── Drive-style file card ────────────────────────────────────────────────────

function getFileVisuals(doc: DocumentRow, accent?: 'rx' | 'cert') {
  if (accent === 'rx')   return { bg: 'bg-emerald-500/10', icon: <Pill className="h-7 w-7 text-emerald-600" /> };
  if (accent === 'cert') return { bg: 'bg-sky-500/10',     icon: <FileCheck2 className="h-7 w-7 text-sky-600" /> };
  const t = doc.file_type ?? '';
  if (t.startsWith('image/')) return { bg: 'bg-green-500/10',  icon: <FileImage className="h-7 w-7 text-green-600" /> };
  if (t === 'application/pdf') return { bg: 'bg-red-500/10',   icon: <FileText className="h-7 w-7 text-red-500" /> };
  return { bg: 'bg-primary/10', icon: <File className="h-7 w-7 text-primary/60" /> };
}

function DriveFileCard({ doc, onDownload, onDelete, accent }: { doc: DocumentRow; onDownload: (d: DocumentRow) => void; onDelete?: (d: DocumentRow) => void; accent?: 'rx' | 'cert'; }) {
  const { bg, icon } = getFileVisuals(doc, accent);
  const ext = doc.name.split('.').pop()?.toUpperCase() ?? '';
  return (
    <div
      className="group relative flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden select-none"
      onClick={() => onDownload(doc)}
    >
      {/* Preview area */}
      <div className={`h-28 flex items-center justify-center ${bg} relative`}>
        {icon}
        {ext && (
          <span className="absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/50 leading-none">
            {ext}
          </span>
        )}
        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="h-6 w-6 rounded-md bg-background/90 border border-border/50 flex items-center justify-center shadow-sm hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); onDownload(doc); }}
          >
            <Download className="h-3 w-3" />
          </button>
          {onDelete && (
            <button
              className="h-6 w-6 rounded-md bg-background/90 border border-border/50 flex items-center justify-center shadow-sm hover:bg-destructive hover:text-white text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {/* Info */}
      <div className="p-2.5 flex-1">
        <p className="text-xs font-medium truncate leading-snug" title={doc.name}>{doc.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(doc.created_at), "dd MMM yyyy", { locale: ptBR })}</p>
        {doc.category === 'patient_exam' && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 mt-1 leading-none">Enviado por você</Badge>
        )}
      </div>
    </div>
  );
}

// ── Medical record cards (drive-inspired, 2-col grid) ────────────────────────

function ExamRequestCard({ er }: { er: ExamRequestFromRecord }) {
  const download = async () => {
    if (!er.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generateExamRequestPdf({ exams: er.exams, clinicalIndication: er.indication, patient: er.patient, doctor: er.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null }, clinic: er.clinic });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar pedido.'); }
  };
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all overflow-hidden cursor-default">
      <div className="h-20 bg-violet-500/10 flex items-center gap-3 px-4 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
          <FlaskConical className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-700 dark:text-violet-300 truncate">Pedido de Exames</p>
          <p className="text-xs text-violet-500/80">{er.exams.length} exame{er.exams.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={download} className="h-7 w-7 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 flex items-center justify-center text-violet-600 dark:text-violet-400 transition-colors shrink-0">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{format(parseISO(er.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
          {er.dentist && <span className="truncate ml-2 max-w-[120px]">{er.dentist.full_name}</span>}
        </div>
        <ul className="space-y-0.5">
          {er.exams.slice(0, 4).map((exam, i) => (
            <li key={i} className="text-xs text-foreground/80 truncate flex gap-1.5 items-start">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
              {exam}
            </li>
          ))}
          {er.exams.length > 4 && <p className="text-[10px] text-muted-foreground">+{er.exams.length - 4} exame{er.exams.length - 4 > 1 ? 's' : ''}</p>}
        </ul>
        {er.indication && <p className="text-[10px] text-muted-foreground italic truncate">Indicação: {er.indication}</p>}
        <Button size="sm" className="w-full h-7 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white mt-1" onClick={download}>
          <Download className="h-3 w-3" /> Baixar PDF
        </Button>
      </div>
    </div>
  );
}

function PrescriptionCard({ rx }: { rx: PrescriptionFromRecord }) {
  const dentistLine = rx.dentist ? [`Dr(a). ${rx.dentist.full_name}`, rx.dentist.registration_number ? `${registrationLabelForSpecialty(rx.dentist.specialty)} ${rx.dentist.registration_number}` : null].filter(Boolean).join(' · ') : null;
  const downloadPdf = async () => {
    if (!rx.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generatePrescriptionPdf({ items: rx.items.map((it) => ({ medication: [it.medication, it.concentration].filter(Boolean).join(' ') || 'Medicamento', dosage: it.dosage ?? '', frequency: '', duration: it.duration ?? '', instructions: [it.route, it.instructions].filter(Boolean).join(' · ') || undefined })) as any, patient: rx.patient, dentist: rx.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null }, clinic: rx.clinic });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar receituário.'); }
  };
  const shareWhatsApp = () => {
    const lines = rx.items.map((it, i) => { const med = [it.medication, it.concentration].filter(Boolean).join(' '); const dose = [it.dosage, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' '); return `${i + 1}. ${med}${dose ? ' — ' + dose : ''}`; });
    const who = rx.dentist?.full_name ? ` (Dr(a). ${rx.dentist.full_name})` : '';
    window.open(`https://wa.me/?text=${encodeURIComponent(`Minha receita${who} — ${format(parseISO(rx.date), 'dd/MM/yyyy')}:\n\n${lines.join('\n')}`)}`, '_blank');
  };
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all overflow-hidden cursor-default">
      <div className="h-20 bg-emerald-500/10 flex items-center gap-3 px-4 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Pill className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">Receita médica</p>
          <p className="text-xs text-emerald-500/80">{rx.items.length} {rx.items.length === 1 ? 'item' : 'itens'}</p>
        </div>
        <button onClick={downloadPdf} className="h-7 w-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-colors shrink-0">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>{format(parseISO(rx.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
          {dentistLine && <p className="truncate">{dentistLine}</p>}
        </div>
        <ul className="space-y-0.5">
          {rx.items.slice(0, 3).map((it, i) => {
            const med = [it.medication, it.concentration].filter(Boolean).join(' ');
            return <li key={i} className="text-xs text-foreground/80 truncate flex gap-1.5 items-start"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />{med || 'Medicamento'}</li>;
          })}
          {rx.items.length > 3 && <p className="text-[10px] text-muted-foreground">+{rx.items.length - 3} iten{rx.items.length - 3 > 1 ? 's' : ''}</p>}
        </ul>
        <div className="flex gap-1.5 mt-1">
          <Button size="sm" className="flex-1 h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={downloadPdf}><Download className="h-3 w-3" /> PDF</Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs" onClick={shareWhatsApp}><MessageCircle className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  );
}

function DocPrescriptionCard({ rx }: { rx: DocPrescriptionFromRecord }) {
  const downloadPdf = async () => {
    if (!rx.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generatePrescriptionPdf({ items: rx.items.map((it) => ({ medication: it.medication, dosage: it.dosage, frequency: it.frequency, duration: it.duration, instructions: it.instructions })), notes: rx.notes, patient: rx.patient, dentist: rx.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null }, clinic: rx.clinic });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar receituário.'); }
  };
  const shareWhatsApp = () => {
    const lines = rx.items.map((it, i) => { const dose = [it.dosage, it.frequency, it.duration ? `por ${it.duration}` : ''].filter(Boolean).join(' '); return `${i + 1}. ${it.medication}${dose ? ' — ' + dose : ''}`; });
    const who = rx.dentist?.full_name ? ` (Dr(a). ${rx.dentist.full_name})` : '';
    window.open(`https://wa.me/?text=${encodeURIComponent(`Minha receita${who} — ${format(parseISO(rx.date), 'dd/MM/yyyy')}:\n\n${lines.join('\n')}`)}`, '_blank');
  };
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all overflow-hidden cursor-default">
      <div className="h-20 bg-emerald-500/10 flex items-center gap-3 px-4 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Pill className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">Receita médica</p>
          <p className="text-xs text-emerald-500/80">{rx.items.length} {rx.items.length === 1 ? 'item' : 'itens'}</p>
        </div>
        <button onClick={downloadPdf} className="h-7 w-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-colors shrink-0">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>{format(parseISO(rx.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
          {rx.dentist && <p className="truncate">Dr(a). {rx.dentist.full_name}</p>}
        </div>
        <ul className="space-y-0.5">
          {rx.items.slice(0, 3).map((it, i) => (
            <li key={i} className="text-xs text-foreground/80 truncate flex gap-1.5 items-start">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              {it.medication}
            </li>
          ))}
          {rx.items.length > 3 && <p className="text-[10px] text-muted-foreground">+{rx.items.length - 3} iten{rx.items.length - 3 > 1 ? 's' : ''}</p>}
        </ul>
        <div className="flex gap-1.5 mt-1">
          <Button size="sm" className="flex-1 h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={downloadPdf}><Download className="h-3 w-3" /> PDF</Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs" onClick={shareWhatsApp}><MessageCircle className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  );
}

function ReferralCard({ referral }: { referral: ReferralFromRecord }) {
  const download = async () => {
    if (!referral.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generateReferralPdf({ toSpecialty: referral.specialty, reason: referral.reason, summary: referral.summary, urgency: referral.urgency ? URGENCY_PDF_MAP[referral.urgency] : undefined, patient: referral.patient, doctor: referral.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null }, clinic: referral.clinic });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar encaminhamento.'); }
  };
  const urgencyLabel = referral.urgency ? URGENCY_PT[referral.urgency] : null;
  const urgencyColor = referral.urgency ? URGENCY_COLOR[referral.urgency] : '';
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 transition-all overflow-hidden cursor-default">
      <div className="h-20 bg-amber-500/10 flex items-center gap-3 px-4 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <Send className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 truncate">{referral.specialty || 'Encaminhamento'}</p>
          {urgencyLabel && <Badge variant="outline" className={`text-[9px] h-4 px-1.5 mt-0.5 font-medium ${urgencyColor}`}>{urgencyLabel}</Badge>}
        </div>
        <button onClick={download} className="h-7 w-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-colors shrink-0">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>{format(parseISO(referral.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
          {referral.dentist && <p className="truncate">Dr(a). {referral.dentist.full_name}</p>}
        </div>
        {referral.reason && <p className="text-xs text-foreground/80 line-clamp-2">{referral.reason}</p>}
        <Button size="sm" className="w-full h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white mt-1" onClick={download}>
          <Download className="h-3 w-3" /> Baixar PDF
        </Button>
      </div>
    </div>
  );
}

function CertificateCard({ cert }: { cert: CertificateFromRecord }) {
  const download = async () => {
    if (!cert.patient) { toast.error('Dados do paciente não disponíveis.'); return; }
    try {
      await generateCertificatePdf({ mode: cert.mode, attendanceDate: cert.attendanceDate, startTime: cert.startTime, endTime: cert.endTime, leaveStartDate: cert.leaveStartDate, leaveDays: cert.leaveDays, cid: cert.cid, notes: cert.notes, patient: cert.patient, dentist: cert.dentist ?? { full_name: 'Médico(a)', registration_number: null, specialty: null, signature_url: null }, clinic: cert.clinic });
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao gerar atestado.'); }
  };
  const modeLabel = cert.mode === 'attendance' ? 'Comparecimento' : 'Afastamento';
  const dateInfo = cert.mode === 'attendance' && cert.attendanceDate
    ? format(parseISO(cert.attendanceDate), 'dd/MM/yyyy', { locale: ptBR })
    : cert.leaveStartDate
    ? `${cert.leaveDays ?? 1} dia(s) — ${format(parseISO(cert.leaveStartDate), 'dd/MM/yyyy', { locale: ptBR })}`
    : null;
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card hover:shadow-md hover:border-sky-200 dark:hover:border-sky-800 transition-all overflow-hidden cursor-default">
      <div className="h-20 bg-sky-500/10 flex items-center gap-3 px-4 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
          <FileCheck2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-300 truncate">Atestado de {modeLabel}</p>
          {dateInfo && <p className="text-xs text-sky-500/80 truncate">{dateInfo}</p>}
        </div>
        <button onClick={download} className="h-7 w-7 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 flex items-center justify-center text-sky-600 dark:text-sky-400 transition-colors shrink-0">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <p>{format(parseISO(cert.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
          {cert.dentist && <p className="truncate">Dr(a). {cert.dentist.full_name}</p>}
          {cert.cid && <p>CID: {cert.cid}</p>}
        </div>
        {cert.notes && <p className="text-xs text-foreground/80 line-clamp-2">{cert.notes}</p>}
        <Button size="sm" className="w-full h-7 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white mt-1" onClick={download}>
          <Download className="h-3 w-3" /> Baixar PDF
        </Button>
      </div>
    </div>
  );
}
