import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PrescriptionItem } from './prescriptionTemplates';

export interface PrescriptionPdfData {
  items: PrescriptionItem[];
  patient: {
    full_name: string;
    cpf?: string | null;
    date_of_birth?: string | null;
  };
  dentist: {
    full_name: string;
    registration_number?: string | null;
    specialty?: string | null;
    signature_url?: string | null;
  };
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
  notes?: string;
}

function loadDataUrl(url: string): Promise<string> {
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
    img.src = url;
  });
}

export async function generatePrescriptionPdf(data: PrescriptionPdfData) {
  const { items, patient, dentist, clinic, notes } = data;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const logoHtml = clinic?.logo_url ? `<img src="${await loadDataUrl(clinic.logo_url)}" style="max-height:60px;max-width:180px;object-fit:contain;" />` : '';
  const sigHtml = dentist.signature_url ? `<img src="${await loadDataUrl(dentist.signature_url)}" style="max-height:60px;object-fit:contain;" />` : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Receita - ${patient.full_name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.6;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2563eb}
  .clinic-info h1{font-size:18px;color:#1e40af;margin-bottom:4px}
  .clinic-info p{font-size:11px;color:#6b7280}
  .title{text-align:center;margin:24px 0;font-size:22px;letter-spacing:2px;color:#1e40af;font-weight:700}
  .patient-block{background:#f9fafb;padding:14px 18px;border-radius:8px;margin-bottom:20px}
  .patient-block label{font-size:10px;text-transform:uppercase;color:#9ca3af;letter-spacing:0.5px}
  .patient-block .name{font-size:15px;font-weight:600}
  .item{padding:14px 0;border-bottom:1px dashed #e5e7eb}
  .item:last-child{border-bottom:none}
  .item-num{display:inline-block;width:26px;height:26px;border-radius:50%;background:#1e40af;color:#fff;text-align:center;line-height:26px;font-weight:700;font-size:12px;margin-right:10px}
  .item-med{font-size:14px;font-weight:600;display:inline-block}
  .item-detail{margin-left:36px;color:#4b5563;font-size:13px;margin-top:4px}
  .item-instr{margin-left:36px;color:#6b7280;font-size:12px;font-style:italic;margin-top:4px}
  .notes{margin-top:24px;padding:14px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px}
  .signature{margin-top:60px;text-align:center}
  .signature .sig-img{margin-bottom:-10px;height:60px}
  .signature hr{border:none;border-top:1px solid #1a1a1a;width:300px;margin:0 auto 6px}
  .signature p{font-size:12px;font-weight:600}
  .signature .reg{font-size:11px;color:#6b7280;font-weight:400}
  .footer{margin-top:24px;text-align:center;font-size:10px;color:#9ca3af}
  @media print{body{padding:20px}}
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

  <div class="title">RECEITUÁRIO</div>

  <div class="patient-block">
    <label>Paciente</label>
    <p class="name">${patient.full_name}</p>
    ${patient.cpf ? `<p style="font-size:11px;color:#6b7280;margin-top:2px">CPF: ${patient.cpf}</p>` : ''}
  </div>

  <div>
    ${items.map((it, i) => `
      <div class="item">
        <div><span class="item-num">${i + 1}</span><span class="item-med">${it.medication}</span></div>
        <div class="item-detail">${it.dosage} — ${it.frequency} — por ${it.duration}</div>
        ${it.instructions ? `<div class="item-instr">${it.instructions}</div>` : ''}
      </div>`).join('')}
  </div>

  ${notes ? `<div class="notes"><strong>Observações:</strong> ${notes}</div>` : ''}

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