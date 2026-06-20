import html2pdf from 'html2pdf.js';

/**
 * Converte um HTML string em Blob PDF usando html2pdf.js (jsPDF + html2canvas)
 * direto no navegador, sem precisar abrir popup.
 */
export async function htmlToPdfBlob(html: string, filename = 'documento.pdf'): Promise<Blob> {
  // html2pdf precisa de um elemento real no DOM para renderizar
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
    };
    const blob: Blob = await html2pdf().set(opt).from(container).outputPdf('blob');
    return blob;
  } finally {
    container.remove();
  }
}