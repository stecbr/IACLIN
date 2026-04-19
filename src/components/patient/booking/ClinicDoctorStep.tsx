import { useEffect, useState } from 'react';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, MapPin, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Specialty } from './SpecialtyStep';

export interface BookingSelection {
  clinicId: string;
  clinicName: string;
  clinicAddress: string | null;
  clinicCity: string | null;
  dentistId: string;
  dentistName: string;
  dentistAvatar: string | null;
  startTime: Date;
  endTime: Date;
}

interface ClinicDoctorStepProps {
  specialty: Specialty;
  date: Date;
  selected: BookingSelection | null;
  onSelect: (s: BookingSelection) => void;
  onBack: () => void;
}

interface DoctorWithShifts {
  id: string;
  name: string;
  avatar: string | null;
  shifts: { start: string; end: string }[]; // HH:MM
}

interface ClinicWithDoctors {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  doctors: DoctorWithShifts[];
  bookedSlots: Set<string>; // `${dentistId}|${iso}`
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateSlots(shifts: { start: string; end: string }[], date: Date): Date[] {
  const slots: Date[] = [];
  for (const sh of shifts) {
    const [oh, om] = sh.start.split(':').map(Number);
    const [ch, cm] = sh.end.split(':').map(Number);
    const start = new Date(date);
    start.setHours(oh, om, 0, 0);
    const end = new Date(date);
    end.setHours(ch, cm, 0, 0);
    const cur = new Date(start);
    while (cur < end) {
      slots.push(new Date(cur));
      cur.setMinutes(cur.getMinutes() + 30);
    }
  }
  return slots;
}

export function ClinicDoctorStep({ specialty, date, selected, onSelect, onBack }: ClinicDoctorStepProps) {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<ClinicWithDoctors[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const dateKey = toLocalDateStr(date);

      // 1. Fetch all members with this specialty
      const { data: members } = await supabase
        .from('clinic_members')
        .select('clinic_id, user_id, role, specialty')
        .filter('specialty', 'eq', specialty.id)
        .in('role', ['dentist', 'admin']);

      if (!members || members.length === 0) {
        if (!cancelled) { setClinics([]); setLoading(false); }
        return;
      }

      const userIds = [...new Set(members.map((m: any) => m.user_id))];
      const clinicIds = [...new Set(members.map((m: any) => m.clinic_id))];

      // 2. Fetch availability shifts for those users on the date
      const { data: avails } = await supabase
        .from('professional_availability')
        .select('user_id, clinic_id, start_time, end_time, work_date')
        .in('user_id', userIds)
        .in('clinic_id', clinicIds)
        .eq('work_date', dateKey);

      const shiftsByUserClinic = new Map<string, { start: string; end: string }[]>();
      for (const a of (avails ?? []) as any[]) {
        const k = `${a.user_id}|${a.clinic_id}`;
        const arr = shiftsByUserClinic.get(k) ?? [];
        arr.push({ start: (a.start_time as string).slice(0, 5), end: (a.end_time as string).slice(0, 5) });
        shiftsByUserClinic.set(k, arr);
      }

      // Filter members down to those that actually have shifts on this date
      const membersWithShifts = members.filter((m: any) => shiftsByUserClinic.has(`${m.user_id}|${m.clinic_id}`));
      if (membersWithShifts.length === 0) {
        if (!cancelled) { setClinics([]); setLoading(false); }
        return;
      }

      const activeUserIds = [...new Set(membersWithShifts.map((m: any) => m.user_id))];
      const activeClinicIds = [...new Set(membersWithShifts.map((m: any) => m.clinic_id))];

      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

      const [{ data: profs }, { data: clinicsData }, { data: appts }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', activeUserIds),
        supabase.from('clinics').select('id, name, address, city').in('id', activeClinicIds),
        supabase
          .from('appointments')
          .select('dentist_id, start_time, status, clinic_id')
          .in('clinic_id', activeClinicIds)
          .gte('start_time', dayStart.toISOString())
          .lte('start_time', dayEnd.toISOString())
          .neq('status', 'cancelled'),
      ]);

      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const clinicMap = new Map((clinicsData ?? []).map((c: any) => [c.id, c]));

      // Group by clinic
      const byClinic = new Map<string, ClinicWithDoctors>();
      for (const m of membersWithShifts as any[]) {
        const c = clinicMap.get(m.clinic_id);
        if (!c) continue;
        const p = profMap.get(m.user_id);
        if (!p) continue;
        const shifts = shiftsByUserClinic.get(`${m.user_id}|${m.clinic_id}`) ?? [];
        let entry = byClinic.get(m.clinic_id);
        if (!entry) {
          entry = {
            id: c.id,
            name: c.name,
            address: c.address,
            city: c.city,
            doctors: [],
            bookedSlots: new Set<string>(),
          };
          byClinic.set(m.clinic_id, entry);
        }
        entry.doctors.push({
          id: m.user_id,
          name: p.full_name ?? 'Profissional',
          avatar: p.avatar_url,
          shifts,
        });
      }

      // Booked slots per clinic
      for (const a of (appts ?? []) as any[]) {
        const entry = byClinic.get(a.clinic_id);
        if (entry) entry.bookedSlots.add(`${a.dentist_id}|${a.start_time}`);
      }

      const result = Array.from(byClinic.values());
      if (!cancelled) {
        setClinics(result);
        if (result.length === 1) setExpanded(result[0].id);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [specialty, date]);

  const isSlotBooked = (clinic: ClinicWithDoctors, doctorId: string, slot: Date) => {
    for (const key of clinic.bookedSlots) {
      const [did, iso] = key.split('|');
      if (did !== doctorId) continue;
      const booked = parseISO(iso);
      if (Math.abs(booked.getTime() - slot.getTime()) < 30 * 60 * 1000) return true;
    }
    return false;
  };

  const isSlotPast = (slot: Date) => isBefore(slot, new Date());

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Escolha a clínica e o horário</h2>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="capitalize">{format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
          <span>· {specialty.name}</span>
        </p>
      </div>

      {clinics.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium">Nenhum profissional desta especialidade tem horário disponível neste dia</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tente outra data ou outra especialidade.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {clinics.map((clinic) => {
            const isOpen = expanded === clinic.id;
            return (
              <Card key={clinic.id} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : clinic.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{clinic.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {(clinic.address || clinic.city) && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{[clinic.address, clinic.city].filter(Boolean).join(', ')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {clinic.doctors.length} profissional{clinic.doctors.length !== 1 ? 'is' : ''}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-muted/20">
                    {clinic.doctors.map((doctor) => {
                      const slots = generateSlots(doctor.shifts, date);
                      return (
                        <div key={doctor.id} className="p-4 border-b border-border last:border-0">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={doctor.avatar ?? undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {doctor.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{doctor.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {doctor.shifts.map((s) => `${s.start}–${s.end}`).join(', ')}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                            {slots.map((slot) => {
                              const booked = isSlotBooked(clinic, doctor.id, slot);
                              const past = isSlotPast(slot);
                              const isSelected =
                                selected?.dentistId === doctor.id &&
                                selected?.clinicId === clinic.id &&
                                selected?.startTime.getTime() === slot.getTime();
                              const disabled = booked || past;
                              return (
                                <button
                                  key={slot.toISOString()}
                                  disabled={disabled}
                                  onClick={() => {
                                    const end = new Date(slot);
                                    end.setMinutes(end.getMinutes() + 30);
                                    onSelect({
                                      clinicId: clinic.id,
                                      clinicName: clinic.name,
                                      clinicAddress: clinic.address,
                                      clinicCity: clinic.city,
                                      dentistId: doctor.id,
                                      dentistName: doctor.name,
                                      dentistAvatar: doctor.avatar,
                                      startTime: slot,
                                      endTime: end,
                                    });
                                  }}
                                  className={cn(
                                    'h-9 rounded-lg text-xs font-medium border transition-all',
                                    disabled && 'opacity-40 cursor-not-allowed line-through bg-muted text-muted-foreground border-transparent',
                                    !disabled && !isSelected && 'border-border bg-background hover:border-primary hover:bg-primary/5 hover:text-primary',
                                    isSelected && 'border-primary bg-primary text-primary-foreground shadow-sm scale-105'
                                  )}
                                >
                                  {format(slot, 'HH:mm')}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button disabled={!selected} onClick={() => selected && onSelect(selected)}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
