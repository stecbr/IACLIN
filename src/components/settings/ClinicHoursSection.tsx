import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DayHours {
  open: string;
  close: string;
  enabled: boolean;
}

export interface BusinessHours {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

const DEFAULT_HOURS: BusinessHours = {
  mon: { open: '08:00', close: '18:00', enabled: true },
  tue: { open: '08:00', close: '18:00', enabled: true },
  wed: { open: '08:00', close: '18:00', enabled: true },
  thu: { open: '08:00', close: '18:00', enabled: true },
  fri: { open: '08:00', close: '18:00', enabled: true },
  sat: { open: '08:00', close: '12:00', enabled: false },
  sun: { open: '08:00', close: '12:00', enabled: false },
};

interface Props {
  value: BusinessHours | null;
  onChange: (hours: BusinessHours) => void;
}

export function ClinicHoursSection({ value, onChange }: Props) {
  const hours = value ?? DEFAULT_HOURS;

  const updateDay = (day: keyof BusinessHours, field: keyof DayHours, val: any) => {
    onChange({
      ...hours,
      [day]: { ...hours[day], [field]: val },
    });
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Horário de Funcionamento</Label>
      <div className="space-y-2">
        {(Object.keys(DAY_LABELS) as (keyof BusinessHours)[]).map((day) => (
          <div key={day} className="flex items-center gap-3 py-1.5">
            <Switch
              checked={hours[day].enabled}
              onCheckedChange={(v) => updateDay(day, 'enabled', v)}
            />
            <span className={`w-20 text-sm ${hours[day].enabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {DAY_LABELS[day]}
            </span>
            {hours[day].enabled ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={hours[day].open}
                  onChange={(e) => updateDay(day, 'open', e.target.value)}
                  className="w-28 h-8 text-xs"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={hours[day].close}
                  onChange={(e) => updateDay(day, 'close', e.target.value)}
                  className="w-28 h-8 text-xs"
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Fechado</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { DEFAULT_HOURS };
