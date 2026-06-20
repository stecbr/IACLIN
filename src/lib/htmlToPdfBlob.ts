import html2pdf from 'html2pdf.js';

/**
 * Converte um HTML string (documento completo com <html>/<head>/<body>)
 * em Blob PDF usando html2pdf.js (jsPDF + html2canvas).
 *
 * Renderiza dentro de um <iframe> oculto via srcdoc para preservar todas
 * as regras CSS aplicadas a html/body — quando se usa innerHTML em um
 * <div> as tags html/head/body são descartadas e o PDF sai em branco.
 */
export async function htmlToPdfBlob(html: string, filename = 'documento.pdf'): Promise<Blob> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true });
      iframe.srcdoc = html;
    });

    // Aguarda fontes/imagens carregarem
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Falha ao acessar o documento do iframe');
    try {
      const fonts = (doc as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (fonts?.ready) await fonts.ready;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 100));

    const target = doc.body;
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: target.scrollWidth },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
    };
    const blob: Blob = await html2pdf().set(opt).from(target).outputPdf('blob');
    return blob;
  } finally {
    iframe.remove();
  }
}