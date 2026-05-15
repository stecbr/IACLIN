import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StopCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (dontAskAgain: boolean) => void;
}

export function FinishConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quer finalizar a gravação?</DialogTitle>
          <DialogDescription>
            A gravação da consulta será encerrada e a transcrição ficará disponível para você.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(v === true)} />
          Não mostrar essa mensagem novamente.
        </label>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => onConfirm(dontAsk)} className="gap-2">
            <StopCircle className="h-4 w-4" /> Finalizar gravação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}