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

export async function buildExamRequestHtml(data: ExamRequestPdfData): Promise<string> {
  const { exams, clinicalIndication, patient, doctor, clinic } = data;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const logoHtml = clinic?.logo_url ? `<img src="${await loadDataUrl(clinic.logo_url)}" style="max-height:60px;max-width:180px;object-fit:contain;" />` : '';
  const sigHtml = doctor.signature_url ? `<img src="${await loadDataUrl(doctor.signature_url)}" style="max-height:60px;object-fit:contain;" />` : '';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Solicitação de Exames - ${patient.full_name}</title>
<style>
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;color:#111;font-size:13px;line-height:1.6;background:#fff}
.page{width:210mm;min-height:297mm;padding:18mm 20mm;display:flex;flex-direction:column}
.ex-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1a1a6e}
.ex-clinic-name{font-size:15px;font-weight:700;color:#1a1a6e}
.ex-clinic-sub{font-size:10px;color:#555;margin-top:2px;line-height:1.4}
.ex-title{text-align:center;margin:16px 0;font-size:16px;letter-spacing:3px;color:#1a1a6e;font-weight:700;padding:6px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc}
.ex-patient{background:#f5f5fb;padding:12px 16px;border-radius:6px;margin-bottom:18px}
.ex-patient-label{font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#888;font-family:Arial,sans-serif}
.ex-patient-name{font-size:14px;font-weight:600;margin-top:2px}
.ex-list{margin:14px 0;flex:1}
.ex-list li{padding:7px 0;border-bottom:1px dashed #e0e0e0;list-style:none;display:flex;align-items:center;gap:10px;font-size:13px}
.ex-list li::before{content:'';width:13px;height:13px;border:1.5px solid #1a1a6e;border-radius:3px;flex-shrink:0}
.ex-indication{margin-top:16px;padding:10px 14px;background:#eff0fb;border-left:3px solid #1a1a6e;font-size:12px}
.ex-sig{margin-top:52px;text-align:center}
.ex-sig-line{border-top:1px solid #333;width:280px;margin:0 auto 5px}
.ex-sig-name{font-size:12px;font-weight:700}
.ex-sig-reg{font-size:10px;color:#666;margin-top:2px}
.ex-footer{margin-top:24px;padding-top:8px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#999;font-family:Arial,sans-serif}
@media print{html,body{width:210mm}.page{padding:14mm 18mm}}
</style></head><body><div class="page">
<div class="ex-header">
  <div>
    <div class="ex-clinic-name">${clinic?.name ?? 'Clínica'}</div>
    <div class="ex-clinic-sub">
      ${clinic?.cnpj ? `CNPJ: ${clinic.cnpj}<br>` : ''}
      ${clinic?.address ? `${clinic.address}${clinic.city ? ` — ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}<br>` : ''}
      ${clinic?.phone ? `Tel: ${clinic.phone}` : ''}
    </div>
  </div>
  <div>${logoHtml}</div>
</div>
<div class="ex-title">SOLICITAÇÃO DE EXAMES</div>
<div class="ex-patient">
  <div class="ex-patient-label">Paciente</div>
  <div class="ex-patient-name">${patient.full_name}</div>
  ${patient.cpf ? `<div style="font-size:11px;color:#666;margin-top:2px">CPF: ${patient.cpf}</div>` : ''}
</div>
<p style="font-size:12px;color:#374151;margin-bottom:6px"><strong>Solicito os seguintes exames:</strong></p>
<ul class="ex-list">
  ${exams.map((e) => `<li>${e}</li>`).join('')}
</ul>
${clinicalIndication ? `<div class="ex-indication"><strong>Indicação clínica:</strong> ${clinicalIndication}</div>` : ''}
<div class="ex-sig">
  ${sigHtml ? `<div style="height:56px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:4px">${sigHtml}</div>` : ''}
  <div class="ex-sig-line"></div>
  <div class="ex-sig-name">${doctor.full_name}</div>
  <div class="ex-sig-reg">${doctor.registration_number ? `${registrationLabelForSpecialty(doctor.specialty)} ${doctor.registration_number}` : ''}${doctor.specialty ? ` · ${doctor.specialty}` : ''}</div>
</div>
<div class="ex-footer">
  <span>${[clinic?.city, clinic?.state].filter(Boolean).join('/')}, ${today}</span>
  <span>Documento gerado eletronicamente</span>
</div>
</div></body></html>`;
}

export async function generateExamRequestPdf(data: ExamRequestPdfData) {
  const html = await buildExamRequestHtml(data);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
}
