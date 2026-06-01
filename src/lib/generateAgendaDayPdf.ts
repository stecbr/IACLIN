import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AgendaDayApt {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  label?: string | null;
  patients?: { full_name: string } | null;
  procedures?: { name: string; color: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Concluída',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1',
  confirmed: '#22c55e',
  completed: '#3b82f6',
  no_show: '#f59e0b',
  cancelled: '#ef4444',
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

export async function generateAgendaDayPdf(
  date: Date,
  appointments: AgendaDayApt[],
  clinicId?: string | null
) {
  let clinic: { name: string; phone?: string | null; address?: string | null; city?: string | null; state?: string | null; logo_url?: string | null } | null = null;

  if (clinicId) {
    const { data } = await supabase
      .from('clinics')
      .select('name, phone, address, city, state, logo_url')
      .eq('id', clinicId)
      .maybeSingle();
    clinic = data;
  }

  const logoDataUrl = clinic?.logo_url ? await getLogoDataUrl(clinic.logo_url) : '';

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const dateLabel = format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dateCapitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const printedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const clinicLine = [clinic?.address, clinic?.city, clinic?.state].filter(Boolean).join(', ');

  const appointmentRows = sorted
    .map((apt) => {
      const start = format(parseISO(apt.start_time), 'HH:mm');
      const end = format(parseISO(apt.end_time), 'HH:mm');
      const color = apt.procedures?.color ?? '#6366f1';
      const statusColor = STATUS_COLORS[apt.status] ?? '#6b7280';
      const statusLabel = STATUS_LABELS[apt.status] ?? apt.status;

      return `
        <div class="apt-card" style="border-left: 4px solid ${color}">
          <div class="apt-header">
            <span class="apt-time">${start} – ${end}</span>
            <span class="apt-status" style="background:${statusColor}20; color:${statusColor}">${statusLabel}</span>
          </div>
          <div class="apt-patient">${apt.patients?.full_name ?? '—'}</div>
          <div class="apt-procedure">${apt.procedures?.name ?? 'Consulta'}</div>
          ${apt.notes ? `<div class="apt-notes">${apt.notes}</div>` : ''}
        </div>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Agenda do Dia — ${dateCapitalized}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      padding: 28px 32px;
      max-width: 760px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 20px;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .logo { height: 48px; width: auto; object-fit: contain; }
    .clinic-name { font-size: 18px; font-weight: 700; color: #111; }
    .clinic-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .header-right { text-align: right; }
    .date-label { font-size: 15px; font-weight: 600; color: #111; }
    .summary { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .apt-card {
      padding: 12px 14px;
      margin-bottom: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fafafa;
      page-break-inside: avoid;
    }
    .apt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .apt-time { font-weight: 700; font-size: 13px; }
    .apt-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
    }
    .apt-patient { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .apt-procedure { font-size: 12px; color: #6b7280; }
    .apt-notes { font-size: 11px; color: #9ca3af; margin-top: 4px; font-style: italic; }
    .empty {
      text-align: center;
      padding: 48px 0;
      color: #9ca3af;
      font-size: 14px;
    }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 16px; }
      .apt-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Logo" />` : ''}
      <div>
        <div class="clinic-name">${clinic?.name ?? 'Agenda'}</div>
        ${clinic?.phone ? `<div class="clinic-sub">${clinic.phone}</div>` : ''}
        ${clinicLine ? `<div class="clinic-sub">${clinicLine}</div>` : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="date-label">${dateCapitalized}</div>
      <div class="summary">${sorted.length} consulta${sorted.length !== 1 ? 's' : ''} agendada${sorted.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  ${sorted.length === 0
    ? '<div class="empty">Nenhuma consulta agendada para este dia.</div>'
    : appointmentRows
  }

  <div class="footer">
    <span>IACLIN — Sistema de Gestão de Clínicas</span>
    <span>Impresso em ${printedAt}</span>
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) { return; }
  win.document.write(html);
  win.document.close();
}
