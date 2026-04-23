import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAvatarColor, getInitials } from '@/lib/avatarColor';
import type { DoctorOption } from './AgendaDoctorFilter';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Concluída',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
};

interface Props {
  days: Date[];
  doctors: DoctorOption[];
  appointments: any[];
  onSlotClick: (day: Date, hour: number, doctorId: string) => void;
  onAppointmentClick: (apt: any) => void;
}

export function AgendaCompareView({ days, doctors, appointments, onSlotClick, onAppointmentClick }: Props) {
  const subColumns = doctors.length;
  const totalCols = days.length * subColumns;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
      {/* Day Headers */}
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="p-2 border-r border-border" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center border-r border-border last:border-r-0 ${isToday(day) ? 'bg-primary/5' : ''}`}
          >
            <p className="text-xs text-muted-foreground capitalize">{format(day, 'EEE', { locale: ptBR })}</p>
            <div
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full mt-0.5 ${
                isToday(day) ? 'bg-primary text-primary-foreground font-bold' : ''
              }`}
            >
              <span className={`text-base font-semibold ${isToday(day) ? '' : 'text-foreground'}`}>
                {format(day, 'dd')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Doctor sub-headers */}
      <div
        className="grid border-b border-border bg-muted/30"
        style={{ gridTemplateColumns: `60px repeat(${totalCols}, minmax(0, 1fr))` }}
      >
        <div className="border-r border-border" />
        {days.map((day) =>
          doctors.map((d, idx) => (
            <div
              key={day.toISOString() + d.user_id}
              className={`flex items-center justify-center gap-1 py-1.5 text-[10px] border-r border-border ${
                idx === doctors.length - 1 ? '' : ''
              }`}
              title={d.full_name}
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                style={{ backgroundColor: getAvatarColor(d.user_id) }}
              >
                {getInitials(d.full_name)}
              </span>
              <span className="truncate text-muted-foreground font-medium">
                {d.full_name.split(' ')[0]}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Time grid */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid border-b border-border last:border-b-0"
            style={{ gridTemplateColumns: `60px repeat(${totalCols}, minmax(0, 1fr))` }}
          >
            <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r border-border h-[60px] flex items-start justify-end pt-1">
              {`${hour}:00`}
            </div>
            {days.map((day) =>
              doctors.map((d) => {
                const cellApts = appointments.filter((a: any) => {
                  const dt = parseISO(a.start_time);
                  return (
                    dt.getFullYear() === day.getFullYear() &&
                    dt.getMonth() === day.getMonth() &&
                    dt.getDate() === day.getDate() &&
                    dt.getHours() === hour &&
                    a.dentist_id === d.user_id
                  );
                });
                return (
                  <div
                    key={day.toISOString() + hour + d.user_id}
                    className="min-h-[60px] p-1 border-r border-border last:border-r-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onSlotClick(day, hour, d.user_id)}
                  >
                    {cellApts.map((apt: any) => {
                      const procedureColor = apt.procedures?.color ?? 'hsl(var(--primary))';
                      return (
                        <Tooltip key={apt.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="rounded-md px-1.5 py-1 mb-0.5 text-[10px] transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick(apt);
                              }}
                              style={{
                                backgroundColor: `${procedureColor}15`,
                                borderLeft: `2px solid ${procedureColor}`,
                              }}
                            >
                              <p className="font-medium truncate text-foreground">
                                {apt.patients?.full_name}
                              </p>
                              <p className="text-muted-foreground truncate">
                                {apt.procedures?.name ?? 'Consulta'}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[220px]">
                            <div className="space-y-1">
                              <p className="font-semibold">{apt.patients?.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {apt.procedures?.name ?? 'Consulta'}
                              </p>
                              <p className="text-xs">
                                {format(parseISO(apt.start_time), 'HH:mm')} -{' '}
                                {format(parseISO(apt.end_time), 'HH:mm')}
                              </p>
                              <p className="text-xs capitalize">
                                {statusLabels[apt.status] ?? apt.status}
                              </p>
                              <p className="text-xs">Dr(a). {d.full_name}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}