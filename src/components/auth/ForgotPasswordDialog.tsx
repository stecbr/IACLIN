import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, initialEmail = '' }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      // Não revelamos se o e-mail existe — apenas mostramos sucesso genérico.
      // Mas em caso de erro técnico (rate-limit, rede), avisamos.
      const msg = String(err?.message ?? '');
      if (/rate|limit/i.test(msg)) {
        toast.error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        // Mesmo em erro genérico, mostramos sucesso para evitar enumeração.
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setTimeout(() => { setSent(false); setEmail(initialEmail); }, 200);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!sent ? (
          <>
            <DialogHeader>
              <DialogTitle>Recuperar senha</DialogTitle>
              <DialogDescription>
                Informe seu e-mail cadastrado. Vamos enviar um link para você criar uma nova senha.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoFocus
                  className="h-10"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || !email.trim()}>
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" /> Enviar link</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <div className="py-4 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">Verifique seu e-mail</DialogTitle>
              <DialogDescription className="text-center">
                Se existe uma conta com <span className="font-medium text-foreground">{email}</span>, enviamos um link para criar uma nova senha. O link expira em 1 hora.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => handleClose(false)} className="w-full">Voltar para o login</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}