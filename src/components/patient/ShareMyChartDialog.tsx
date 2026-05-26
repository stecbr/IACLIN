import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check, MessageCircle, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName?: string | null;
}

export function ShareMyChartDialog({ open, onOpenChange, patientName }: Props) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/prontuario/compartilhado`
    : '';

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0) { setCode(null); setExpiresAt(null); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (!open) {
      setCode(null); setExpiresAt(null); setRemaining(0);
      setCopiedCode(false); setCopiedLink(false);
    }
  }, [open]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('share-own-chart', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCode((data as any).code);
      setExpiresAt((data as any).expires_at);
    } catch (err: any) {
      toast.error('Não foi possível gerar o código', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, kind: 'code' | 'link') => {
    await navigator.clipboard.writeText(text);
    if (kind === 'code') { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }
    else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
    toast.success('Copiado!');
  };

  const whatsapp = () => {
    if (!code) return;
    const who = patientName ?? 'meu';
    const msg = `Olá! Estou compartilhando ${patientName ? `o prontuário de ${patientName}` : 'meu prontuário'}.\n\nAcesse: ${shareUrl}\nCódigo: ${code}\n\nEste código expira em 5 minutos.`;
    void who;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const formattedCode = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            Compartilhar meu prontuário
          </DialogTitle>
        </DialogHeader>

        {!code ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Gere um código temporário para que qualquer profissional possa visualizar seu prontuário e adicioná-lo como paciente da clínica dele.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>O código expira em <b>5 minutos</b>. Compartilhe apenas com o profissional destinatário.</span>
            </div>
            <Button onClick={generate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Gerar código de acesso
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Código de acesso</p>
              <p className="text-5xl font-mono font-semibold tracking-widest text-foreground">{formattedCode}</p>
              <p className="text-sm text-muted-foreground">
                Expira em <span className="font-mono font-semibold text-foreground">{mins}:{secs.toString().padStart(2, '0')}</span>
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
              <p className="text-xs text-muted-foreground">Link de acesso</p>
              <p className="text-sm font-medium break-all">{shareUrl}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => copy(code, 'code')} className="gap-2">
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copiar código
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy(`${shareUrl}\nCódigo: ${code}`, 'link')} className="gap-2">
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copiar link
              </Button>
              <Button variant="outline" size="sm" onClick={whatsapp} className="gap-2 col-span-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar por WhatsApp
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="w-full gap-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Gerar novo código
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}