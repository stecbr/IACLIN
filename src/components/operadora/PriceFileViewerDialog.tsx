import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileText, ExternalLink } from 'lucide-react';

export interface PriceFileLike {
  id: string;
  file_name: string;
  file_url: string; // storage path
  file_type?: string | null;
  file_size?: number | null;
  created_at?: string;
}

interface Props {
  file: PriceFileLike | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isPdf(f: PriceFileLike): boolean {
  const n = f.file_name.toLowerCase();
  if (n.endsWith('.pdf')) return true;
  return (f.file_type ?? '').toLowerCase().includes('pdf');
}

function isImage(f: PriceFileLike): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(f.file_name) ||
    (f.file_type ?? '').toLowerCase().startsWith('image/');
}

function fmtSize(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function PriceFileViewerDialog({ file, open, onOpenChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !file) { setUrl(null); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.storage
        .from('operator-price-files')
        .createSignedUrl(file.file_url, 600);
      if (cancelled) return;
      setUrl(data?.signedUrl ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, file]);

  async function download() {
    if (!file) return;
    const { data } = await supabase.storage
      .from('operator-price-files')
      .createSignedUrl(file.file_url, 120, { download: file.file_name });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  const canPreview = !!file && (isPdf(file) || isImage(file));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{file?.file_name ?? 'Arquivo'}</DialogTitle>
              <DialogDescription className="text-xs">
                {file ? `${fmtSize(file.file_size)}${file.created_at ? ' · enviado em ' + new Date(file.created_at).toLocaleDateString('pt-BR') : ''}` : ''}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {url && (
                <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir em nova aba
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={download}>
                <Download className="h-4 w-4 mr-1.5" /> Baixar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-muted/30 h-[78vh] flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !file || !url ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar o arquivo.</p>
          ) : canPreview ? (
            isPdf(file) ? (
              <iframe src={url} title={file.file_name} className="w-full h-full bg-white" />
            ) : (
              <img src={url} alt={file.file_name} className="max-h-full max-w-full object-contain" />
            )
          ) : (
            <div className="text-center space-y-3 p-8">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium">Pré-visualização não disponível</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Este formato (planilha ou outro) não pode ser exibido aqui. Faça o download para visualizar.
              </p>
              <Button size="sm" onClick={download}>
                <Download className="h-4 w-4 mr-1.5" /> Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}