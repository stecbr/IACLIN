import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AttendancePdfData {
  appointment: {
    start_time: string;
    procedures?: { name?: string | null } | null;
  };
  record: {
    chief_complaint?: string | null;
    history_present_illness?: string | null;
    symptom_duration?: string | null;
    physical_exam?: string | null;
    vital_signs?: Record<string, unknown> | null;
    hypotheses?: Array<{ text: string; cid?: string | null }> | null;
    diagnosis?: string | null;
    severity?: string | null;
    treatment_plan?: string | null;
    follow_up_date?: string | null;
    follow_up_reason?: string | null;
    notes?: string | null;
    procedures?: Array<{ name: string; tooth?: number | null; price?: number | null; notes?: string | null }>;
    requests?: Array<{ kind: string; payload: Record<string, unknown> }>;
  };
  patient: { full_name: string; cpf?: string | null; date_of_birth?: string | null };
  professional?: { full_name?: string | null; registration_number?: string | null; specialty?: string | null } | null;
  clinic?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    cnpj?: string | null;
    logo_url?: string | null;
  } | null;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getLogoDataUrl(logoUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = logoUrl;
  });
}

function strip(s?: string | null) {
  return (s ?? '').toString().trim();
}

const requestKindLabels: Record<string, string> = {
  exam: 'Solicitação de exames',
  prescription: 'Prescrição',
  certificate: 'Atestado',
  referral: 'Encaminhamento',
};

