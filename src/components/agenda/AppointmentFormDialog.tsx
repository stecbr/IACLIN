import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, setHours, setMinutes } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: Date;
  defaultHour?: number;
}

const LABELS = [
  { value: 'primeira_consulta', label: 'Primeira Consulta', color: '#6366f1' },
  { value: 'retorno', label: 'Retorno', color: '#f59e0b' },
  { value: 'urgencia', label: 'Urgência', color: '#ef4444' },
  { value: 'preventivo', label: 'Preventivo', color: '#22c55e' },
  { value: 'estetico', label: 'Estético', color: '#ec4899' },
];

export function AppointmentFormDialog({ open, onOpenChange, onSuccess, defaultDate, defaultHour }: Props) {
  const { user, currentClinicId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [procedureId, setProcedureId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [label, setLabel] = useState('');

  const buildLocalDateTime = (dateValue: string, timeValue: string) => {
    const [year, month, day] = dateValue.split('-').map(Number);
    const [hours, minutes] = timeValue.split(':').map(Number);

    return setMinutes(setHours(new Date(year, month - 1, day), hours), minutes);
  };

  // Sync date/time when dialog opens or props change
  useEffect(() => {
    if (open) {
      setDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setStartTime(defaultHour != null ? `${String(defaultHour).padStart(2, '0')}:00` : '09:00');
    }
  }, [open, defaultDate, defaultHour]);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('patients').select('id, full_name').eq('is_active', true).order('full_name');
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('procedures').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !user) {
      toast.error('Selecione um paciente');
      return;
    }
    setLoading(true);
    try {
      const startDt = buildLocalDateTime(date, startTime);
      const endDt = new Date(startDt.getTime() + duration * 60000);

      const { error } = await supabase.from('appointments').insert({
        patient_id: patientId,
        dentist_id: user.id,
        procedure_id: procedureId || null,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        notes: notes || null,
        label: label || null,
        clinic_id: currentClinicId ?? null,
      });
      if (error) throw error;
      toast.success('Consulta agendada!');
      onSuccess();
      onOpenChange(false);
      // Reset
      setPatientId('');
      setProcedureId('');
      setNotes('');
      setLabel('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProc = procedures.find((p) => p.id === procedureId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Consulta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Procedimento</Label>
            <Select value={procedureId} onValueChange={(v) => {
              setProcedureId(v);
              const proc = procedures.find((p) => p.id === v);
              if (proc) setDuration(proc.default_duration);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                {procedures.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={15} step={15} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rótulo</Label>
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map(l => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLabel(label === l.value ? '' : l.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${label === l.value ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-60 hover:opacity-100'}`}
                  style={{ borderColor: l.color, color: l.color, backgroundColor: label === l.value ? `${l.color}15` : 'transparent' }}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Agendando...' : 'Agendar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
