import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { registrationLabelForSpecialty } from '@/components/SpecialtySelect';

export interface ExamRequestPdfData {
  exams: string[];
  clinicalIndication?: string;
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

export async function generateExamRequestPdf(data: ExamRequestPdfData) {
  const { exams, clinicalIndication, patient, doctor, clinic } = data;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const logoHtml = clinic?.logo_url ? `<img src="${await loadDataUrl(clinic.logo_url)}" style="max-height:60px;max-width:180px;object-fit:contain;" />` : '';
  const sigHtml = doctor.signature_url ? `<img src="${await loadDataUrl(doctor.signature_url)}" style="max-height:60px;object-fit:contain;" />` : '';

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Solicitação de Exames - ${patient.full_name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.6;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2563eb}
.clinic-info h1{font-size:18px;color:#1e40af;margin-bottom:4px}
.clinic-info p{font-size:11px;color:#6b7280}
.title{text-align:center;margin:24px 0;font-size:22px;letter-spacing:2px;color:#1e40af;font-weight:700}
.patient-block{background:#f9fafb;padding:14px 18px;border-radius:8px;margin-bottom:20px}
.patient-block label{font-size:10px;text-transform:uppercase;color:#9ca3af}
.patient-block .name{font-size:15px;font-weight:600}
.exam-list{margin:18px 0;padding:0 8px}
.exam-list li{padding:8px 0;border-bottom:1px dashed #e5e7eb;list-style:none;display:flex;align-items:center;gap:10px}
.exam-list li::before{content:'';width:14px;height:14px;border:1.5px solid #1e40af;border-radius:3px;flex-shrink:0}
.indication{margin-top:18px;padding:12px;background:#eff6ff;border-left:3px solid #2563eb;border-radius:4px;font-size:12px}
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
<div class="title">SOLICITAÇÃO DE EXAMES</div>
<div class="patient-block">
  <label>Paciente</label>
  <p class="name">${patient.full_name}</p>
  ${patient.cpf ? `<p style="font-size:11px;color:#6b7280;margin-top:2px">CPF: ${patient.cpf}</p>` : ''}
</div>
<p style="font-size:12px;color:#374151;margin-bottom:8px"><strong>Solicito os seguintes exames:</strong></p>
<ul class="exam-list">
  ${exams.map((e) => `<li>${e}</li>`).join('')}
</ul>
${clinicalIndication ? `<div class="indication"><strong>Indicação clínica:</strong> ${clinicalIndication}</div>` : ''}
<div class="signature">
  ${sigHtml ? `<div class="sig-img">${sigHtml}</div>` : ''}
  <hr/>
  <p>${doctor.full_name}</p>
  <p class="reg">${doctor.registration_number ? `${registrationLabelForSpecialty(doctor.specialty)} ${doctor.registration_number}` : ''}${doctor.specialty ? ` · ${doctor.specialty}` : ''}</p>
</div>
<div class="footer">${clinic?.city ?? ''}${clinic?.city && clinic?.state ? '/' : ''}${clinic?.state ?? ''}, ${today}</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
}
