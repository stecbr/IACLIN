import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KeyRound, Loader2, LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinClinicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinClinicDialog({ open, onOpenChange }: JoinClinicDialogProps) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const normalized = code.trim().toUpperCase();
  const valid = /^CLIN-[A-Z0-9]{8}$/.test(normalized);

  const handleJoin = async () => {
    if (!valid) {
      toast('Formato inválido. Use CLIN-XXXXXXXX.');
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-clinic-by-code', {
        body: { code: normalized },
      });
      if (error || (data && data.error)) {
        toast(data?.error || error?.message || 'Não foi possível vincular.');
        return;
      }
      toast.success('Vínculo criado! Recarregando…');
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      toast(err?.message || 'Erro inesperado');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Vincular nova clínica
          </DialogTitle>
          <DialogDescription>
            Peça à clínica o código de convite (formato <code className="font-mono">CLIN-XXXXXXXX</code>) e cole abaixo para entrar como profissional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="join-invite-code">Código de convite</Label>
            <Input
              id="join-invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CLIN-XXXXXXXX"
              className="font-mono uppercase tracking-wider"
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button onClick={handleJoin} disabled={!valid || joining} className="w-full gap-2">
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {joining ? 'Entrando…' : 'Entrar na clínica'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}