export async function buildAttendanceHtml(data: AttendancePdfData): Promise<string> {
  const { appointment, record, patient, professional, clinic } = data;
  const dateLabel = format(new Date(appointment.start_time), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  let logoHtml = '';
  if (clinic?.logo_url) {
    try {
      const dataUrl = await getLogoDataUrl(clinic.logo_url);
      if (dataUrl) logoHtml = `<img src="${dataUrl}" style="max-height:60px;max-width:180px;object-fit:contain;" />`;
    } catch { /* skip */ }
  }

  const vitals = record.vital_signs ?? {};
  const vitalsHtml = Object.keys(vitals).length
    ? `<ul>${Object.entries(vitals).map(([k, v]) => `<li><b>${k}:</b> ${String(v)}</li>`).join('')}</ul>`
    : '<p class="empty">Não informado</p>';

  const hypothesesHtml = (record.hypotheses ?? []).length
    ? `<ul>${(record.hypotheses ?? []).map((h) => `<li>${strip(h.text)}${h.cid ? ` <span class="muted">(${h.cid})</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="empty">Não informado</p>';

  // Só exibe a coluna "Dente" se algum procedimento tiver número de dente
  // registrado — evita coluna vazia em prontuários médicos/fisio/etc.
  const showTooth = (record.procedures ?? []).some((p) => p.tooth != null && p.tooth !== '');
  const procsHtml = (record.procedures ?? []).length
    ? `<table><thead><tr><th>Procedimento</th>${showTooth ? '<th>Dente</th>' : ''}<th>Obs</th><th class="r">Valor</th></tr></thead><tbody>${record.procedures!
        .map((p) => `<tr><td>${strip(p.name)}</td>${showTooth ? `<td>${p.tooth ?? '—'}</td>` : ''}<td>${strip(p.notes) || '—'}</td><td class="r">${formatCurrency(Number(p.price ?? 0))}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="empty">Nenhum procedimento</p>';

  const requestsHtml = (record.requests ?? []).length
    ? (record.requests ?? []).map((r) => {
        const items = Object.entries(r.payload || {})
          .filter(([, v]) => strip(v as string))
          .map(([k, v]) => `<li><b>${k}:</b> ${String(v)}</li>`).join('');
        return `<div class="card"><div class="card-title">${requestKindLabels[r.kind] ?? r.kind}</div><ul>${items}</ul></div>`;
      }).join('')
    : '';

  const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Atendimento — ${patient.full_name}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI', Arial, sans-serif; color:#1a1a1a; font-size:13px; line-height:1.55; padding:40px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:2px solid #2563eb; margin-bottom:24px; }
.clinic-info h1 { font-size:18px; color:#1e40af; margin-bottom:4px; }
.clinic-info p { font-size:11px; color:#6b7280; }
h2.title { font-size:18px; color:#1e40af; margin-bottom:4px; }
.subtitle { font-size:11px; color:#9ca3af; margin-bottom:18px; }
.section { margin-bottom:18px; }
.section h3 { font-size:12px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #e5e7eb; }
.section p { white-space:pre-wrap; }
.empty { color:#9ca3af; font-style:italic; font-size:12px; }
.muted { color:#9ca3af; font-size:11px; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
.info-item label { font-size:10px; text-transform:uppercase; color:#9ca3af; letter-spacing:.5px; }
.info-item p { font-weight:500; }
ul { padding-left:18px; }
table { width:100%; border-collapse:collapse; margin-top:6px; }
thead th { background:#f3f4f6; font-size:11px; text-transform:uppercase; color:#6b7280; padding:6px 10px; text-align:left; border-bottom:2px solid #e5e7eb; }
tbody td { padding:8px 10px; border-bottom:1px solid #f3f4f6; }
.r { text-align:right; }
.card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; margin-bottom:8px; }
.card-title { font-size:11px; font-weight:700; text-transform:uppercase; color:#1e40af; margin-bottom:4px; }
.signatures { display:flex; justify-content:space-between; margin-top:60px; }
.sig-line { width:220px; text-align:center; }
.sig-line hr { border:none; border-top:1px solid #1a1a1a; margin-bottom:6px; }
.sig-line p { font-size:11px; color:#6b7280; }
@media print { body { padding:20px; } }
</style></head><body>

<div class="header">
  <div class="clinic-info">
    <h1>${clinic?.name ?? 'Clínica'}</h1>
    ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}</p>` : ''}
    ${clinic?.address ? `<p>${clinic.address}${clinic.city ? ` - ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}</p>` : ''}
    ${clinic?.phone ? `<p>Tel: ${clinic.phone}</p>` : ''}
    ${clinic?.email ? `<p>${clinic.email}</p>` : ''}
  </div>
  <div>${logoHtml}</div>
</div>

<h2 class="title">Resumo de Atendimento</h2>
<p class="subtitle">${dateLabel}${appointment.procedures?.name ? ` · ${appointment.procedures.name}` : ''}</p>

<div class="section">
  <h3>Paciente</h3>
  <div class="grid">
    <div class="info-item"><label>Nome</label><p>${patient.full_name}</p></div>
    ${patient.cpf ? `<div class="info-item"><label>CPF</label><p>${patient.cpf}</p></div>` : ''}
    ${patient.date_of_birth ? `<div class="info-item"><label>Nascimento</label><p>${format(new Date(patient.date_of_birth), 'dd/MM/yyyy')}</p></div>` : ''}
    ${professional?.full_name ? `<div class="info-item"><label>Profissional</label><p>${professional.full_name}${professional.registration_number ? ` · ${professional.registration_number}` : ''}</p></div>` : ''}
  </div>
</div>

<div class="section"><h3>Queixa Principal</h3>${strip(record.chief_complaint) ? `<p>${record.chief_complaint}</p>` : '<p class="empty">Não informado</p>'}</div>
<div class="section"><h3>História da Doença Atual</h3>${strip(record.history_present_illness) ? `<p>${record.history_present_illness}${record.symptom_duration ? `<br/><span class="muted">Duração: ${record.symptom_duration}</span>` : ''}</p>` : '<p class="empty">Não informado</p>'}</div>
<div class="section"><h3>Exame Físico</h3>${strip(record.physical_exam) ? `<p>${record.physical_exam}</p>` : '<p class="empty">Não informado</p>'}</div>
<div class="section"><h3>Sinais Vitais</h3>${vitalsHtml}</div>
<div class="section"><h3>Hipóteses Diagnósticas</h3>${hypothesesHtml}</div>
<div class="section"><h3>Diagnóstico${record.severity ? ` · <span class="muted">${record.severity}</span>` : ''}</h3>${strip(record.diagnosis) ? `<p>${record.diagnosis}</p>` : '<p class="empty">Não informado</p>'}</div>
<div class="section"><h3>Conduta / Plano de Tratamento</h3>${strip(record.treatment_plan) ? `<p>${record.treatment_plan}</p>` : '<p class="empty">Não informado</p>'}</div>
${record.follow_up_date ? `<div class="section"><h3>Retorno</h3><p>${format(new Date(record.follow_up_date), 'dd/MM/yyyy')}${record.follow_up_reason ? ` — ${record.follow_up_reason}` : ''}</p></div>` : ''}
<div class="section"><h3>Procedimentos</h3>${procsHtml}</div>
${requestsHtml ? `<div class="section"><h3>Solicitações</h3>${requestsHtml}</div>` : ''}
${strip(record.notes) ? `<div class="section"><h3>Evolução / Anotações</h3><p>${record.notes}</p></div>` : ''}

<div class="signatures">
  <div class="sig-line"><hr/><p>${professional?.full_name ?? 'Profissional Responsável'}${professional?.registration_number ? `<br/>${professional.registration_number}` : ''}</p></div>
  <div class="sig-line"><hr/><p>${patient.full_name}</p></div>
</div>

</body></html>`;

  return html;
}

export async function generateAttendancePdf(data: AttendancePdfData) {
  const html = await buildAttendanceHtml(data);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
}

export async function fetchClinicForAttendancePdf(clinicId: string | null) {
  if (!clinicId) return null;
  const { data } = await supabase.from('clinics').select('name, phone, email, address, city, state, cnpj, logo_url').eq('id', clinicId).single();
  return data;
}

export async function fetchProfessionalForAttendancePdf(userId: string, clinicId: string | null) {
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  let registration: string | null = null;
  let specialty: string | null = null;
  if (clinicId) {
    const { data: m } = await supabase
      .from('clinic_members')
      .select('registration_number, specialty')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .maybeSingle();
    registration = m?.registration_number ?? null;
    specialty = m?.specialty ?? null;
  }
  return { full_name: profile?.full_name ?? null, registration_number: registration, specialty };
}