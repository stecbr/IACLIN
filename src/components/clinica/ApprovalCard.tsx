import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Stethoscope, Calendar, Clock, CheckCircle2, X, CalendarClock } from 'lucide-react';
import { specialtyLabel } from '@/components/SpecialtySelect';

export interface AppointmentRequest {
  id: string;
  patient_user_id: string;
  patient_account_snapshot: { full_name?: string; cpf?: string; phone?: string } | null;
  dentist_id: string;
  specialty: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  dentist_name?: string;
  dentist_avatar_url?: string | null;
  patient_avatar_url?: string | null;
}

interface Props {
  request: AppointmentRequest;
  onApprove?: () => void;
  onReschedule?: () => void;
  onReject?: () => void;
  loading?: boolean;
}

function initials(name?: string) {
  return (name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function ApprovalCard({ request, onApprove, onReschedule, onReject, loading }: Props) {
  const snapshot = request.patient_account_snapshot ?? {};
  const patientName = snapshot.full_name ?? 'Paciente';
  const isPending = request.status === 'pending';

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header: patient */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={request.patient_avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials(patientName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium truncate">{patientName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {snapshot.phone ?? snapshot.cpf ?? 'Sem contato'}
              </p>
            </div>
          </div>
          {request.status === 'pending' && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
              Pendente
            </Badge>
          )}
          {request.status === 'approved' && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
              Aprovado
            </Badge>
          )}
          {request.status === 'rejected' && (
            <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30">
              Recusado
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {/* Doctor with avatar */}
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5 flex-shrink-0">
              <AvatarImage src={request.dentist_avatar_url ?? undefined} />
              <AvatarFallback className="text-[9px] bg-muted">
                {initials(request.dentist_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{request.dentist_name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" />
            <span className="truncate">{request.specialty ? specialtyLabel(request.specialty) : 'Consulta'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(parseISO(request.start_time), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {format(parseISO(request.start_time), 'HH:mm')} – {format(parseISO(request.end_time), 'HH:mm')}
            </span>
          </div>
        </div>

        {request.notes && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
            <span className="font-medium">Obs:</span> {request.notes}
          </div>
        )}

        {request.rejection_reason && (
          <div className="text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-md p-2">
            <span className="font-medium">Motivo:</span> {request.rejection_reason}
          </div>
        )}

        {isPending && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={onApprove} disabled={loading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={onReschedule} disabled={loading} className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Reagendar
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={loading} className="gap-1.5 text-rose-600 hover:text-rose-700 hover:border-rose-300">
              <X className="h-3.5 w-3.5" /> Recusar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}