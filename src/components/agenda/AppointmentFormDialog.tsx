import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, setHours, setMinutes, addDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Clock, Search, CalendarPlus, MessageCircle, Armchair, ChevronsUpDown, Check, UserPlus } from 'lucide-react';
import { checkAppointmentConflicts } from '@/lib/appointmentConflicts';
import { PatientFormDialog } from '@/components/patients/PatientFormDialog';

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
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientComboOpen, setPatientComboOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [procedureId, setProcedureId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [label, setLabel] = useState('');
  const [showFreeSlots, setShowFreeSlots] = useState(false);
  const [returnDays, setReturnDays] = useState<number | null>(null);
  const [roomId, setRoomId] = useState('');
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState<null | {
    existing: NonNullable<Awaited<ReturnType<typeof checkAppointmentConflicts>>['existing']>;
    newStart: Date;
  }>(null);

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

  const { data: rooms = [] } = useQuery({
    queryKey: ['clinic-rooms-select', currentClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_rooms')
        .select('id, name')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open && !!currentClinicId,
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

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(p => p.full_name.toLowerCase().includes(q));
  }, [patients, patientSearch]);

  const selectedPatientName = patients.find(p => p.id === patientId)?.full_name ?? '';

  const resetForm = () => {
    setPatientId(''); setProcedureId(''); setNotes(''); setLabel('');
    setReturnDays(null); setRoomId(''); setSendConfirmation(false);
    setPatientSearch(''); setPatientComboOpen(false);
  };

  const performInsert = async (replaceExistingId?: string) => {
    if (!user) return;
    const startDt = buildLocalDateTime(date, startTime);
    const endDt = new Date(startDt.getTime() + duration * 60000);

    // Check conflicts BEFORE cancelling to avoid leaving orphaned data if it fails
    const conflict = await checkAppointmentConflicts({
      supabase,
      patientId,
      dentistId: user.id,
      startTime: startDt,
      endTime: endDt,
      ignoreAppointmentId: replaceExistingId,
    });
    if (!conflict.ok) {
      toast.error(conflict.message ?? 'Conflito de agendamento.');
      return false;
    }

    if (replaceExistingId) {
      const { error: cancelErr } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', replaceExistingId);
      if (cancelErr) throw cancelErr;
    }

    const { error } = await supabase.from('appointments').insert({
        patient_id: patientId,
        dentist_id: user.id,
        procedure_id: procedureId || null,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        notes: notes || null,
        label: label || null,
        room_id: roomId || null,
        send_confirmation: sendConfirmation,
        clinic_id: currentClinicId ?? null,
      });
    if (error) throw error;

    // Return appointment
    if (returnDays && returnDays > 0) {
      const returnDate = addDays(startDt, returnDays);
      const returnEnd = new Date(returnDate.getTime() + duration * 60000);
      const returnConflict = await checkAppointmentConflicts({
        supabase,
        patientId,
        dentistId: user.id,
        startTime: returnDate,
        endTime: returnEnd,
      });
      if (!returnConflict.ok) {
        toast.warning(`Consulta agendada, mas o retorno não foi criado: ${returnConflict.message}`);
      } else {
        const { error: returnErr } = await supabase.from('appointments').insert({
          patient_id: patientId,
          dentist_id: user.id,
          procedure_id: procedureId || null,
          start_time: returnDate.toISOString(),
          end_time: returnEnd.toISOString(),
          notes: `Retorno de ${returnDays} dias`,
          label: 'retorno',
          room_id: roomId || null,
          clinic_id: currentClinicId ?? null,
        });
        if (returnErr) {
          toast.warning(`Consulta agendada, mas houve erro ao criar o retorno: ${returnErr.message}`);
        } else {
          toast.success(`Consulta agendada + retorno em ${returnDays} dias!`);
        }
        return true;
      }
    }
    toast.success(replaceExistingId ? 'Consulta reagendada!' : 'Consulta agendada!');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !user) { toast.error('Selecione um paciente'); return; }
    setLoading(true);
    try {
      const startDt = buildLocalDateTime(date, startTime);
      const endDt = new Date(startDt.getTime() + duration * 60000);

      const conflict = await checkAppointmentConflicts({
        supabase,
        patientId,
        dentistId: user.id,
        startTime: startDt,
        endTime: endDt,
      });

      if (!conflict.ok) {
        if (conflict.type === 'patient_overlap' && conflict.existing) {
          setReplaceConfirm({ existing: conflict.existing, newStart: startDt });
          setLoading(false);
          return;
        }
        toast.error(conflict.message ?? 'Conflito de agendamento.');
        setLoading(false);
        return;
      }

      const ok = await performInsert();
      if (ok) {
        onSuccess();
        onOpenChange(false);
        resetForm();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReplace = async () => {
    if (!replaceConfirm) return;
    setLoading(true);
    try {
      const ok = await performInsert(replaceConfirm.existing.id);
      if (ok) {
        setReplaceConfirm(null);
        onSuccess();
        onOpenChange(false);
        resetForm();
      }
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
            <Popover
              open={patientComboOpen}
              onOpenChange={(o) => { setPatientComboOpen(o); if (!o) setPatientSearch(''); }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={patientComboOpen}
                  className={cn(
                    'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    !patientId && 'text-muted-foreground'
                  )}
                >
                  <span className="truncate">{selectedPatientName || 'Selecione o paciente'}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }} align="start" sideOffset={4}>
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar paciente..."
                    value={patientSearch}
                    onValueChange={setPatientSearch}
                  />
                  <CommandList>
                    {filteredPatients.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-4 text-center px-2">
                        <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                          onClick={() => { setPatientComboOpen(false); setShowNewPatient(true); }}
                        >
                          <UserPlus className="h-4 w-4" />
                          Cadastrar {patientSearch ? `"${patientSearch}"` : 'novo paciente'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <CommandGroup>
                          {filteredPatients.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setPatientId(p.id);
                                setPatientSearch('');
                                setPatientComboOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', patientId === p.id ? 'opacity-100' : 'opacity-0')} />
                              {p.full_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <div className="border-t p-1">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            onClick={() => { setPatientComboOpen(false); setShowNewPatient(true); }}
                          >
                            <UserPlus className="h-4 w-4" />
                            Cadastrar novo paciente
                          </button>
                        </div>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

          {/* Room selector */}
          {rooms.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Armchair className="h-3.5 w-3.5 text-muted-foreground" />
                Sala / Cadeira
              </Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          {/* WhatsApp confirmation */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Confirmação via WhatsApp</p>
                <p className="text-xs text-muted-foreground">Enviar lembrete ao paciente</p>
              </div>
            </div>
            <Switch checked={sendConfirmation} onCheckedChange={setSendConfirmation} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Agendando...' : returnDays ? 'Agendar + Retorno' : 'Agendar'}
            </Button>
          </div>
        </form>
      </DialogContent>
      <AlertDialog open={!!replaceConfirm} onOpenChange={(o) => !o && setReplaceConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Paciente já tem consulta nesse horário</AlertDialogTitle>
            <AlertDialogDescription>
              {replaceConfirm ? (
                <>
                  O paciente já tem consulta com <strong>Dr(a). {replaceConfirm.existing.dentistName}</strong>{' '}
                  das <strong>{format(new Date(replaceConfirm.existing.startTime), 'HH:mm')}</strong> às{' '}
                  <strong>{format(new Date(replaceConfirm.existing.endTime), 'HH:mm')}</strong>. Se continuar,
                  a consulta anterior será <strong>cancelada</strong> e substituída pelo novo horário (
                  <strong>{format(replaceConfirm.newStart, 'HH:mm')}</strong>).
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Manter atual</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace} disabled={loading}>
              Sim, reagendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PatientFormDialog
        key={showNewPatient ? patientSearch || 'new' : 'hidden'}
        open={showNewPatient}
        onOpenChange={setShowNewPatient}
        clinicId={currentClinicId}
        initialName={patientSearch}
        onPatientCreated={(id, name) => {
          setPatientId(id);
          queryClient.setQueryData(
            ['patients-list', currentClinicId],
            (old: { id: string; full_name: string }[] | undefined) => {
              const list = old ?? [];
              if (list.some(p => p.id === id)) return list;
              return [...list, { id, full_name: name }].sort((a, b) => a.full_name.localeCompare(b.full_name));
            }
          );
        }}
        onSuccess={() => {}}
      />
    </Dialog>
  );
}
