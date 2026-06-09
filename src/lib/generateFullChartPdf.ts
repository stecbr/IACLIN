import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface FullChartData {
  patient: any;
  clinic: any | null;
  anamnese: any | null;
  records: any[];
  odontogram: any[];
  map_entries: any[];
  documents: any[];
  issued_by?: string | null;
  issued_at?: string | null;
}

function strip(s?: string | null) { return (s ?? '').toString().trim(); }
function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function safeDate(d?: string | null, fmt = 'dd/MM/yyyy') {
  if (!d) return '';
  try { return format(new Date(d), fmt, { locale: ptBR }); } catch { return ''; }
}

const requestKindLabels: Record<string, string> = {
  exam: 'Solicitação de exames',
  lab_exam: 'Exames laboratoriais',
  imaging_exam: 'Exames de imagem',
  prescription: 'Prescrição',
  certificate: 'Atestado',
  referral: 'Encaminhamento',
};

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

function renderRecord(rec: any): string {
  const date = safeDate(rec.created_at, "dd/MM/yyyy 'às' HH:mm");
  const dentist = rec.dentist_name ? `<span class="muted">· ${rec.dentist_name}</span>` : '';
  const vitals = rec.vital_signs ?? {};
  const vitalsHtml = Object.keys(vitals).length
    ? `<div class="kv">${Object.entries(vitals)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `<span><b>${k}:</b> ${String(v)}</span>`).join('')}</div>`
    : '';
  const hypotheses = Array.isArray(rec.hypotheses) ? rec.hypotheses : [];
  const hypothesesHtml = hypotheses.length
    ? `<ul>${hypotheses.map((h: any) => `<li>${strip(h.text)}${h.cid ? ` <span class="muted">(${h.cid})</span>` : ''}</li>`).join('')}</ul>`
    : '';
  const procs = rec.clinical_record_procedures ?? [];
  const procsHtml = procs.length
    ? `<table><thead><tr><th>Procedimento</th><th>Dente</th><th>Face</th><th class="r">Valor</th></tr></thead><tbody>${procs
        .map((p: any) => `<tr><td>${strip(p.procedures?.name) || 'Procedimento'}</td><td>${p.tooth_number ?? '—'}</td><td>${strip(p.surface) || '—'}</td><td class="r">${formatCurrency(Number(p.price ?? 0))}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  const requests = rec.clinical_record_requests ?? [];
  const requestsHtml = requests.length
    ? requests.map((r: any) => {
        const items = Object.entries(r.payload || {})
          .filter(([, v]) => strip(v as string))
          .map(([k, v]) => `<li><b>${k}:</b> ${String(v)}</li>`).join('');
        return `<div class="card"><div class="card-title">${requestKindLabels[r.kind] ?? r.kind}</div><ul>${items}</ul></div>`;
      }).join('')
    : '';

  return `
    <div class="visit">
      <div class="visit-head"><h4>${date} ${dentist}</h4></div>
      ${strip(rec.chief_complaint) ? `<div class="row"><b>Queixa principal:</b> ${rec.chief_complaint}</div>` : ''}
      ${strip(rec.history_present_illness) ? `<div class="row"><b>HDA:</b> ${rec.history_present_illness}${rec.symptom_duration ? ` <span class="muted">(${rec.symptom_duration})</span>` : ''}</div>` : ''}
      ${strip(rec.physical_exam) ? `<div class="row"><b>Exame físico:</b> ${rec.physical_exam}</div>` : ''}
      ${vitalsHtml ? `<div class="row"><b>Sinais vitais:</b>${vitalsHtml}</div>` : ''}
      ${hypothesesHtml ? `<div class="row"><b>Hipóteses:</b>${hypothesesHtml}</div>` : ''}
      ${strip(rec.diagnosis) ? `<div class="row"><b>Diagnóstico:</b> ${rec.diagnosis}${rec.severity ? ` <span class="muted">· ${rec.severity}</span>` : ''}</div>` : ''}
      ${strip(rec.treatment_plan) ? `<div class="row"><b>Plano:</b> ${rec.treatment_plan}</div>` : ''}
      ${rec.follow_up_date ? `<div class="row"><b>Retorno:</b> ${safeDate(rec.follow_up_date)}${rec.follow_up_reason ? ` — ${rec.follow_up_reason}` : ''}</div>` : ''}
      ${strip(rec.notes) ? `<div class="row"><b>Evolução:</b> ${rec.notes}</div>` : ''}
      ${procsHtml ? `<div class="row"><b>Procedimentos realizados:</b>${procsHtml}</div>` : ''}
      ${requestsHtml ? `<div class="row"><b>Solicitações:</b>${requestsHtml}</div>` : ''}
    </div>
  `;
}

