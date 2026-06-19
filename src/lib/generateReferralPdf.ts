import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { registrationLabelForSpecialty } from '@/components/SpecialtySelect';

export interface ReferralPdfData {
  toSpecialty: string;
  reason: string;
  summary?: string;
  urgency?: 'rotina' | 'prioritario' | 'emergencia';
  patient: { full_name: string; cpf?: string | null };
  doctor: {
    full_name: string;
    registration_number?: string | null;
    specialty?: string | null;
    signature_url?: string | null;
  };
  clinic?: {
    name: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    cnpj?: string | null;
    logo_url?: string | null;
  } | null;
}

function loadDataUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
}

const URGENCY_LABEL: Record<NonNullable<ReferralPdfData['urgency']>, string> = {
  rotina: 'ROTINA',
  prioritario: 'PRIORITÁRIO',
  emergencia: 'EMERGÊNCIA',
};

const URGENCY_COLOR: Record<NonNullable<ReferralPdfData['urgency']>, string> = {
  rotina: '#000',
  prioritario: '#000',
  emergencia: '#000',
};

export async function buildReferralHtml(data: ReferralPdfData): Promise<string> {
  const { toSpecialty, reason, summary, urgency, patient, doctor, clinic } = data;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const city = clinic?.city ?? '';
  const state = clinic?.state ?? '';
  const location = [city, state].filter(Boolean).join('/');

  const logoHtml = clinic?.logo_url
    ? `<img src="${await loadDataUrl(clinic.logo_url)}" style="max-height:56px;max-width:160px;object-fit:contain;" />`
    : '';
  const sigHtml = doctor.signature_url
    ? `<img src="${await loadDataUrl(doctor.signature_url)}" style="max-height:56px;object-fit:contain;display:block;margin:0 auto 4px;" />`
    : '';

  const regLabel = doctor.registration_number
    ? `${registrationLabelForSpecialty(doctor.specialty)} ${doctor.registration_number}`
    : '';

  const urgColor = urgency ? URGENCY_COLOR[urgency] : '#1a1a6e';
  const urgBadge = urgency
    ? `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;padding:2px 10px;border:1px solid ${urgColor};color:${urgColor};border-radius:3px;font-family:Arial,sans-serif;margin-left:8px;">${URGENCY_LABEL[urgency]}</span>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Encaminhamento — ${patient.full_name}</title>
<style>
  @page { size: A4; margin: 0 }
  * { margin: 0; padding: 0; box-sizing: border-box }
  body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 13px; line-height: 1.6; background: #fff }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 20mm 18mm 20mm; display: flex; flex-direction: column }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid #000; margin-bottom: 10px }
  .clinic-name { font-size: 15px; font-weight: 700; color: #000 }
  .clinic-sub { font-size: 10px; color: #000; margin-top: 2px; line-height: 1.4 }

  .title-strip { text-align: center; margin: 14px 0; padding: 6px 0; border-top: 1px solid #000; border-bottom: 1px solid #000 }
  .title-strip h1 { font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #000 }

  .patient-row { display: flex; gap: 12px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #000 }
  .patient-field { flex: 1 }
  .field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #000; font-family: Arial, sans-serif }
  .field-value { font-size: 13px; font-weight: 600; margin-top: 1px }
  .field-value-sm { font-size: 11px; margin-top: 1px; color: #000 }

  .dest-box { background: #f0f0fa; border: 1px solid #000; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px }
  .dest-label { font-size: 9px; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.8px; color: #000; margin-bottom: 3px }
  .dest-value { font-size: 14px; font-weight: 700; color: #000 }

  .section { margin-bottom: 12px }
  .section-label { font-size: 10px; font-family: Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #000; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 2px }
  .section-text { font-size: 13px; text-align: justify; line-height: 1.7 }

  .courtesy { margin-top: 14px; font-size: 12px; font-style: italic; color: #000 }

  .sig-area { margin-top: 52px; text-align: center }
  .sig-line { border-top: 1px solid #000; width: 280px; margin: 0 auto 5px }
  .sig-name { font-size: 12px; font-weight: 700 }
  .sig-reg { font-size: 10px; color: #000; margin-top: 2px }

  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 9px; color: #000; font-family: Arial, sans-serif }

  @media print { html, body { width: 210mm } .page { padding: 14mm 18mm } }
</style></head>
<body><div class="page">

  <div class="header">
    <div>
      <div class="clinic-name">${clinic?.name ?? 'Clínica'}</div>
      <div class="clinic-sub">
        ${clinic?.cnpj ? `CNPJ: ${clinic.cnpj}<br>` : ''}
        ${clinic?.address ? `${clinic.address}${clinic.city ? ` — ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}<br>` : ''}
        ${clinic?.phone ? `Tel: ${clinic.phone}` : ''}
      </div>
    </div>
    <div>${logoHtml}</div>
  </div>

  <div class="title-strip"><h1>Encaminhamento Médico</h1></div>

  <div class="patient-row">
    <div class="patient-field">
      <div class="field-label">Paciente</div>
      <div class="field-value">${patient.full_name}</div>
    </div>
    ${patient.cpf ? `<div class="patient-field" style="max-width:150px"><div class="field-label">CPF</div><div class="field-value-sm">${patient.cpf}</div></div>` : ''}
    <div class="patient-field" style="max-width:130px">
      <div class="field-label">Data</div>
      <div class="field-value-sm">${today}</div>
    </div>
  </div>

  <div class="dest-box">
    <div class="dest-label">Encaminhado para${urgBadge}</div>
    <div class="dest-value">${toSpecialty}</div>
  </div>

  <div class="section">
    <div class="section-label">Motivo do Encaminhamento</div>
    <div class="section-text">${reason}</div>
  </div>

  ${summary ? `<div class="section"><div class="section-label">Resumo Clínico</div><div class="section-text">${summary}</div></div>` : ''}

  <div class="courtesy">
    <p>Prezados colegas, encaminho o(a) paciente supracitado(a) para avaliação e conduta em <strong>${toSpecialty}</strong>. Agradeço a atenção dispensada e coloco-me à disposição para informações complementares.</p>
  </div>

  <div class="sig-area">
    ${sigHtml}
    <div class="sig-line"></div>
    <div class="sig-name">${doctor.full_name}</div>
    <div class="sig-reg">${[regLabel, doctor.specialty].filter(Boolean).join('  ·  ')}</div>
  </div>

  <div class="footer">
    <span>${location ? `${location}, ${today}` : today}</span>
    <span>Documento gerado eletronicamente</span>
  </div>

</div></body></html>`;

  return html;
}

export async function generateReferralPdf(data: ReferralPdfData) {
  const html = await buildReferralHtml(data);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
}
