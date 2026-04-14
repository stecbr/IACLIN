import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, parse, isAfter, isBefore, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Appointment {
  start_time: string;
  end_time: string;
  status: string;
}

interface BusinessHours {
  [key: string]: { open: string; close: string; enabled: boolean };
}

export interface DoctorData {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  clinicId: string;
  clinicName: string;
  clinicCity: string | null;
  clinicState: string | null;
  clinicPhone: string | null;
  businessHours: BusinessHours | null;
  appointments: Appointment[];
}

const DAY_MAP: Record<number, string> = {
  0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
};

function generateSlots(date: Date, bh: BusinessHours | null, appointments: Appointment[]): string[] {
  const dayKey = DAY_MAP[date.getDay()];
  const dayConfig = bh?.[dayKey];
  if (!dayConfig?.enabled) return [];

  const openTime = parse(dayConfig.open, "HH:mm", date);
  const closeTime = parse(dayConfig.close, "HH:mm", date);
  const now = new Date();
  const slots: string[] = [];

  let cursor = openTime;
  while (isBefore(cursor, closeTime)) {
    const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
    // Skip past slots
    if (isSameDay(date, now) && isBefore(cursor, now)) {
      cursor = slotEnd;
      continue;
    }
    // Check conflicts
    const hasConflict = appointments.some((apt) => {
      if (apt.status === "cancelled") return false;
      const aptStart = new Date(apt.start_time);
      const aptEnd = new Date(apt.end_time);
      return isBefore(cursor, aptEnd) && isAfter(slotEnd, aptStart);
    });
    if (!hasConflict) {
      slots.push(format(cursor, "HH:mm"));
    }
    cursor = slotEnd;
  }
  return slots;
}

export function DoctorCard({ doctor }: { doctor: DoctorData }) {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const numDays = showMore ? 7 : 4;
    return Array.from({ length: numDays }, (_, i) => {
      const date = addDays(today, i);
      const dayAppts = doctor.appointments.filter((a) => isSameDay(new Date(a.start_time), date));
      const slots = generateSlots(date, doctor.businessHours, dayAppts);
      return { date, slots };
    });
  }, [doctor, showMore]);

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
              </div>
            )}
            {doctor.clinicPhone && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{doctor.clinicPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Schedule grid */}
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
          {!showMore && (
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
      </CardContent>
    </Card>
  );
}
