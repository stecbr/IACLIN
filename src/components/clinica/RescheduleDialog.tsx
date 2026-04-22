import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStart: string;
  currentEnd: string;
  onConfirm: (newStart: string, newEnd: string) => void;
  loading?: boolean;
}

export function RescheduleDialog({ open, onOpenChange, currentStart, currentEnd, onConfirm, loading }: Props) {
  const initialDate = format(parseISO(currentStart), 'yyyy-MM-dd');
  const initialStart = format(parseISO(currentStart), 'HH:mm');
  const initialEnd = format(parseISO(currentEnd), 'HH:mm');

  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const handleSubmit = () => {
    const newStart = new Date(`${date}T${start}:00`).toISOString();
    const newEnd = new Date(`${date}T${end}:00`).toISOString();
    onConfirm(newStart, newEnd);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar e aprovar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>Reagendar e aprovar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}