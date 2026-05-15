import { format, isAfter, isBefore } from 'date-fns';
import { motion } from 'framer-motion';
import { Play, ArrowRight, UserCheck, ExternalLink, FolderHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface DayAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  presence_status: string;
  service_started_at: string | null;
  patient_id: string;
  dentist_id: string;
  patients?: { full_name: string; photo_url: string | null } | null;
  procedures?: { name: string; color: string } | null;
  dentist_name?: string | null;
}

const presenceLabels: Record<string, { label: string; tone: string }> = {
  not_arrived: { label: 'Aguardado', tone: 'bg-muted text-muted-foreground' },
  arrived: { label: 'Na recepção', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  in_service: { label: 'Em atendimento', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  finished: { label: 'Finalizado', tone: 'bg-primary/10 text-primary' },
  no_show: { label: 'Falta', tone: 'bg-destructive/10 text-destructive' },
};

interface Props {
  appointment: DayAppointment;
  isActiveSession: boolean;
  busy: boolean;
  showDentist?: boolean;
  canMarkArrived?: boolean;
  onStart: () => void;
  onResume: () => void;
  onMarkArrived: () => void;
  onOpenPatient: () => void;
}

export function DayAppointmentRow({
  appointment: a,
  isActiveSession,
  busy,
  showDentist,
  canMarkArrived = true,
  onStart,
  onResume,
  onMarkArrived,
  onOpenPatient,
}: Props) {
  const start = new Date(a.start_time);
  const end = new Date(a.end_time);
  const now = new Date();
  const isNow = isBefore(start, now) && isAfter(end, now);
  const isLate = isAfter(now, end) && a.presence_status !== 'finished' && a.presence_status !== 'in_service';
  const isUpcoming = isAfter(start, now);

  const presence = presenceLabels[a.presence_status] ?? presenceLabels.not_arrived;
  const initials = a.patients?.full_name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  const canStart = a.presence_status !== 'finished' && a.presence_status !== 'no_show' && a.status !== 'completed' && a.status !== 'cancelled';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors',
        isNow && 'border-primary/40 shadow-sm',
        isActiveSession && 'border-emerald-500/50 bg-emerald-500/5'
      )}
    >
      {/* Time block */}
      <div className="flex flex-col items-center justify-center min-w-[64px] text-center">
        <span className={cn('text-base font-semibold', isNow ? 'text-primary' : 'text-foreground')}>
          {format(start, 'HH:mm')}
        </span>
        <span className="text-[11px] text-muted-foreground">{format(end, 'HH:mm')}</span>
        {isNow && (
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-primary">Agora</span>
        )}
        {isLate && !isNow && (
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-destructive">Atrasado</span>
        )}
        {isUpcoming && !isNow && (
          <span className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground/70">Em breve</span>
        )}
      </div>

      {/* Color stripe */}
      <div
        className="self-stretch w-1 rounded-full"
        style={{ background: a.procedures?.color ?? 'hsl(var(--muted))' }}
      />

      {/* Patient info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10">
          {a.patients?.photo_url && <AvatarImage src={a.patients.photo_url} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <button
            onClick={onOpenPatient}
            className="text-sm font-medium text-foreground hover:underline truncate text-left flex items-center gap-1"
          >
            {a.patients?.full_name ?? 'Paciente'}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {a.procedures?.name && (
              <span className="text-xs text-muted-foreground truncate">{a.procedures.name}</span>
            )}
            {showDentist && a.dentist_name && (
              <span className="text-xs text-muted-foreground">· Dr(a). {a.dentist_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <Badge variant="outline" className={cn('border-0', presence.tone)}>
        {presence.label}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onOpenPatient} title="Abrir prontuário" className="text-muted-foreground hover:text-primary">
          <FolderHeart className="h-4 w-4 mr-1" /> Prontuário
        </Button>
        {a.presence_status === 'not_arrived' && canMarkArrived && (
          <Button size="sm" variant="outline" onClick={onMarkArrived} disabled={busy}>
            <UserCheck className="h-4 w-4 mr-1" /> Chegou
          </Button>
        )}
        {isActiveSession ? (
          <Button size="sm" onClick={onResume} className="bg-emerald-600 hover:bg-emerald-600/90 text-white">
            <ArrowRight className="h-4 w-4 mr-1" /> Voltar
          </Button>
        ) : (
          canStart && (
            <Button size="sm" onClick={onStart} disabled={busy}>
              <Play className="h-4 w-4 mr-1" /> Iniciar
            </Button>
          )
        )}
      </div>
    </motion.div>
  );
}