import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export async function generateCertificatePdf(data: CertificatePdfData) {
  const { mode, patient, dentist, clinic, notes, cid } = data;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const logoHtml = clinic?.logo_url ? `<img src="${await loadDataUrl(clinic.logo_url)}" style="max-height:60px;max-width:180px;object-fit:contain;" />` : '';
  const sigHtml = dentist.signature_url ? `<img src="${await loadDataUrl(dentist.signature_url)}" style="max-height:60px;object-fit:contain;" />` : '';

  let body = '';
  if (mode === 'attendance') {
    const dt = data.attendanceDate ? format(new Date(`${data.attendanceDate}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : today;
    body = `Atesto, para os devidos fins, que o(a) paciente <strong>${patient.full_name}</strong>${patient.cpf ? `, portador(a) do CPF <strong>${patient.cpf}</strong>,` : ''} esteve em atendimento odontológico em <strong>${dt}</strong>${data.startTime && data.endTime ? `, das <strong>${data.startTime}</strong> às <strong>${data.endTime}</strong>` : ''}.`;
  } else {
    const start = data.leaveStartDate ? format(new Date(`${data.leaveStartDate}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : today;
    body = `Atesto, para os devidos fins, que o(a) paciente <strong>${patient.full_name}</strong>${patient.cpf ? `, portador(a) do CPF <strong>${patient.cpf}</strong>,` : ''} necessita afastamento de suas atividades laborais por <strong>${data.leaveDays ?? 1} dia(s)</strong>, a partir de <strong>${start}</strong>, devido a tratamento odontológico.`;
  }

  const title = mode === 'attendance' ? 'ATESTADO DE COMPARECIMENTO' : 'ATESTADO MÉDICO-ODONTOLÓGICO';

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${title} - ${patient.full_name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.7;padding:50px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:16px;border-bottom:2px solid #2563eb}
  .clinic-info h1{font-size:18px;color:#1e40af;margin-bottom:4px}
  .clinic-info p{font-size:11px;color:#6b7280}
  .title{text-align:center;margin:40px 0 32px;font-size:20px;letter-spacing:2px;color:#1e40af;font-weight:700}
  .body{font-size:14px;text-align:justify;margin:0 auto;max-width:520px}
  .cid{margin-top:18px;font-size:12px;color:#6b7280}
  .notes{margin-top:18px;font-size:12px;color:#4b5563;font-style:italic}
  .signature{margin-top:80px;text-align:center}
  .signature .sig-img{margin-bottom:-10px;height:60px}
  .signature hr{border:none;border-top:1px solid #1a1a1a;width:320px;margin:0 auto 6px}
  .signature p{font-size:12px;font-weight:600}
  .signature .reg{font-size:11px;color:#6b7280;font-weight:400}
  .footer{margin-top:30px;text-align:center;font-size:11px;color:#6b7280}
  @media print{body{padding:30px}}
</style></head><body>
  <div class="header">
    <div class="clinic-info">
      <h1>${clinic?.name ?? 'Clínica'}</h1>
      ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}</p>` : ''}
      ${clinic?.address ? `<p>${clinic.address}${clinic.city ? ` - ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}</p>` : ''}
      ${clinic?.phone ? `<p>Tel: ${clinic.phone}</p>` : ''}
    </div>
    <div>${logoHtml}</div>
  </div>

  <div class="title">${title}</div>

  <div class="body">
    <p>${body}</p>
    ${cid ? `<p class="cid">CID-10: <strong>${cid}</strong></p>` : ''}
    ${notes ? `<p class="notes">${notes}</p>` : ''}
  </div>

  <div class="signature">
    ${sigHtml ? `<div class="sig-img">${sigHtml}</div>` : ''}
    <hr/>
    <p>${dentist.full_name}</p>
    <p class="reg">${dentist.registration_number ? `CRO/CRM ${dentist.registration_number}` : ''}${dentist.specialty ? ` · ${dentist.specialty}` : ''}</p>
  </div>

  <div class="footer">${clinic?.city ?? ''}${clinic?.city && clinic?.state ? '/' : ''}${clinic?.state ?? ''}, ${today}</div>
</body></html>`;

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