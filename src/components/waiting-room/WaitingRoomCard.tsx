import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, UserCheck, Play, CheckCircle2, UserX, Stethoscope } from 'lucide-react';
import { WaitingTimer } from './WaitingTimer';
import { getAvatarColor, getInitials } from '@/lib/avatarColor';
import { useNavigate } from 'react-router-dom';

export interface WaitingRoomAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  presence_status: string;
  arrived_at: string | null;
  service_started_at: string | null;
  patient_id: string;
  dentist_id: string;
  patients?: { full_name: string; photo_url: string | null } | null;
  procedures?: { name: string; color: string } | null;
  dentist_name?: string | null;
  dentist_specialty?: string | null;
}

interface Props {
  appointment: WaitingRoomAppointment;
  onMarkArrived: (id: string) => void;
  onMarkInService: (id: string) => void;
  onMarkFinished: (id: string) => void;
  onMarkNoShow: (id: string) => void;
  busyId?: string | null;
}

export function WaitingRoomCard({
  appointment,
  onMarkArrived,
  onMarkInService,
  onMarkFinished,
  onMarkNoShow,
  busyId,
}: Props) {
  const navigate = useNavigate();
  const presence = appointment.presence_status;
  const startsAt = parseISO(appointment.start_time);
  const now = new Date();
  const minutesDiff = differenceInMinutes(startsAt, now);
  const patientName = appointment.patients?.full_name ?? 'Paciente';
  const procedureName = appointment.procedures?.name ?? 'Consulta';
  const procedureColor = appointment.procedures?.color ?? 'hsl(var(--primary))';
  const isBusy = busyId === appointment.id;

  const scheduleBadge = () => {
    if (presence !== 'not_arrived') return null;
    if (Math.abs(minutesDiff) < 5) {
      return <Badge variant="secondary" className="text-[10px]">no horário</Badge>;
    }
    if (minutesDiff > 0) {
      return (
        <Badge variant="outline" className="text-[10px]">
          em {minutesDiff} min
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-[10px]">
        atrasado {Math.abs(minutesDiff)} min
      </Badge>
    );
  };

  return (
    <Card
      className="p-4 space-y-3 border-l-4 transition-all hover:shadow-md"
      style={{ borderLeftColor: procedureColor }}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback
            className="text-white text-xs font-semibold"
            style={{ backgroundColor: getAvatarColor(appointment.patient_id) }}
          >
            {getInitials(patientName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/patients/${appointment.patient_id}`)}
            className="text-sm font-semibold text-foreground hover:text-primary text-left truncate block w-full"
          >
            {patientName}
          </button>
          <p className="text-xs text-muted-foreground truncate">{procedureName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">
            {format(startsAt, 'HH:mm', { locale: ptBR })}
          </span>
        </div>
        {scheduleBadge()}
      </div>

      {appointment.dentist_name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Stethoscope className="h-3.5 w-3.5" />
          <span className="truncate">
            Dr(a). {appointment.dentist_name}
            {appointment.dentist_specialty ? ` • ${appointment.dentist_specialty}` : ''}
          </span>
        </div>
      )}

      {presence === 'arrived' && appointment.arrived_at && (
        <div className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <WaitingTimer since={appointment.arrived_at} variant="full" />
        </div>
      )}

      {presence === 'in_service' && appointment.service_started_at && (
        <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" />
          em atendimento há <WaitingTimer since={appointment.service_started_at} />
        </div>
      )}

      {/* Action buttons (contextual) */}
      <div className="flex flex-wrap gap-2 pt-1">
        {presence === 'not_arrived' && (
          <>
            <Button
              size="sm"
              className="flex-1 gap-1.5 h-9"
              onClick={() => onMarkArrived(appointment.id)}
              disabled={isBusy}
            >
              <UserCheck className="h-4 w-4" />
              Marcar chegada
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-9"
              onClick={() => onMarkNoShow(appointment.id)}
              disabled={isBusy}
              title="Marcar falta"
            >
              <UserX className="h-4 w-4" />
            </Button>
          </>
        )}
        {presence === 'arrived' && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onMarkInService(appointment.id)}
            disabled={isBusy}
          >
            <Play className="h-4 w-4" />
            Iniciar atendimento
          </Button>
        )}
        {presence === 'in_service' && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 h-9"
            onClick={() => onMarkFinished(appointment.id)}
            disabled={isBusy}
          >
            <CheckCircle2 className="h-4 w-4" />
            Finalizar
          </Button>
        )}
      </div>
    </Card>
  );
}