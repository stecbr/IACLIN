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
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const styles = Array.from(parsed.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  const bodyInner = parsed.body?.innerHTML ?? '';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '794px'; // ~210mm @96dpi
  container.style.minHeight = '1123px'; // ~297mm @96dpi
  container.style.background = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.overflow = 'visible';
  container.setAttribute('aria-hidden', 'true');
  container.innerHTML = `<style>${styles}</style><div class="pdf-body">${bodyInner}</div>`;
  document.body.appendChild(container);

  try {
    // Aguarda fontes
    try {
      const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (fonts?.ready) await fonts.ready;
    } catch { /* ignore */ }

    // Aguarda imagens (logo) carregarem
    const imgs = Array.from(container.querySelectorAll('img'));
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
        windowWidth: container.scrollWidth,
        windowHeight: Math.max(container.scrollHeight, 1123),
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] as const },
    };
    const blob: Blob = await html2pdf().set(opt).from(container).outputPdf('blob');
    if (blob.size < 1024) throw new Error('PDF gerado vazio. Tente novamente.');
    return blob;
  } finally {
    container.remove();
  }
}