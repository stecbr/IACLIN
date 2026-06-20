import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DocHistoryEntry {
  type: 'receita' | 'exame' | 'encaminhamento' | 'atestado' | 'arquivo';
  date: string;
  doctor?: string | null;
  details: string[];
  extra?: string | null;
}

export interface DocHistoryData {
  patientName?: string | null;
  entries: DocHistoryEntry[];
}

function safeDate(d: string) {
  try { return format(parseISO(d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
}

const TYPE_LABELS: Record<DocHistoryEntry['type'], string> = {
  receita: 'Receitas Médicas',
  exame: 'Pedidos de Exames',
  encaminhamento: 'Encaminhamentos',
  atestado: 'Atestados',
  arquivo: 'Arquivos',
};

const TYPE_COLORS: Record<DocHistoryEntry['type'], string> = {
  receita: '#059669',
  exame: '#7c3aed',
  encaminhamento: '#d97706',
  atestado: '#0284c7',
  arquivo: '#6b7280',
};

function buildHtml(data: DocHistoryData): string {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const total = data.entries.length;

  const byType = {} as Record<DocHistoryEntry['type'], DocHistoryEntry[]>;
  const order: DocHistoryEntry['type'][] = ['receita', 'exame', 'encaminhamento', 'atestado', 'arquivo'];
  for (const t of order) byType[t] = [];
  for (const e of data.entries) byType[e.type].push(e);

  const sectionsHtml = order
    .filter(t => byType[t].length > 0)
    .map(t => {
      const color = TYPE_COLORS[t];
      const label = TYPE_LABELS[t];
      const rows = byType[t]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(e => `
          <tr>
            <td style="white-space:nowrap;">${safeDate(e.date)}</td>
            <td>${e.doctor ? `Dr(a). ${e.doctor}` : '—'}</td>
            <td>${e.details.filter(Boolean).join('<br/>')}</td>
            <td>${e.extra ?? '—'}</td>
          </tr>`)
        .join('');
      return `
        <div class="section">
          <h3 style="color:${color};border-left:4px solid ${color};padding-left:8px;margin-bottom:8px;">
            ${label} <span style="font-weight:400;font-size:11px;">(${byType[t].length})</span>
          </h3>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Profissional</th><th>Detalhes</th><th>Observação</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Histórico de Documentos — IACLIN</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
  .header h1 { font-size: 17px; font-weight: 700; color: #111827; }
  .header .meta { font-size: 10px; color: #6b7280; margin-top: 4px; }
  .brand { font-size: 14px; font-weight: 700; color: #3b82f6; }
  .section { margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f3f4f6; text-align: left; padding: 5px 8px; font-size: 9px; font-weight: 700; color: #374151; border: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; color: #374151; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 12px 20px; } .footer { position: fixed; bottom: 10px; left: 0; right: 0; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Histórico de Documentos Médicos</h1>
    ${data.patientName ? `<p class="meta">Paciente: <strong>${data.patientName}</strong></p>` : ''}
    <p class="meta">Gerado em ${now} · ${total} documento${total !== 1 ? 's' : ''}</p>
  </div>
  <div class="brand">IACLIN</div>
</div>
${sectionsHtml}
<div class="footer">Documento gerado pelo sistema IACLIN · uso pessoal · ${now}</div>
</body>
</html>`;
}

export function openDocHistoryPdf(data: DocHistoryData): void {
  if (data.entries.length === 0) return;
  const html = buildHtml(data);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
}
