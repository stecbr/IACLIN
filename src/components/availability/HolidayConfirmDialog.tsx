import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface HolidayConfirmDialogProps {
  open: boolean;
  date: Date | null;
  holidayName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HolidayConfirmDialog({ open, date, holidayName, onConfirm, onCancel }: HolidayConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">Atenção: dia de feriado</DialogTitle>
          <DialogDescription className="text-center">
            {date && (
              <>
                O dia <span className="font-medium text-foreground">
                  {format(date, "dd 'de' MMMM", { locale: ptBR })}
                </span>{' '}
                é feriado{holidayName ? <> (<span className="font-medium text-foreground">{holidayName}</span>)</> : null}.
                <br />
                Deseja abrir agenda mesmo assim?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button onClick={onConfirm} className="flex-1">Sim, vou trabalhar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