export async function buildFullChartHtml(data: FullChartData): Promise<string> {
  const { patient, clinic, anamnese, records, odontogram, map_entries, documents, issued_by, issued_at } = data;

  let logoHtml = '';
  if (clinic?.logo_url) {
    try {
      const dataUrl = await getLogoDataUrl(clinic.logo_url);
      if (dataUrl) logoHtml = `<img src="${dataUrl}" style="max-height:60px;max-width:180px;object-fit:contain;" />`;
    } catch { /* skip */ }
  }

  const issuedAt = issued_at ? safeDate(issued_at, "dd/MM/yyyy 'às' HH:mm") : safeDate(new Date().toISOString(), "dd/MM/yyyy 'às' HH:mm");

  const anamHtml = anamnese ? `
    <div class="grid">
      ${anamnese.blood_type ? `<div class="info-item"><label>Tipo sanguíneo</label><p>${anamnese.blood_type}</p></div>` : ''}
      ${strip(anamnese.allergies) ? `<div class="info-item"><label>Alergias</label><p>${anamnese.allergies}</p></div>` : ''}
      ${strip(anamnese.medical_conditions) ? `<div class="info-item"><label>Condições médicas</label><p>${anamnese.medical_conditions}</p></div>` : ''}
      ${strip(anamnese.medications) ? `<div class="info-item"><label>Medicações</label><p>${anamnese.medications}</p></div>` : ''}
      ${strip(anamnese.habits) ? `<div class="info-item"><label>Hábitos</label><p>${anamnese.habits}</p></div>` : ''}
      ${strip(anamnese.notes) ? `<div class="info-item full"><label>Observações</label><p>${anamnese.notes}</p></div>` : ''}
    </div>
  ` : '<p class="empty">Nenhuma anamnese cadastrada.</p>';

  const recordsHtml = (records ?? []).length
    ? records.map(renderRecord).join('')
    : '<p class="empty">Sem atendimentos registrados.</p>';

  const odontogramHtml = (odontogram ?? []).length
    ? `<table><thead><tr><th>Dente</th><th>Face</th><th>Condição</th><th>Notas</th></tr></thead><tbody>${odontogram
        .map((o: any) => `<tr><td>${o.tooth_number}</td><td>${strip(o.surface) || '—'}</td><td>${strip(o.condition) || '—'}</td><td>${strip(o.notes) || '—'}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

  const mapHtml = (map_entries ?? []).length
    ? `<table><thead><tr><th>Mapa</th><th>Região</th><th>Condição</th><th>Gravidade</th><th>Notas</th></tr></thead><tbody>${map_entries
        .map((m: any) => `<tr><td>${strip(m.map_type)}</td><td>${strip(m.region_code)}</td><td>${strip(m.condition)}</td><td>${strip(m.severity) || '—'}</td><td>${strip(m.notes) || '—'}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

  const docsHtml = (documents ?? []).length
    ? `<ul>${documents.map((d: any) => `<li>${strip(d.name)} <span class="muted">(${strip(d.category) || 'geral'} · ${safeDate(d.created_at)})</span></li>`).join('')}</ul>`
    : '';

  const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Prontuário — ${patient?.full_name ?? ''}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI', Arial, sans-serif; color:#1a1a1a; font-size:12px; line-height:1.55; padding:32px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #2563eb; margin-bottom:18px; }
.clinic-info h1 { font-size:17px; color:#1e40af; margin-bottom:4px; }
.clinic-info p { font-size:10.5px; color:#6b7280; }
h2.title { font-size:18px; color:#1e40af; margin-bottom:4px; }
.subtitle { font-size:11px; color:#9ca3af; margin-bottom:18px; }
.section { margin-bottom:20px; page-break-inside:avoid; }
.section h3 { font-size:12px; font-weight:700; color:#1e40af; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; padding-bottom:4px; border-bottom:1px solid #e5e7eb; }
.empty { color:#9ca3af; font-style:italic; font-size:12px; }
.muted { color:#9ca3af; font-size:11px; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
.grid .info-item.full { grid-column:1 / -1; }
.info-item label { font-size:10px; text-transform:uppercase; color:#9ca3af; letter-spacing:.5px; }
.info-item p { font-weight:500; }
ul { padding-left:18px; }
table { width:100%; border-collapse:collapse; margin-top:6px; }
thead th { background:#f3f4f6; font-size:10.5px; text-transform:uppercase; color:#6b7280; padding:6px 10px; text-align:left; border-bottom:2px solid #e5e7eb; }
tbody td { padding:7px 10px; border-bottom:1px solid #f3f4f6; font-size:11.5px; }
.r { text-align:right; }
.card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:8px 10px; margin-bottom:6px; }
.card-title { font-size:10.5px; font-weight:700; text-transform:uppercase; color:#1e40af; margin-bottom:4px; }
.visit { border:1px solid #e5e7eb; border-left:3px solid #2563eb; padding:12px 14px; margin-bottom:10px; border-radius:6px; page-break-inside:avoid; }
.visit-head h4 { font-size:12px; font-weight:700; color:#1e40af; margin-bottom:6px; }
.row { margin-bottom:4px; }
.kv { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:2px; }
.footer { margin-top:30px; padding-top:10px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; text-align:center; }
@media print { body { padding:20px; } }
</style></head><body>

<div class="header">
  <div class="clinic-info">
    <h1>${strip(clinic?.name) || 'Clínica'}</h1>
    ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}</p>` : ''}
    ${clinic?.address ? `<p>${clinic.address}${clinic.city ? ` - ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}</p>` : ''}
    ${clinic?.phone ? `<p>Tel: ${clinic.phone}</p>` : ''}
    ${clinic?.email ? `<p>${clinic.email}</p>` : ''}
  </div>
  <div>${logoHtml}</div>
</div>

<h2 class="title">Prontuário Eletrônico Completo</h2>
<p class="subtitle">Emitido em ${issuedAt}${issued_by ? ` · por ${issued_by}` : ''}</p>

<div class="section">
  <h3>Identificação do Paciente</h3>
  <div class="grid">
    <div class="info-item"><label>Nome</label><p>${strip(patient?.full_name)}</p></div>
    ${patient?.cpf ? `<div class="info-item"><label>CPF</label><p>${patient.cpf}</p></div>` : ''}
    ${patient?.date_of_birth ? `<div class="info-item"><label>Nascimento</label><p>${safeDate(patient.date_of_birth)}</p></div>` : ''}
    ${patient?.gender ? `<div class="info-item"><label>Gênero</label><p>${patient.gender}</p></div>` : ''}
    ${patient?.phone ? `<div class="info-item"><label>Telefone</label><p>${patient.phone}</p></div>` : ''}
    ${patient?.email ? `<div class="info-item"><label>E-mail</label><p>${patient.email}</p></div>` : ''}
    ${patient?.address ? `<div class="info-item full"><label>Endereço</label><p>${patient.address}${patient.city ? `, ${patient.city}` : ''}${patient.state ? ` - ${patient.state}` : ''}${patient.zip_code ? ` · CEP ${patient.zip_code}` : ''}</p></div>` : ''}
    ${patient?.insurance_provider ? `<div class="info-item"><label>Convênio</label><p>${patient.insurance_provider}${patient.insurance_number ? ` · ${patient.insurance_number}` : ''}</p></div>` : ''}
  </div>
</div>

<div class="section">
  <h3>Anamnese</h3>
  ${anamHtml}
</div>

<div class="section">
  <h3>Histórico de Atendimentos (${records?.length ?? 0})</h3>
  ${recordsHtml}
</div>

${odontogramHtml ? `<div class="section"><h3>Odontograma</h3>${odontogramHtml}</div>` : ''}
${mapHtml ? `<div class="section"><h3>Mapa Clínico</h3>${mapHtml}</div>` : ''}
${docsHtml ? `<div class="section"><h3>Documentos Anexos</h3>${docsHtml}</div>` : ''}

<div class="footer">
  Prontuário emitido por IACLIN — uso clínico restrito · ${issuedAt}
</div>

</body></html>`;
  return html;
}

export async function openFullChartPdf(data: FullChartData) {
  const html = await buildFullChartHtml(data);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
}

/** Loads all chart data for a patient using the authenticated client (clinic members). */
export async function fetchFullChartData(patientId: string): Promise<FullChartData> {
  try {
  const [
    { data: patient },
    { data: anamnese },
    { data: records },
    { data: odontogram },
    { data: mapEntries },
    { data: documents },
  ] = await Promise.all([
    supabase.from('patients').select('*').eq('id', patientId).maybeSingle(),
    supabase.from('anamneses').select('*').eq('patient_id', patientId)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('clinical_records')
      .select('*, clinical_record_procedures(*, procedures(name, code)), clinical_record_requests(*)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
    supabase.from('odontogram_entries').select('*').eq('patient_id', patientId)
      .order('updated_at', { ascending: false }),
    supabase.from('clinical_map_entries').select('*').eq('patient_id', patientId)
      .order('updated_at', { ascending: false }),
    supabase.from('documents').select('id, name, category, created_at').eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
  ]);

  const clinicId = (patient as any)?.clinic_id ?? null;
  const { data: clinic } = clinicId
    ? await supabase.from('clinics').select('name, phone, email, address, city, state, cnpj, logo_url').eq('id', clinicId).maybeSingle()
    : { data: null } as any;

  const dentistIds = Array.from(new Set((records ?? []).map((r: any) => r.dentist_id).filter(Boolean)));
  let dentistMap: Record<string, string> = {};
  if (dentistIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', dentistIds);
    for (const p of profs ?? []) dentistMap[p.id] = p.full_name ?? '';
  }

  return {
    patient,
    clinic,
    anamnese,
    records: (records ?? []).map((r: any) => ({ ...r, dentist_name: dentistMap[r.dentist_id] ?? null })),
    odontogram: odontogram ?? [],
    map_entries: mapEntries ?? [],
    documents: documents ?? [],
  };
  } catch (err: any) {
    throw new Error(`Erro ao carregar dados do prontuário: ${err?.message ?? 'tente novamente'}`);
  }
}