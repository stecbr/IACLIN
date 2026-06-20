// @ts-expect-error - html2pdf.js has no types
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
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    const blob: Blob = await html2pdf().set(opt).from(container).outputPdf('blob');
    return blob;
  } finally {
    container.remove();
  }
}