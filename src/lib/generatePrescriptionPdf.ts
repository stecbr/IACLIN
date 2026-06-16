import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PrescriptionItem } from './prescriptionTemplates';
import { registrationLabelForSpecialty } from '@/components/SpecialtySelect';

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

export async function buildPrescriptionHtml(data: PrescriptionPdfData): Promise<string> {
  const { items, patient, dentist, clinic, notes } = data;
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

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Receituário — ${patient.full_name}</title>
<style>
  @page { size: A4; margin: 0 }
  * { margin: 0; padding: 0; box-sizing: border-box }
  body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 13px; line-height: 1.55; background: #fff }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 20mm 18mm 20mm; display: flex; flex-direction: column }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid #1a1a6e; margin-bottom: 10px }
  .clinic-name { font-size: 15px; font-weight: 700; color: #1a1a6e; letter-spacing: 0.3px }
  .clinic-sub { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.4 }

  /* Title strip */
  .title-strip { text-align: center; margin: 12px 0; padding: 6px 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc }
  .title-strip h1 { font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #1a1a6e }

  /* Patient */
  .patient-row { display: flex; gap: 12px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #ddd }
  .patient-field { flex: 1 }
  .field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; font-family: Arial, sans-serif }
  .field-value { font-size: 13px; font-weight: 600; margin-top: 1px }
  .field-value-sm { font-size: 11px; margin-top: 1px; color: #444 }

  /* Items */
  .items { flex: 1 }
  .item { padding: 9px 0; border-bottom: 1px dashed #ddd }
  .item:last-child { border-bottom: none }
  .item-header { display: flex; align-items: baseline; gap: 8px }
  .item-num { font-size: 12px; font-weight: 700; color: #1a1a6e; min-width: 18px }
  .item-med { font-size: 13px; font-weight: 700 }
  .item-dose { font-size: 12px; color: #333; margin-left: 26px; margin-top: 2px }
  .item-instr { font-size: 11px; color: #666; font-style: italic; margin-left: 26px; margin-top: 2px }

  /* Notes */
  .notes-box { margin-top: 14px; padding: 8px 12px; border-left: 3px solid #1a1a6e; background: #f5f5fb; font-size: 11px; color: #333 }

  /* Signature */
  .sig-area { margin-top: 48px; text-align: center }
  .sig-line { border-top: 1px solid #333; width: 280px; margin: 0 auto 5px }
  .sig-name { font-size: 12px; font-weight: 700 }
  .sig-reg { font-size: 10px; color: #666; margin-top: 2px }

  /* Footer */
  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 9px; color: #999; font-family: Arial, sans-serif }

  @media print { html, body { width: 210mm } .page { padding: 14mm 18mm } }
</style></head>
<body><div class="page">

  <div class="header">
    <div>
      <div class="clinic-name">${clinic?.name ?? 'Clínica'}</div>
      <div class="clinic-sub">
        ${clinic?.cnpj ? `CNPJ: ${clinic.cnpj}<br>` : ''}
        ${clinic?.address ? `${clinic.address}${clinic.city ? ` — ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}<br>` : ''}
        ${clinic?.phone ? `Tel: ${clinic.phone}` : ''}${clinic?.email ? ` · ${clinic.email}` : ''}
      </div>
    </div>
    <div>${logoHtml}</div>
  </div>

  <div class="title-strip"><h1>Receituário</h1></div>

  <div class="patient-row">
    <div class="patient-field">
      <div class="field-label">Paciente</div>
      <div class="field-value">${patient.full_name}</div>
    </div>
    ${patient.cpf ? `<div class="patient-field" style="max-width:160px"><div class="field-label">CPF</div><div class="field-value-sm">${patient.cpf}</div></div>` : ''}
    <div class="patient-field" style="max-width:130px">
      <div class="field-label">Data</div>
      <div class="field-value-sm">${today}</div>
    </div>
  </div>

  <div class="items">
    ${items.map((it, i) => `
      <div class="item">
        <div class="item-header">
          <span class="item-num">${i + 1}.</span>
          <span class="item-med">${it.medication}</span>
        </div>
        ${[it.dosage, it.frequency, it.duration ? `por ${it.duration}` : ''].filter(s => s?.trim()).length > 0
          ? `<div class="item-dose">${[it.dosage, it.frequency, it.duration ? `por ${it.duration}` : ''].filter(s => s?.trim()).join('  ·  ')}</div>`
          : ''}
        ${it.instructions ? `<div class="item-instr">→ ${it.instructions}</div>` : ''}
      </div>`).join('')}
  </div>

  ${notes ? `<div class="notes-box"><strong>Observações:</strong> ${notes}</div>` : ''}

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

export async function generatePrescriptionPdf(data: PrescriptionPdfData) {
  const html = await buildPrescriptionHtml(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => printWindow.print(), 300);
}
