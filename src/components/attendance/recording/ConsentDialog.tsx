import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAccepted: () => void;
}

export function ConsentDialog({ open, onOpenChange, onAccepted }: Props) {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_consents')
        .upsert({ user_id: user.id, consent_type: 'recording_terms' }, { onConflict: 'user_id,consent_type' });
      if (error) throw error;
      onOpenChange(false);
      onAccepted();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Primeiro acesso</DialogTitle>
          <DialogDescription>
            Para iniciar a gravação, confirme que leu e está de acordo com nossos Termos de Uso.
            O áudio é armazenado de forma privada e processado por IA para gerar transcrição,
            resumo e estrutura clínica — você sempre pode revisar e editar antes de salvar.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 mt-2 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
          <span>
            Li e estou de acordo com os{' '}
            <a href="#" className="text-primary underline" onClick={(e) => e.preventDefault()}>Termos de Uso.</a>
            <span className="text-destructive">*</span>
          </span>
        </label>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAccept} disabled={!accepted || saving} className="gap-2">
            <Mic className="h-4 w-4" />
            Iniciar gravação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}