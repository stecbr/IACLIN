import html2pdf from 'html2pdf.js';

/**
 * Converte um HTML string (documento completo com <html>/<head>/<body>)
 * em Blob PDF usando html2pdf.js (jsPDF + html2canvas).
 *
 * Estratégia: extrai o conteúdo de <style> e <body> do HTML completo e
 * renderiza num container fixo fora da tela. O html2pdf clona o elemento
 * para um sandbox próprio, então embutimos `<style>` dentro do container
 * para que as regras CSS viagem junto com o clone — o que não acontece
 * se renderizarmos via <iframe srcdoc>.
 */
export async function htmlToPdfBlob(html: string, filename = 'documento.pdf'): Promise<Blob> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-1';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Não foi possível preparar o PDF.'));
      iframe.srcdoc = html;
    });

    const doc = iframe.contentDocument;
    if (!doc?.documentElement || !doc.body) throw new Error('Não foi possível montar o PDF.');

    const styles = Array.from(doc.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    if (styles) doc.body.insertAdjacentHTML('afterbegin', `<style>${styles}</style>`);

    // Aguarda fontes
    try {
      const fonts = (doc as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (fonts?.ready) await fonts.ready;
    } catch { /* ignore */ }

    // Aguarda imagens (logo) carregarem
    const imgs = Array.from(doc.images);
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 80));

    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: Math.max(doc.documentElement.scrollWidth, 794),
        windowHeight: Math.max(doc.documentElement.scrollHeight, 1123),
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] as const },
    };
    const blob: Blob = await html2pdf().set(opt).from(doc.documentElement).outputPdf('blob');
    if (blob.size < 1024) throw new Error('PDF gerado vazio. Tente novamente.');
    return blob;
  } finally {
    iframe.remove();
  }
}