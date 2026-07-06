import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, setHours, setMinutes, addDays, differenceInYears, parseISO } from 'date-fns';
import { useAvailableTimeSlots } from '@/hooks/useAvailableTimeSlots';
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
import { Clock, Search, CalendarPlus, MessageCircle, Armchair, ChevronsUpDown, Check, UserPlus, Info, ExternalLink, Pencil, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const [patientPreviewOpen, setPatientPreviewOpen] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [procedureId, setProcedureId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [label, setLabel] = useState('');
  const [timeMode, setTimeMode] = useState<'select' | 'manual'>('select');
  const [manualError, setManualError] = useState<string | null>(null);
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

  // ── Available time slots hook ──────────────────────────────────────────
  const {
    availableSlots,
    isLoading: slotsLoading,
    emptyMessage,
    clinicHoursLabel,
    findNextSlot,
    validateTime,
  } = useAvailableTimeSlots({
    date,
    duration,
    dentistId: user?.id,
    clinicId: currentClinicId,
    enabled: open,
  });

  // On open: reset time mode and set sensible default time
  useEffect(() => {
    if (open) {
      setDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setTimeMode('select');
      setManualError(null);
      setReturnDays(null);
    }
  }, [open, defaultDate]);

  // When slots load or date/duration changes: auto-select the requested hour or first available
  useEffect(() => {
    if (!open || timeMode !== 'select') return;
    if (slotsLoading) return;
    if (defaultHour != null) {
      const requested = `${String(defaultHour).padStart(2, '0')}:00`;
      if (availableSlots.includes(requested)) { setStartTime(requested); return; }
    }
    const next = findNextSlot();
    if (next) setStartTime(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, duration, slotsLoading, availableSlots.join(','), defaultHour]);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('patients').select('id, full_name, photo_url, cpf, rg, insurance_number, insurance_provider, date_of_birth, phone').eq('is_active', true).order('full_name');
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures-list', currentClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open && !!currentClinicId,
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


  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients;
    const q = patientSearch.toLowerCase().replace(/[.\-\/\s]/g, '');
    return patients.filter(p => {
      if (p.full_name.toLowerCase().includes(patientSearch.toLowerCase())) return true;
      const norm = (v: string | null) => (v ?? '').replace(/[.\-\/\s]/g, '');
      if (q && norm(p.cpf).includes(q)) return true;
      if (q && norm(p.rg).includes(q)) return true;
      if (q && norm(p.insurance_number).includes(q)) return true;
      return false;
    });
  }, [patients, patientSearch]);

  const selectedPatient = patients.find(p => p.id === patientId) ?? null;
  const selectedPatientName = selectedPatient?.full_name ?? '';

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

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

    // Validate time before submitting (catches manual mode errors too)
    const timeValidation = validateTime(startTime);
    if (!timeValidation.valid) {
      setTimeMode('manual');
      setManualError(timeValidation.reason ?? 'Horário inválido.');
      toast.error(timeValidation.reason ?? 'Horário inválido.');
      return;
    }

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
      <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Consulta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <div className="flex gap-1.5">
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
                      'flex h-10 flex-1 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                      !patientId && 'text-muted-foreground'
                    )}
                  >
                    {selectedPatient ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-5 w-5 flex-shrink-0">
                          <AvatarImage src={selectedPatient.photo_url ?? undefined} className="object-cover" />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{getInitials(selectedPatient.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{selectedPatient.full_name}</span>
                      </div>
                    ) : (
                      <span className="truncate">Selecione o paciente</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[340px]" align="start" sideOffset={4}>
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Nome, CPF, RG ou carteirinha..."
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
                                <div className="flex items-center gap-2.5 w-full">
                                  <Avatar className="h-7 w-7 flex-shrink-0">
                                    <AvatarImage src={p.photo_url ?? undefined} className="object-cover" />
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(p.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{p.full_name}</p>
                                    {(p.cpf || p.insurance_number) && (
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {p.cpf ? `CPF: ${p.cpf}` : ''}
                                        {p.cpf && p.insurance_number ? ' · ' : ''}
                                        {p.insurance_number ? `Carteirinha: ${p.insurance_number}` : ''}
                                      </p>
                                    )}
                                  </div>
                                  <Check className={cn('h-4 w-4 flex-shrink-0', patientId === p.id ? 'opacity-100' : 'opacity-0')} />
                                </div>
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

              {/* Botão ampliar dados do paciente */}
              {selectedPatient && (
                <Popover open={patientPreviewOpen} onOpenChange={setPatientPreviewOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Ver dados do paciente"
                      className="h-10 w-10 flex-shrink-0 inline-flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end" sideOffset={4}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={selectedPatient.photo_url ?? undefined} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{getInitials(selectedPatient.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight">{selectedPatient.full_name}</p>
                          {selectedPatient.date_of_birth && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {differenceInYears(new Date(), parseISO(selectedPatient.date_of_birth))} anos
                            </p>
                          )}
                        </div>
                      </div>
                      {(selectedPatient.cpf || selectedPatient.rg || selectedPatient.insurance_number || selectedPatient.insurance_provider || selectedPatient.phone) && (
                        <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs">
                          {selectedPatient.cpf && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">CPF</span>
                              <span className="font-mono font-medium">{selectedPatient.cpf}</span>
                            </div>
                          )}
                          {selectedPatient.rg && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">RG</span>
                              <span className="font-mono font-medium">{selectedPatient.rg}</span>
                            </div>
                          )}
                          {selectedPatient.insurance_number && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Carteirinha</span>
                              <span className="font-mono font-medium">{selectedPatient.insurance_number}</span>
                            </div>
                          )}
                          {selectedPatient.insurance_provider && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Plano</span>
                              <span className="font-medium">{selectedPatient.insurance_provider}</span>
                            </div>
                          )}
                          {selectedPatient.phone && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Telefone</span>
                              <span className="font-medium">{selectedPatient.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="border-t px-4 py-2.5">
                      <a
                        href={`/patients/${selectedPatient.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver prontuário completo
                      </a>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
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
                {procedures.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum procedimento cadastrado no catálogo.
                  </div>
                )}
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
              <div className="flex items-center justify-between">
                <Label>Horário</Label>
                {timeMode === 'select' ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setTimeMode('manual'); setManualError(null); }}
                  >
                    <Pencil className="h-3 w-3" /> Inserir manual
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                    onClick={() => { setTimeMode('select'); setManualError(null); }}
                  >
                    <ChevronLeft className="h-3 w-3" /> Ver sugestões
                  </button>
                )}
              </div>
              {timeMode === 'select' ? (
                slotsLoading ? (
                  <div className="h-10 flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando horários…
                  </div>
                ) : emptyMessage ? (
                  <div className="h-10 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {emptyMessage}
                  </div>
                ) : (
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {slot}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ) : (
                <div className="space-y-1">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      if (e.target.value) {
                        const result = validateTime(e.target.value);
                        setManualError(result.valid ? null : (result.reason ?? null));
                      } else {
                        setManualError(null);
                      }
                    }}
                    required
                    className={manualError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {manualError && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      {manualError}
                    </p>
                  )}
                  {!manualError && clinicHoursLabel && (
                    <p className="text-[11px] text-muted-foreground">Expediente: {clinicHoursLabel}</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={15} step={15} />
            </div>
          </div>

          {/* Find next free slot */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 w-full"
            disabled={slotsLoading}
            onClick={() => {
              const next = findNextSlot();
              if (next) {
                setStartTime(next);
                setTimeMode('select');
                setManualError(null);
              } else {
                toast.warning(emptyMessage ?? 'Nenhum horário livre encontrado neste dia.');
              }
            }}
          >
            {slotsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Encontrar próximo horário livre
          </Button>

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
            (old: any[] | undefined) => {
              const list = old ?? [];
              if (list.some((p: any) => p.id === id)) return list;
              return [...list, { id, full_name: name, photo_url: null, cpf: null, rg: null, insurance_number: null, insurance_provider: null, date_of_birth: null, phone: null }].sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
            }
          );
        }}
        onSuccess={() => {}}
      />
    </Dialog>
  );
}
