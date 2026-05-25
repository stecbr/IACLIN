import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StopCircle, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (dontAskAgain: boolean) => void;
  onDiscard?: () => void;
}

export function FinishConfirmDialog({ open, onOpenChange, onConfirm, onDiscard }: Props) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>O que deseja fazer com a gravação?</DialogTitle>
          <DialogDescription>
            Finalizar envia o áudio para transcrição e resumo por IA. Descartar interrompe a gravação sem salvar nada.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(v === true)} />
          Não mostrar essa mensagem novamente.
        </label>
        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Continuar gravando</Button>
          {onDiscard && (
            <Button variant="outline" onClick={onDiscard} className="gap-2">
              <Trash2 className="h-4 w-4" /> Descartar
            </Button>
          )}
          <Button variant="destructive" onClick={() => onConfirm(dontAsk)} className="gap-2">
            <StopCircle className="h-4 w-4" /> Finalizar gravação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}