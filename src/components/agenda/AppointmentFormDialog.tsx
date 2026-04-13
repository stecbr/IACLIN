import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, setHours, setMinutes, addDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Search, CalendarPlus } from 'lucide-react';

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
  const [showFreeSlots, setShowFreeSlots] = useState(false);
  const [returnDays, setReturnDays] = useState<number | null>(null);

  const buildLocalDateTime = (dateValue: string, timeValue: string) => {
    const [year, month, day] = dateValue.split('-').map(Number);
    const [hours, minutes] = timeValue.split(':').map(Number);
    return setMinutes(setHours(new Date(year, month - 1, day), hours), minutes);
  };

  useEffect(() => {
    if (open) {
      setDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setStartTime(defaultHour != null ? `${String(defaultHour).padStart(2, '0')}:00` : '09:00');
      setShowFreeSlots(false);
      setReturnDays(null);
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

  // Fetch appointments for the selected date to find free slots
  const { data: dayAppointments = [] } = useQuery({
    queryKey: ['day-appointments-slots', date, currentClinicId],
    queryFn: async () => {
      const dayStart = startOfDay(new Date(date + 'T00:00:00'));
      const dayEnd = endOfDay(dayStart);
      let query = supabase.from('appointments').select('start_time, end_time, status')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .neq('status', 'cancelled');
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && showFreeSlots,
  });

  const freeSlots = useMemo(() => {
    if (!showFreeSlots) return [];
    const slots: string[] = [];
    const occupied = dayAppointments.map(a => ({
      start: new Date(a.start_time).getHours() * 60 + new Date(a.start_time).getMinutes(),
      end: new Date(a.end_time).getHours() * 60 + new Date(a.end_time).getMinutes(),
    }));

    // Check slots from 8:00 to 18:00 in 30min increments
    for (let min = 480; min <= 1080 - duration; min += 30) {
      const slotEnd = min + duration;
      const conflict = occupied.some(o => min < o.end && slotEnd > o.start);
      if (!conflict) {
        const h = Math.floor(min / 60).toString().padStart(2, '0');
        const m = (min % 60).toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    }
    return slots;
  }, [dayAppointments, showFreeSlots, duration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !user) { toast.error('Selecione um paciente'); return; }
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

      // If return scheduling, create the return appointment too
      if (returnDays && returnDays > 0) {
        const returnDate = addDays(startDt, returnDays);
        const returnEnd = new Date(returnDate.getTime() + duration * 60000);
        await supabase.from('appointments').insert({
          patient_id: patientId,
          dentist_id: user.id,
          procedure_id: procedureId || null,
          start_time: returnDate.toISOString(),
          end_time: returnEnd.toISOString(),
          notes: `Retorno de ${returnDays} dias`,
          label: 'retorno',
          clinic_id: currentClinicId ?? null,
        });
        toast.success(`Consulta agendada + retorno em ${returnDays} dias!`);
      } else {
        toast.success('Consulta agendada!');
      }

      onSuccess();
      onOpenChange(false);
      setPatientId(''); setProcedureId(''); setNotes(''); setLabel(''); setReturnDays(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Find free slot */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => setShowFreeSlots(!showFreeSlots)}
            >
              <Search className="h-3.5 w-3.5" />
              {showFreeSlots ? 'Ocultar horários livres' : 'Encontrar horário livre'}
            </Button>
            {showFreeSlots && (
              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">
                  Horários disponíveis em {format(new Date(date + 'T12:00:00'), "dd/MM/yyyy")} ({duration}min):
                </p>
                {freeSlots.length === 0 ? (
                  <p className="text-xs text-destructive">Nenhum horário livre neste dia.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {freeSlots.slice(0, 12).map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => { setStartTime(slot); setShowFreeSlots(false); }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          startTime === slot
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        <Clock className="h-3 w-3 inline mr-1" />
                        {slot}
                      </button>
                    ))}
                    {freeSlots.length > 12 && (
                      <span className="text-xs text-muted-foreground self-center">+{freeSlots.length - 12} mais</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Labels */}
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

          {/* Return scheduling */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
              Agendar retorno
            </Label>
            <div className="flex gap-2">
              {[7, 15, 30, 60, 90, 180].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setReturnDays(returnDays === d ? null : d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    returnDays === d
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  {d < 30 ? `${d}d` : `${d / 30}m`}
                </button>
              ))}
            </div>
            {returnDays && (
              <p className="text-xs text-muted-foreground">
                Retorno será agendado para {format(addDays(buildLocalDateTime(date, startTime), returnDays), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Agendando...' : returnDays ? 'Agendar + Retorno' : 'Agendar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
