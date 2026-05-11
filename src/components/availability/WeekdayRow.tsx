import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { BreaksEditor, type BreakItem } from './BreaksEditor';
import { ModeSelector, type AvailabilityMode } from './ModeSelector';
import { Clock, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WeekdayTemplate {
  weekday: number;
  is_active: boolean;
  start_time: string; // HH:MM
  end_time: string;
  breaks: BreakItem[];
  mode: AvailabilityMode;
  accepted_plan_ids: string[];
}

interface Props {
  label: string;
  value: WeekdayTemplate;
  onChange: (next: WeekdayTemplate) => void;
  availablePlans: { id: string; name: string }[];
  scopeIsPersonal: boolean;
}

export function WeekdayRow({ label, value, onChange, availablePlans, scopeIsPersonal }: Props) {
  const disabled = !value.is_active;
  const effectiveMode: AvailabilityMode = scopeIsPersonal ? 'particular' : value.mode;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors',
        value.is_active ? 'border-border' : 'border-dashed border-border/60 bg-muted/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2.5">
          <Switch
            checked={value.is_active}
            onCheckedChange={(v) => onChange({ ...value, is_active: v })}
          />
          <span className={cn('text-sm font-semibold', !value.is_active && 'text-muted-foreground')}>
            {label}
          </span>
          {!value.is_active && (
            <span className="text-[11px] text-muted-foreground italic">Folga</span>
          )}
        </div>
        {!scopeIsPersonal ? (
          <ModeSelector
            mode={effectiveMode}
            onModeChange={(m) => onChange({ ...value, mode: m })}
            acceptedPlanIds={value.accepted_plan_ids}
            onAcceptedPlansChange={(ids) => onChange({ ...value, accepted_plan_ids: ids })}
            availablePlans={availablePlans}
            disabled={disabled}
          />
        ) : (
          <span className="text-[11px] text-muted-foreground italic">
            Atendimento pessoal (particular)
          </span>
        )}
      </div>

      {/* Body */}
      {value.is_active && (
        <div className="px-4 py-3 space-y-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Horário
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={value.start_time}
                onChange={(e) => onChange({ ...value, start_time: e.target.value })}
                disabled={disabled}
                className="h-8 w-[110px] text-xs"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="time"
                value={value.end_time}
                onChange={(e) => onChange({ ...value, end_time: e.target.value })}
                disabled={disabled}
                className="h-8 w-[110px] text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Coffee className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Intervalos
              </span>
            </div>
            <BreaksEditor
              value={value.breaks}
              onChange={(breaks) => onChange({ ...value, breaks })}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}