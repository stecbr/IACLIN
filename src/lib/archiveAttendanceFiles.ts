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
  medicalDraft?: MedicalDocumentsDraft | null;
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

  const { data: existing } = await supabase
    .from('documents')
    .select('id, file_url')
    .eq('patient_id', patientId)
    .eq('uploaded_by', userId)
    .eq('appointment_id', appointmentId)
    .eq('category', `doctor_file:${folderId}`)
    .eq('name', name);
  const existingPaths = (existing ?? []).map((d) => d.file_url).filter(Boolean);
  if (existingPaths.length) await supabase.storage.from(BUCKET).remove(existingPaths);
  if ((existing ?? []).length) await supabase.from('documents').delete().in('id', (existing ?? []).map((d) => d.id));

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
  });
  if (dbErr) throw dbErr;
}

export async function buildMedicalDocumentsHtml(args: {
  draft: MedicalDocumentsDraft;
  patient: { full_name: string; cpf?: string | null; date_of_birth?: string | null };
  professional: { full_name: string; registration_number?: string | null; specialty?: string | null; signature_url?: string | null };
  clinic: Awaited<ReturnType<typeof fetchClinicForAttendancePdf>>;
}): Promise<string | null> {
  const { draft, patient, professional, clinic } = args;
  const htmlStrings: string[] = [];

  const exams = (draft.exams ?? []).filter((e) => e.trim());
  if (exams.length) {
    htmlStrings.push(await buildExamRequestHtml({
      exams,
      clinicalIndication: draft.examIndication || undefined,
      patient,
      doctor: professional,
      clinic,
    }));
  }

  const rxItems = (draft.rxItems ?? []).filter((it) => it.medication?.trim());
  if (rxItems.length) {
    htmlStrings.push(await buildPrescriptionHtml({
      items: rxItems.map((it) => ({
        medication: it.medication ?? '',
        dosage: it.dosage ?? '',
        frequency: it.frequency ?? '',
        duration: it.duration ?? '',
        instructions: it.instructions || undefined,
      })),
      notes: draft.rxNotes || undefined,
      patient,
      dentist: professional,
      clinic,
    }));
  }

  if (draft.refSpecialty?.trim() && draft.refReason?.trim()) {
    htmlStrings.push(await buildReferralHtml({
      toSpecialty: draft.refSpecialty.trim(),
      reason: draft.refReason.trim(),
      summary: draft.refSummary?.trim() || undefined,
      urgency: draft.refUrgency ?? 'rotina',
      patient,
      doctor: professional,
      clinic,
    }));
  }

  if (draft.emitCert) {
    htmlStrings.push(await buildCertificateHtml({
      mode: draft.certMode ?? 'attendance',
      patient,
      dentist: professional,
      clinic,
      attendanceDate: (draft.certMode ?? 'attendance') === 'attendance' ? draft.certDate : undefined,
      startTime: (draft.certMode ?? 'attendance') === 'attendance' ? draft.certStart || undefined : undefined,
      endTime: (draft.certMode ?? 'attendance') === 'attendance' ? draft.certEnd || undefined : undefined,
      leaveStartDate: draft.certMode === 'leave' ? draft.leaveStart : undefined,
      leaveDays: draft.certMode === 'leave' ? (parseInt(draft.leaveDays ?? '1') || 1) : undefined,
      cid: draft.certCid?.trim() || undefined,
      notes: draft.certNotes || undefined,
    }));
  }

  if (!htmlStrings.length) return null;
  const parts = htmlStrings.map(extractHtmlParts);
  const bodyContent = parts.map((p, i) =>
    i < parts.length - 1 ? `<div style="page-break-after:always">${p.body}</div>` : p.body,
  ).join('\n');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Documentos Médicos</title><style>${parts.map(p => p.styles).join('\n')}</style></head><body>${bodyContent}</body></html>`;
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
  const { appointmentId, patientId, clinicId, userId, startTime, attendance, requests, medicalDraft } = args;
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

  // 2.1) Documentos Médicos vindos da aba Documentos (receituário/exames/encaminhamento/atestado)
  if (hasMedicalDocumentsDraft(medicalDraft)) {
    try {
      const html = await buildMedicalDocumentsHtml({ draft: medicalDraft, patient, professional: professionalForDocs, clinic });
      if (html) await uploadPdf(patientId, folderId!, 'documentos-medicos', 'Documentos Médicos.pdf', html, base);
    } catch (e: unknown) {
      failures.push(`Documentos Médicos: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2.1.b) Também salvar versões individuais por tipo (para classificação na tela do paciente)
    const draft = medicalDraft;
    const draftExams = (draft.exams ?? []).filter((e) => e.trim());
    if (draftExams.length) {
      try {
        const html = await buildExamRequestHtml({
          exams: draftExams,
          clinicalIndication: draft.examIndication || undefined,
          patient,
          doctor: professionalForDocs,
          clinic,
        });
        await uploadPdf(patientId, folderId!, 'solicitacao-exames-doc', 'Solicitação de Exames.pdf', html, base);
      } catch (e: unknown) {
        failures.push(`Exames (doc): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const draftRx = (draft.rxItems ?? []).filter((it) => it.medication?.trim());
    if (draftRx.length) {
      try {
        const html = await buildPrescriptionHtml({
          items: draftRx.map((it) => ({
            medication: it.medication ?? '',
            dosage: it.dosage ?? '',
            frequency: it.frequency ?? '',
            duration: it.duration ?? '',
            instructions: it.instructions || undefined,
          })),
          notes: draft.rxNotes || undefined,
          patient,
          dentist: professionalForDocs,
          clinic,
        });
        await uploadPdf(patientId, folderId!, 'receituario-doc', 'Receituário.pdf', html, base);
      } catch (e: unknown) {
        failures.push(`Receituário (doc): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (draft.refSpecialty?.trim() && draft.refReason?.trim()) {
      try {
        const html = await buildReferralHtml({
          toSpecialty: draft.refSpecialty.trim(),
          reason: draft.refReason.trim(),
          summary: draft.refSummary?.trim() || undefined,
          urgency: draft.refUrgency ?? 'rotina',
          patient,
          doctor: professionalForDocs,
          clinic,
        });
        const slug = `encaminhamento-doc-${draft.refSpecialty.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
        await uploadPdf(patientId, folderId!, slug, `Encaminhamento — ${draft.refSpecialty}.pdf`, html, base);
      } catch (e: unknown) {
        failures.push(`Encaminhamento (doc): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (draft.emitCert) {
      try {
        const html = await buildCertificateHtml({
          mode: draft.certMode ?? 'attendance',
          patient,
          dentist: professionalForDocs,
          clinic,
          attendanceDate: (draft.certMode ?? 'attendance') === 'attendance' ? draft.certDate : undefined,
          startTime: (draft.certMode ?? 'attendance') === 'attendance' ? draft.certStart || undefined : undefined,
          endTime: (draft.certMode ?? 'attendance') === 'attendance' ? draft.certEnd || undefined : undefined,
          leaveStartDate: draft.certMode === 'leave' ? draft.leaveStart : undefined,
          leaveDays: draft.certMode === 'leave' ? (parseInt(draft.leaveDays ?? '1') || 1) : undefined,
          cid: draft.certCid?.trim() || undefined,
          notes: draft.certNotes || undefined,
        });
        await uploadPdf(patientId, folderId!, 'atestado-doc', 'Atestado.pdf', html, base);
      } catch (e: unknown) {
        failures.push(`Atestado (doc): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 2) Resumo de atendimento (sempre)
  try {
    const html = await buildAttendanceHtml(attendance);
    await uploadPdf(patientId, folderId!, 'resumo-atendimento', 'Resumo de Atendimento.pdf', html, base);
  } catch (e: unknown) {
    failures.push(`Resumo: ${e instanceof Error ? e.message : String(e)}`);
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
    } catch (e: unknown) {
      failures.push(`Receituário: ${e instanceof Error ? e.message : String(e)}`);
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
    } catch (e: unknown) {
      failures.push(`Exames: ${e instanceof Error ? e.message : String(e)}`);
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
    } catch (e: unknown) {
      failures.push(`Encaminhamento: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { failures };
}