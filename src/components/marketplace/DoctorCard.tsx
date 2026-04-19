import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isAfter, isBefore, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, ChevronRight, Sparkles } from "lucide-react";

interface Appointment {
  start_time: string;
  end_time: string;
  status: string;
}

export interface AvailabilityShift {
  date: string; // YYYY-MM-DD
  start: string; // HH:MM:SS
  end: string;
}

export interface DoctorData {
  userId: string;
  specialty: string | null;
  fullName: string;
  avatarUrl: string | null;
  clinicId: string;
  clinicName: string;
  clinicCity: string | null;
  clinicState: string | null;
  clinicPhone: string | null;
  clinicAddress: string | null;
  clinicZipCode: string | null;
  shifts: AvailabilityShift[];
  appointments: Appointment[];
}

function generateSlotsForDate(
  shifts: AvailabilityShift[],
  date: Date,
  appointments: Appointment[]
): string[] {
  const dateKey = format(date, "yyyy-MM-dd");
  const dayShifts = shifts.filter((s) => s.date === dateKey);
  if (dayShifts.length === 0) return [];

  const now = new Date();
  const slots: string[] = [];

  for (const sh of dayShifts) {
    const [oh, om] = sh.start.split(":").map(Number);
    const [ch, cm] = sh.end.split(":").map(Number);
    const start = new Date(date);
    start.setHours(oh, om, 0, 0);
    const end = new Date(date);
    end.setHours(ch, cm, 0, 0);

    let cursor = new Date(start);
    while (cursor < end) {
      const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
      if (isSameDay(date, now) && isBefore(cursor, now)) {
        cursor = slotEnd;
        continue;
      }
      const conflict = appointments.some((apt) => {
        if (apt.status === "cancelled") return false;
        const aptStart = new Date(apt.start_time);
        const aptEnd = new Date(apt.end_time);
        return isBefore(cursor, aptEnd) && isAfter(slotEnd, aptStart);
      });
      if (!conflict) {
        slots.push(format(cursor, "HH:mm"));
      }
      cursor = slotEnd;
    }
  }
  return slots;
}

interface DoctorCardProps {
  doctor: DoctorData;
  onShowOnMap?: (clinicId: string) => void;
}

export function DoctorCard({ doctor, onShowOnMap }: DoctorCardProps) {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  // Group days from shifts
  const days = useMemo(() => {
    const uniqueDates = [...new Set(doctor.shifts.map((s) => s.date))].sort();
    const limit = showMore ? 7 : 4;
    return uniqueDates.slice(0, limit).map((dateStr) => {
      const date = parseISO(dateStr);
      const dayAppts = doctor.appointments.filter((a) => isSameDay(new Date(a.start_time), date));
      const slots = generateSlotsForDate(doctor.shifts, date, dayAppts);
      return { date, slots };
    });
  }, [doctor, showMore]);

  const nextSlot = useMemo(() => {
    for (const day of days) {
      if (day.slots.length > 0) {
        return { date: day.date, time: day.slots[0] };
      }
    }
    return null;
  }, [days]);

  const initials = doctor.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSlotClick = (date: Date, time: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    navigate(`/marketplace/agendar?dentistId=${doctor.userId}&clinicId=${doctor.clinicId}&date=${dateStr}&time=${time}`);
  };

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarImage src={doctor.avatarUrl ?? undefined} alt={doctor.fullName} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">{doctor.fullName}</h3>
            <p className="truncate text-sm text-muted-foreground">{doctor.clinicName}</p>
            {(doctor.clinicCity || doctor.clinicState) && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{[doctor.clinicCity, doctor.clinicState].filter(Boolean).join(", ")}</span>
                {onShowOnMap && (
                  <button
                    type="button"
                    className="ml-1 text-primary hover:underline"
                    onClick={() => onShowOnMap(doctor.clinicId)}
                  >
                    Ver no mapa
                  </button>
                )}
              </div>
            )}
            {doctor.clinicPhone && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{doctor.clinicPhone}</span>
              </div>
            )}
            {nextSlot && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-primary font-medium">
                <Sparkles className="h-3 w-3" />
                <span>
                  Próximo horário: {format(nextSlot.date, "dd/MM", { locale: ptBR })} às {nextSlot.time}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Schedule grid */}
        {days.length > 0 && (
          <div className="mt-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 4)}, 1fr)` }}>
              {days.map(({ date, slots }) => (
                <div key={date.toISOString()} className="min-w-0">
                  <p className="mb-1.5 text-center text-xs font-medium capitalize text-muted-foreground">
                    {format(date, "EEE, dd/MM", { locale: ptBR })}
                  </p>
                  <div className="flex flex-col gap-1">
                    {slots.length === 0 ? (
                      <span className="py-2 text-center text-[11px] text-muted-foreground/60">—</span>
                    ) : (
                      slots.slice(0, 4).map((time) => (
                        <Button
                          key={time}
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                          onClick={() => handleSlotClick(date, time)}
                        >
                          {time}
                        </Button>
                      ))
                    )}
                    {slots.length > 4 && (
                      <span className="text-center text-[11px] text-muted-foreground">
                        +{slots.length - 4} horários
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!showMore && doctor.shifts.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs text-primary"
                onClick={() => setShowMore(true)}
              >
                Mostrar mais horários <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
