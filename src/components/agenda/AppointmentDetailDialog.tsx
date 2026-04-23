import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, User, Stethoscope, FileText, Play, X, Eye } from 'lucide-react';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AttendanceSummaryModal } from '@/components/attendance/AttendanceSummaryModal';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

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

export function AppointmentDetailDialog({ open, onOpenChange, appointment, onStatusChange }: Props) {
  const navigate = useNavigate();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const { effectiveRole } = useRoleAccess();
  const canViewPatient = effectiveRole !== 'patient';

  if (!appointment) return null;

  const procedureColor = appointment.procedures?.color ?? 'hsl(var(--primary))';

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id);
      if (error) throw error;
      toast.success(`Status alterado para: ${statusLabels[newStatus] ?? newStatus}`);
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

  const handleCancel = async () => {
    await handleStatusChange('cancelled');
  };

  const canStartAttendance = ['scheduled', 'confirmed'].includes(appointment.status);
  const now = new Date();
  const startsAt = parseISO(appointment.start_time);
  const endsAt = parseISO(appointment.end_time);
  const minutesUntilStart = (startsAt.getTime() - now.getTime()) / 60000;
  const isStartingSoon = canStartAttendance && minutesUntilStart <= 30 && now.getTime() <= endsAt.getTime() + 60 * 60000;
  const canCancel = !['cancelled', 'completed'].includes(appointment.status);
  const isCompleted = appointment.status === 'completed';
  const isInProgress = appointment.status === 'in_progress';

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
                    <User className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                        {appointment.patients?.full_name ?? 'Paciente'}
                      </p>
                      <p className="text-xs text-muted-foreground">Ver ficha completa</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Ver ficha completa do paciente</TooltipContent>
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
              <Badge className={`${statusColors[appointment.status] ?? ''}`}>
                {statusLabels[appointment.status] ?? appointment.status}
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

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {canStartAttendance && (
              <Button
                className={`flex-1 gap-2 ${isStartingSoon ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse' : ''}`}
                onClick={handleStartAttendance}
              >
                <Play className="h-4 w-4" />
                {isStartingSoon ? 'Iniciar atendimento agora' : 'Iniciar Atendimento'}
              </Button>
            )}
            {appointment.status === 'in_progress' && (
              <Button className="flex-1 gap-2" onClick={handleStartAttendance}>
                <Play className="h-4 w-4" />
                Continuar Atendimento
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="icon" onClick={handleCancel} disabled={updatingStatus}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}