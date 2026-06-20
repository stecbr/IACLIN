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

async function uploadPdf(
  patientId: string,
  folderId: string,
  slug: string,
  name: string,
  html: string,
  documentInsertBase: Record<string, unknown>,
) {
  const blob = await htmlToPdfBlob(html, `${slug}.pdf`);
  const path = `${patientId}/consultas/${folderId}/${Date.now()}-${slug}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw upErr;
  const row: any = {
    ...documentInsertBase,
    name,
    file_url: path,
    file_type: 'application/pdf',
    category: `doctor_file:${folderId}`,
  };
  const { error: dbErr } = await supabase.from('documents').insert(row);
  if (dbErr) throw dbErr;
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
  const folderName = `Consulta ${format(new Date(startTime), "dd/MM/yyyy 'às' HH:mm")}`;
  let folderId: string | null = null;
  {
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('patient_id', patientId)
      .eq('uploaded_by', userId)
      .eq('file_type', 'folder')
      .eq('category', 'doctor_folder')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (existing?.id) {
      folderId = existing.id;
    } else {
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
      folderId = ins.id;
    }
  }

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