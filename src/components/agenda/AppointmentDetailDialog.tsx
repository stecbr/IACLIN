import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, User, Stethoscope, FileText, Play, X, Eye, UserCheck, FolderHeart, CalendarClock, Tag } from 'lucide-react';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AttendanceSummaryModal } from '@/components/attendance/AttendanceSummaryModal';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { WaitingTimer } from '@/components/waiting-room/WaitingTimer';
import { syncAgendaAppointments } from '@/hooks/useAiSync';

interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string;
  clinic_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  procedure_id: string | null;
  presence_status?: string | null;
  arrived_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  label?: string | null;
  patients?: { full_name: string } | null;
  procedures?: { name: string; color: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onStatusChange: () => void;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Concluída',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
  in_progress: 'Em Atendimento',
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  no_show: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const labelMeta: Record<string, { label: string; color: string }> = {
  primeira_consulta: { label: 'Primeira Consulta', color: '#6366f1' },
  retorno: { label: 'Retorno', color: '#f59e0b' },
  urgencia: { label: 'Urgência', color: '#ef4444' },
  preventivo: { label: 'Preventivo', color: '#22c55e' },
  estetico: { label: 'Estético', color: '#ec4899' },
};

export function AppointmentDetailDialog({ open, onOpenChange, appointment, onStatusChange }: Props) {
  const navigate = useNavigate();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const { effectiveRole } = useRoleAccess();
  const canViewPatient = effectiveRole !== 'patient';

  if (!appointment) return null;

  const procedureColor = appointment.procedures?.color ?? 'hsl(var(--primary))';

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const update =
        newStatus === 'cancelled'
          ? { status: newStatus, cancelled_by: 'clinic', cancelled_at: new Date().toISOString() }
          : { status: newStatus };
      const { error } = await supabase
        .from('appointments')
        .update(update)
        .eq('id', appointment.id);
      if (error) throw error;
      toast.success(`Status alterado para: ${statusLabels[newStatus] ?? newStatus}`);
      if (newStatus === 'cancelled' && appointment.clinic_id) {
        syncAgendaAppointments(appointment.clinic_id);
      }
      onStatusChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStartAttendance = () => {
    onOpenChange(false);
    navigate(`/atendimento/${appointment.id}`);
  };

  const handleOpenPatient = () => {
    if (!canViewPatient) return;
    onOpenChange(false);
    navigate(`/patients/${appointment.patient_id}`);
  };

  const confirmCancel = async () => {
    setShowCancelConfirm(false);
    await handleStatusChange('cancelled');
    onOpenChange(false);
  };

  const openReschedule = () => {
    const d = parseISO(appointment.start_time);
    setRescheduleDate(format(d, 'yyyy-MM-dd'));
    setRescheduleTime(format(d, 'HH:mm'));
    setShowReschedule(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Informe data e horário');
      return;
    }
    setRescheduling(true);
    try {
      const duration = differenceInMinutes(parseISO(appointment.end_time), parseISO(appointment.start_time));
      const newStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const newEnd = new Date(newStart.getTime() + duration * 60000);
      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
          status: 'scheduled',
        })
        .eq('id', appointment.id);
      if (error) throw error;
      toast.success('Consulta remarcada');
      if (appointment.clinic_id) syncAgendaAppointments(appointment.clinic_id);
      setShowReschedule(false);
      onStatusChange();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRescheduling(false);
    }
  };

  const canStartAttendance =
    ['scheduled', 'confirmed'].includes(appointment.status) && effectiveRole === 'dentist';
  const now = new Date();
  const startsAt = parseISO(appointment.start_time);
  const endsAt = parseISO(appointment.end_time);
  const minutesUntilStart = (startsAt.getTime() - now.getTime()) / 60000;
  const isStartingSoon = canStartAttendance && minutesUntilStart <= 30 && now.getTime() <= endsAt.getTime() + 60 * 60000;
  const canCancel = !['cancelled', 'completed'].includes(appointment.status);
  const canReschedule = !['cancelled', 'completed'].includes(appointment.status);
  const isCompleted = appointment.status === 'completed';
  const isInProgress = appointment.status === 'in_progress' && effectiveRole === 'dentist';
  const isCancelled = appointment.status === 'cancelled';
  const cancelledByLabel =
    appointment.cancelled_by === 'patient'
      ? 'Cancelada pelo paciente'
      : appointment.cancelled_by === 'clinic'
      ? 'Cancelada pela clínica'
      : null;
  const presence = appointment.presence_status;
  const showArrivedBanner = presence === 'arrived' && !!appointment.arrived_at;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: procedureColor }} />
            Detalhes da Consulta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient */}
          {canViewPatient ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenPatient}
                    className="group w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-primary/10 transition-colors text-left"
                  >
                    <FolderHeart className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                        {appointment.patients?.full_name ?? 'Paciente'}
                      </p>
                      <p className="text-xs text-muted-foreground">Abrir prontuário</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Abrir prontuário do paciente</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{appointment.patients?.full_name ?? 'Paciente'}</p>
                <p className="text-xs text-muted-foreground">Paciente</p>
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-medium">
                  {format(parseISO(appointment.start_time), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="text-sm font-medium">
                  {format(parseISO(appointment.start_time), 'HH:mm')} - {format(parseISO(appointment.end_time), 'HH:mm')}
                </p>
              </div>
            </div>
          </div>

          {/* Procedure */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Procedimento</p>
              <p className="text-sm font-medium">{appointment.procedures?.name ?? 'Consulta geral'}</p>
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm">{appointment.notes}</p>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Status:</p>
              <Badge
                className={
                  isCancelled
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : statusColors[appointment.status] ?? ''
                }
              >
                {isCancelled && cancelledByLabel
                  ? cancelledByLabel
                  : statusLabels[appointment.status] ?? appointment.status}
              </Badge>
            </div>
            <Select
              value={appointment.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Presence banner */}
          {showArrivedBanner && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <UserCheck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                Paciente já chegou —{' '}
                <WaitingTimer since={appointment.arrived_at!} variant="full" />
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {isCompleted && (
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs font-normal" onClick={() => setShowSummary(true)}>
                <Eye className="h-3.5 w-3.5" />
                Ver resumo do atendimento
              </Button>
            )}
            {canStartAttendance && (
              <Button
                size="sm"
                className={`flex-1 gap-1.5 text-xs font-normal ${isStartingSoon ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse' : ''}`}
                onClick={handleStartAttendance}
              >
                <Play className="h-3.5 w-3.5" />
                {isStartingSoon ? 'Iniciar atendimento agora' : 'Iniciar Atendimento'}
              </Button>
            )}
            {isInProgress && (
              <>
                <Button size="sm" className="flex-1 gap-1.5 text-xs font-normal" onClick={handleStartAttendance}>
                  <Play className="h-3.5 w-3.5" />
                  Continuar Atendimento
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-normal" onClick={() => setShowSummary(true)}>
                  <Eye className="h-3.5 w-3.5" />
                  Resumo parcial
                </Button>
              </>
            )}
            {canReschedule && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
                onClick={openReschedule}
                disabled={updatingStatus}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Alterar data/horário
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancelConfirm(true)}
                disabled={updatingStatus}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar consulta
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AttendanceSummaryModal
      appointmentId={appointment.id}
      open={showSummary}
      onOpenChange={setShowSummary}
    />

    <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta consulta?</AlertDialogTitle>
          <AlertDialogDescription>
            O paciente receberá uma mensagem automática no WhatsApp pedindo desculpas e oferecendo remarcar.
            Esta ação pode ser desfeita alterando o status manualmente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={updatingStatus}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmCancel}
            disabled={updatingStatus}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancelar consulta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Alterar data e horário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">Nova data</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-time">Novo horário</Label>
            <Input
              id="reschedule-time"
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A duração ({differenceInMinutes(parseISO(appointment.end_time), parseISO(appointment.start_time))} min)
            será mantida. O paciente é avisado automaticamente pela IA no WhatsApp.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowReschedule(false)} disabled={rescheduling}>
            Cancelar
          </Button>
          <Button onClick={handleReschedule} disabled={rescheduling}>
            {rescheduling ? 'Salvando...' : 'Remarcar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}