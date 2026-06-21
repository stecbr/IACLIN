import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { htmlToPdfBlob } from './htmlToPdfBlob';
import {
  buildAttendanceHtml,
  fetchClinicForAttendancePdf,
  fetchProfessionalForAttendancePdf,
  type AttendancePdfData,
} from './generateAttendancePdf';
import { buildPrescriptionHtml } from './generatePrescriptionPdf';
import { buildExamRequestHtml } from './generateExamRequestPdf';
import { buildReferralHtml } from './generateReferralPdf';
import { buildCertificateHtml } from './generateCertificatePdf';
import type { RequestItem } from '@/components/attendance/RequestsEditor';

interface Args {
  appointmentId: string;
  patientId: string;
  clinicId: string | null;
  userId: string;
  startTime: string;
  attendance: AttendancePdfData;
  requests: RequestItem[];
}

const BUCKET = 'patient-files';
const DOC_KINDS = ['doc_exam_request', 'doc_prescription', 'doc_referral', 'doc_certificate'];

export interface MedicalDocumentsDraft {
  exams?: string[];
  examIndication?: string;
  rxItems?: Array<{ medication?: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>;
  rxNotes?: string;
  refSpecialty?: string;
  refUrgency?: 'rotina' | 'prioritario' | 'emergencia';
  refReason?: string;
  refSummary?: string;
  emitCert?: boolean;
  certMode?: 'attendance' | 'leave';
  certDate?: string;
  certStart?: string;
  certEnd?: string;
  leaveStart?: string;
  leaveDays?: string;
  certCid?: string;
  certNotes?: string;
}

function extractHtmlParts(fullHtml: string): { styles: string; body: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, 'text/html');
  const styles = Array.from(doc.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n');
  return { styles, body: doc.body.innerHTML.trim() };
}

export function hasMedicalDocumentsDraft(draft: MedicalDocumentsDraft | null | undefined): draft is MedicalDocumentsDraft {
  if (!draft) return false;
  return Boolean(
    draft.exams?.some((e) => e?.trim()) ||
    draft.rxItems?.some((it) => it.medication?.trim()) ||
    (draft.refSpecialty?.trim() && draft.refReason?.trim()) ||
    draft.emitCert,
  );
}

/**
 * Cria (idempotente) a pasta da consulta nos documentos do paciente
 * e retorna seu id. Reusada por archiveAttendanceFiles e DocumentsTab.
 */
export async function ensureConsultationFolder(args: {
  patientId: string;
  userId: string;
  appointmentId: string;
  startTime: string;
}): Promise<string> {
  const { patientId, userId, appointmentId, startTime } = args;
  const folderName = `Consulta ${format(new Date(startTime), "dd/MM/yyyy 'às' HH:mm")}`;
  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('patient_id', patientId)
    .eq('uploaded_by', userId)
    .eq('file_type', 'folder')
    .eq('category', 'doctor_folder')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: ins, error: insErr } = await supabase
    .from('documents')
    .insert({
      patient_id: patientId,
      uploaded_by: userId,
      file_url: '',
      file_type: 'folder',
      category: 'doctor_folder',
      name: folderName,
      appointment_id: appointmentId,
    })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return ins.id;
}

/**
 * Gera PDF do HTML e arquiva como arquivo da pasta da consulta.
 */
