import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';

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

  useEffect(() => {
    if (open) { setZoom(100); setRotation(0); }
  }, [open, file?.url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(400, z + 25));
      if (e.key === '-') setZoom((z) => Math.max(25, z - 25));
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !file) return null;

  const pdf = isPdf(file.file_name, file.url);
  const img = isImage(file.file_name, file.url);

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col animate-fade-in">
      <header className="flex items-center justify-between gap-3 px-4 h-14 border-b border-border bg-background/80">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="icon" variant="ghost" className="rounded-full" onClick={onClose} aria-label="Fechar">
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
          {img && (
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
          <iframe
            src={file.url}
            title={file.file_name}
            className="bg-white shadow-lg rounded-lg"
            style={{ width: `${zoom}%`, height: '100%', minHeight: '80vh', maxWidth: '100%' }}
          />
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
    </div>
  );
}