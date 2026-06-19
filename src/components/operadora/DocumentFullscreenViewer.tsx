import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface FullscreenDocFile {
  url: string;
  file_name: string;
  label?: string;
}

interface Props {
  file: FullscreenDocFile | null;
  open: boolean;
  onClose: () => void;
}

function isPdf(name: string, url: string) {
  return /\.pdf($|\?)/i.test(name) || /\.pdf($|\?)/i.test(url);
}
function isImage(name: string, url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(name) || /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(url);
}

export function DocumentFullscreenViewer({ file, open, onClose }: Props) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);

  useEffect(() => {
    if (open) { setZoom(100); setRotation(0); setPageNum(1); setNumPages(0); }
  }, [open, file?.url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(400, z + 25));
      if (e.key === '-') setZoom((z) => Math.max(25, z - 25));
    };
    const onNativeClose = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-document-viewer-close]')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onNativeClose, true);
    window.addEventListener('click', onNativeClose, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onNativeClose, true);
      window.removeEventListener('click', onNativeClose, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !file) return null;

  const pdf = isPdf(file.file_name, file.url);
  const img = isImage(file.file_name, file.url);
  const handleClose = (e?: ReactMouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    onClose();
  };

  return createPortal(
    <div
      data-document-fullscreen-viewer
      className="fixed inset-0 z-[100] pointer-events-auto bg-background/95 backdrop-blur-sm flex flex-col animate-fade-in"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between gap-3 px-4 h-14 border-b border-border bg-background/80">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onPointerDown={handleClose}
            onClick={handleClose}
            data-document-viewer-close
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            {file.label && <div className="text-xs text-muted-foreground truncate">{file.label}</div>}
            <div className="text-sm font-medium truncate">{file.file_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(img || pdf) && (
            <>
              <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setZoom((z) => Math.max(25, z - 25))} aria-label="Diminuir zoom">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs tabular-nums w-12 text-center text-muted-foreground">{zoom}%</span>
              <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setZoom((z) => Math.min(400, z + 25))} aria-label="Aumentar zoom">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="rounded-full" onClick={() => { setZoom(100); setRotation(0); }} aria-label="Resetar">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {(img || pdf) && (
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Girar">
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          <a href={file.url} download={file.file_name} target="_blank" rel="noreferrer">
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="Baixar">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
        {pdf ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <Document
              file={file.url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando PDF…
                </div>
              }
              error={
                <div className="text-sm text-destructive py-12">Falha ao carregar o PDF.</div>
              }
              className="flex flex-col items-center gap-4"
            >
              <Page
                pageNumber={pageNum}
                scale={zoom / 100}
                rotate={rotation}
                renderAnnotationLayer
                renderTextLayer
                className="shadow-lg rounded-lg overflow-hidden bg-white"
              />
            </Document>
            {numPages > 1 && (
              <div className="sticky bottom-4 flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 shadow-md">
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs tabular-nums">{pageNum} / {numPages}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={pageNum >= numPages} onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : img ? (
          <img
            src={file.url}
            alt={file.file_name}
            style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transition: 'transform 0.15s ease' }}
            className="max-h-full max-w-full object-contain shadow-lg rounded-lg"
          />
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este formato.</p>
            <a href={file.url} target="_blank" rel="noreferrer">
              <Button variant="outline" className="rounded-xl">
                <Download className="h-4 w-4 mr-1.5" /> Baixar arquivo
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}