export async function uploadPdfToFolder(args: {
  patientId: string;
  userId: string;
  appointmentId: string;
  folderId: string;
  slug: string;
  name: string;
  html: string;
}): Promise<void> {
  const { patientId, userId, appointmentId, folderId, slug, name, html } = args;
  const blob = await htmlToPdfBlob(html, `${slug}.pdf`);
  const path = `${patientId}/consultas/${folderId}/${Date.now()}-${slug}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('documents').insert({
    patient_id: patientId,
    uploaded_by: userId,
    appointment_id: appointmentId,
    name,
    file_url: path,
    file_type: 'application/pdf',
    category: `doctor_file:${folderId}`,
  } as any);
  if (dbErr) throw dbErr;
}

async function uploadPdf(
  patientId: string,
  folderId: string,
  slug: string,
  name: string,
  html: string,
  documentInsertBase: { patient_id: string; uploaded_by: string; appointment_id: string },
) {
  await uploadPdfToFolder({
    patientId,
    userId: documentInsertBase.uploaded_by,
    appointmentId: documentInsertBase.appointment_id,
    folderId,
    slug,
    name,
    html,
  });
}

/**
 * Cria (idempotente) uma pasta privada do médico para a consulta e arquiva
 * o resumo + receituário/exames/encaminhamentos como PDFs nessa pasta.
 * Falhas individuais não bloqueiam a finalização — só são reportadas no array.
 */
export async function archiveAttendanceFiles(args: Args): Promise<{ failures: string[] }> {
  const { appointmentId, patientId, clinicId, userId, startTime, attendance, requests } = args;
  const failures: string[] = [];

  // 1) Pasta — idempotente por appointment_id
  const folderId = await ensureConsultationFolder({ patientId, userId, appointmentId, startTime });

  const base = {
    patient_id: patientId,
    uploaded_by: userId,
    appointment_id: appointmentId,
  };

  // Fetch professional + clinic info (shared)
  const [clinic, prof] = await Promise.all([
    fetchClinicForAttendancePdf(clinicId),
    fetchProfessionalForAttendancePdf(userId, clinicId),
  ]);

  const patient = attendance.patient;
  const professionalForDocs = {
    full_name: prof?.full_name ?? 'Profissional',
    registration_number: prof?.registration_number ?? null,
    specialty: prof?.specialty ?? null,
    signature_url: null as string | null,
  };

  // 2) Resumo de atendimento (sempre)
  try {
    const html = await buildAttendanceHtml(attendance);
    await uploadPdf(patientId, folderId!, 'resumo-atendimento', 'Resumo de Atendimento.pdf', html, base);
  } catch (e: any) {
    failures.push(`Resumo: ${e.message ?? e}`);
  }

  // 3) Receituário (prescription)
  const prescriptions = requests.filter((r) => r.kind === 'prescription');
  if (prescriptions.length) {
    try {
      const html = await buildPrescriptionHtml({
        items: prescriptions.map((r) => {
          const p = r.payload ?? {};
          return {
            medication: [p.medication, p.concentration].filter(Boolean).join(' ').trim() || 'Medicamento',
            dosage: p.dosage ?? '',
            frequency: '',
            duration: p.duration ?? '',
            instructions: p.route && p.route !== 'oral' ? `Via ${p.route}` : undefined,
          };
        }),
        patient,
        dentist: professionalForDocs,
        clinic,
      });
      await uploadPdf(patientId, folderId!, 'receituario', 'Receituário.pdf', html, base);
    } catch (e: any) {
      failures.push(`Receituário: ${e.message ?? e}`);
    }
  }

  // 4) Solicitação de exames (lab_exam + imaging_exam)
  const exams = requests.filter((r) => r.kind === 'lab_exam' || r.kind === 'imaging_exam');
  if (exams.length) {
    try {
      const html = await buildExamRequestHtml({
        exams: exams.map((r) => {
          const p = r.payload ?? {};
          const name = p.name ?? '';
          const region = p.region ? ` — ${p.region}` : '';
          return name + region;
        }).filter(Boolean),
        clinicalIndication: exams.map((r) => r.payload?.justification).filter(Boolean).join(' | ') || undefined,
        patient,
        doctor: professionalForDocs,
        clinic,
      });
      await uploadPdf(patientId, folderId!, 'solicitacao-exames', 'Solicitação de Exames.pdf', html, base);
    } catch (e: any) {
      failures.push(`Exames: ${e.message ?? e}`);
    }
  }

  // 5) Encaminhamento (referral)
  const referrals = requests.filter((r) => r.kind === 'referral');
  for (const ref of referrals) {
    try {
      const p = ref.payload ?? {};
      const html = await buildReferralHtml({
        toSpecialty: p.specialty ?? '',
        reason: p.reason ?? '',
        urgency: p.urgency === 'urgent' ? 'prioritario' : 'rotina',
        patient,
        doctor: professionalForDocs,
        clinic,
      });
      const slug = `encaminhamento-${(p.specialty ?? 'geral').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
      await uploadPdf(patientId, folderId!, slug, `Encaminhamento — ${p.specialty || 'Especialidade'}.pdf`, html, base);
    } catch (e: any) {
      failures.push(`Encaminhamento: ${e.message ?? e}`);
    }
  }

  return { failures };
}