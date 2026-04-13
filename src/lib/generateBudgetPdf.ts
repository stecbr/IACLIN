import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BudgetPdfData {
  plan: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    total_cost: number;
    created_at: string;
    treatment_plan_items?: Array<{
      id: string;
      procedure_id: string;
      price: number;
      tooth_number?: number | null;
      notes?: string | null;
      procedures?: { name: string } | null;
    }>;
  };
  patient: {
    full_name: string;
    cpf?: string | null;
    phone?: string | null;
    email?: string | null;
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
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getLogoDataUrl(logoUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = logoUrl;
  });
}

export async function generateBudgetPdf(data: BudgetPdfData) {
  const { plan, patient, clinic } = data;
  const items = plan.treatment_plan_items ?? [];
  const createdDate = format(new Date(plan.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  let logoHtml = '';
  if (clinic?.logo_url) {
    try {
      const dataUrl = await getLogoDataUrl(clinic.logo_url);
      if (dataUrl) {
        logoHtml = `<img src="${dataUrl}" style="max-height:60px;max-width:180px;object-fit:contain;" />`;
      }
    } catch {
      // skip logo
    }
  }

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    negotiating: 'Em Negociação',
    approved: 'Aprovado',
    lost: 'Perdido',
  };

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento - ${patient.full_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
    .clinic-info h1 { font-size: 20px; color: #1e40af; margin-bottom: 4px; }
    .clinic-info p { font-size: 11px; color: #6b7280; }
    .logo { text-align: right; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #dbeafe; color: #1e40af; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .info-item label { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }
    .info-item p { font-size: 13px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    tbody tr:hover { background: #fafafa; }
    .text-right { text-align: right; }
    .total-row { font-weight: 700; font-size: 15px; background: #eff6ff !important; }
    .total-row td { border-top: 2px solid #2563eb; padding: 12px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
    .sig-line { width: 200px; text-align: center; }
    .sig-line hr { border: none; border-top: 1px solid #1a1a1a; margin-bottom: 6px; }
    .sig-line p { font-size: 11px; color: #6b7280; }
    .description { background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 12px; color: #4b5563; margin-top: 8px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic-info">
      <h1>${clinic?.name ?? 'Clínica'}</h1>
      ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}</p>` : ''}
      ${clinic?.address ? `<p>${clinic.address}${clinic.city ? ` - ${clinic.city}` : ''}${clinic.state ? `/${clinic.state}` : ''}</p>` : ''}
      ${clinic?.phone ? `<p>Tel: ${clinic.phone}</p>` : ''}
      ${clinic?.email ? `<p>${clinic.email}</p>` : ''}
    </div>
    <div class="logo">${logoHtml}</div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
    <div>
      <h2 style="font-size:18px;color:#1e40af;">ORÇAMENTO ODONTOLÓGICO</h2>
      <p style="font-size:11px;color:#9ca3af;">${plan.title} · ${createdDate}</p>
    </div>
    <span class="badge">${statusLabels[plan.status] ?? plan.status}</span>
  </div>

  <div class="section">
    <div class="section-title">Dados do Paciente</div>
    <div class="info-grid">
      <div class="info-item"><label>Nome completo</label><p>${patient.full_name}</p></div>
      ${patient.cpf ? `<div class="info-item"><label>CPF</label><p>${patient.cpf}</p></div>` : ''}
      ${patient.phone ? `<div class="info-item"><label>Telefone</label><p>${patient.phone}</p></div>` : ''}
      ${patient.email ? `<div class="info-item"><label>E-mail</label><p>${patient.email}</p></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Procedimentos</div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:40%">Procedimento</th>
          <th style="width:15%">Dente</th>
          <th style="width:25%">Observação</th>
          <th class="text-right" style="width:15%">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.procedures?.name ?? '—'}</td>
          <td>${item.tooth_number ?? '—'}</td>
          <td>${item.notes ?? '—'}</td>
          <td class="text-right">${formatCurrency(Number(item.price))}</td>
        </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="4" class="text-right">TOTAL</td>
          <td class="text-right">${formatCurrency(Number(plan.total_cost))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${plan.description ? `
  <div class="section">
    <div class="section-title">Observações</div>
    <div class="description">${plan.description}</div>
  </div>
  ` : ''}

  <div class="footer">
    <p style="font-size:11px;color:#9ca3af;">
      Este orçamento é válido por 30 dias a partir da data de emissão.
      Os valores podem sofrer alteração após este período.
    </p>
    <div class="signatures">
      <div class="sig-line"><hr/><p>Profissional Responsável</p></div>
      <div class="sig-line"><hr/><p>${patient.full_name}</p></div>
    </div>
  </div>
</body>
</html>`;

  // Open print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}

export async function fetchClinicForPdf(clinicId: string | null) {
  if (!clinicId) return null;
  const { data } = await supabase.from('clinics').select('name, phone, email, address, city, state, cnpj, logo_url').eq('id', clinicId).single();
  return data;
}
