import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { registrationLabelForSpecialty } from '@/components/SpecialtySelect';

export interface CertificatePdfData {
  mode: 'attendance' | 'leave';
  patient: { full_name: string; cpf?: string | null };
  dentist: {
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
  // Attendance
  attendanceDate?: string; // yyyy-MM-dd
  startTime?: string; // HH:mm
  endTime?: string;
  // Leave
  leaveStartDate?: string;
  leaveDays?: number;
  cid?: string;
  notes?: string;
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

export async function buildCertificateHtml(data: CertificatePdfData): Promise<string> {
  const { mode, patient, dentist, clinic, notes, cid } = data;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const city = clinic?.city ?? '';
  const state = clinic?.state ?? '';
  const location = [city, state].filter(Boolean).join('/');

  const logoHtml = clinic?.logo_url
    ? `<img src="${await loadDataUrl(clinic.logo_url)}" style="max-height:56px;max-width:160px;object-fit:contain;" />`
    : '';
  const sigHtml = dentist.signature_url
    ? `<img src="${await loadDataUrl(dentist.signature_url)}" style="max-height:56px;object-fit:contain;display:block;margin:0 auto 4px;" />`
    : '';

  const regLabel = dentist.registration_number
    ? `${registrationLabelForSpecialty(dentist.specialty)} ${dentist.registration_number}`
    : '';

  const title = mode === 'attendance' ? 'Atestado de Comparecimento' : 'Atestado Médico';

  let bodyText = '';
  if (mode === 'attendance') {
    const dt = data.attendanceDate
      ? format(new Date(`${data.attendanceDate}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : today;
    const period = data.startTime && data.endTime ? `, das <strong>${data.startTime}</strong> às <strong>${data.endTime}</strong>` : '';
    bodyText = `Atesto, para os devidos fins, que o(a) paciente <strong>${patient.full_name}</strong>${patient.cpf ? `, portador(a) do CPF <strong>${patient.cpf}</strong>,` : ''} esteve em atendimento nesta clínica no dia <strong>${dt}</strong>${period}.`;
  } else {
    const start = data.leaveStartDate
      ? format(new Date(`${data.leaveStartDate}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : today;
    bodyText = `Atesto, para os devidos fins, que o(a) paciente <strong>${patient.full_name}</strong>${patient.cpf ? `, portador(a) do CPF <strong>${patient.cpf}</strong>,` : ''} necessita afastar-se de suas atividades laborais pelo período de <strong>${data.leaveDays ?? 1} dia(s)</strong>, a contar de <strong>${start}</strong>, em virtude de tratamento de saúde.`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${title} — ${patient.full_name}</title>
<style>
  @page { size: A4; margin: 0 }
  * { margin: 0; padding: 0; box-sizing: border-box }
  body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 13px; line-height: 1.65; background: #fff }
  .page { width: 210mm; min-height: 297mm; padding: 20mm 22mm 20mm 22mm; display: flex; flex-direction: column }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid #000; margin-bottom: 10px }
  .clinic-name { font-size: 15px; font-weight: 700; color: #000 }
  .clinic-sub { font-size: 10px; color: #000; margin-top: 2px; line-height: 1.4 }

  .title-strip { text-align: center; margin: 20px 0 28px; }
  .title-strip h1 { font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #000; padding-bottom: 6px; border-bottom: 2px solid #000; display: inline-block; padding: 4px 32px 6px }

  .body-text { font-size: 13.5px; line-height: 2; text-align: justify; max-width: 480px; margin: 0 auto }

  .cid-line { margin-top: 18px; font-size: 11px; color: #000; text-align: center }
  .notes-box { margin-top: 16px; padding: 8px 14px; border-left: 3px solid #000; background: #f5f5fb; font-size: 11px; font-style: italic; color: #000 }

  .sig-area { margin-top: 72px; text-align: center }
  .sig-line { border-top: 1px solid #000; width: 300px; margin: 0 auto 5px }
  .sig-name { font-size: 12px; font-weight: 700 }
  .sig-reg { font-size: 10px; color: #000; margin-top: 2px }

  .footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 9px; color: #000; font-family: Arial, sans-serif }

  @media print { html, body { width: 210mm } .page { padding: 16mm 20mm } }
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

  <div class="title-strip"><h1>${title}</h1></div>

  <div class="body-text"><p>${bodyText}</p></div>

  ${cid ? `<div class="cid-line">CID-10: <strong>${cid}</strong></div>` : ''}
  ${notes ? `<div class="notes-box">${notes}</div>` : ''}

  <div class="sig-area">
    ${sigHtml}
    <div class="sig-line"></div>
    <div class="sig-name">${dentist.full_name}</div>
    <div class="sig-reg">${[regLabel, dentist.specialty].filter(Boolean).join('  ·  ')}</div>
  </div>

  <div class="footer">
    <span>${location ? `${location}, ${today}` : today}</span>
    <span>Documento gerado eletronicamente</span>
  </div>

</div></body></html>`;

  return html;
}

export async function generateCertificatePdf(data: CertificatePdfData) {
  const html = await buildCertificateHtml(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => printWindow.print(), 300);
}

export const ODONTO_CIDS: Array<{ code: string; label: string }> = [
  { code: 'K02', label: 'Cárie dentária' },
  { code: 'K04', label: 'Doenças da polpa e dos tecidos periapicais' },
  { code: 'K05', label: 'Gengivite e doenças periodontais' },
  { code: 'K07', label: 'Anomalias dentofaciais (incluindo má oclusão)' },
  { code: 'K08', label: 'Outros transtornos dos dentes e estruturas de suporte' },
  { code: 'K12', label: 'Estomatite e lesões correlatas' },
  { code: 'S02.5', label: 'Fratura de dente' },
];
