import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { BreaksEditor, type BreakItem } from './BreaksEditor';
import { ModeSelector, type AvailabilityMode } from './ModeSelector';

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
  // Personal mode: no plan options, lock to particular
  const effectiveMode: AvailabilityMode = scopeIsPersonal ? 'particular' : value.mode;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[110px_auto_1fr_auto] gap-3 items-start py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        <Switch
          checked={value.is_active}
          onCheckedChange={(v) => onChange({ ...value, is_active: v })}
        />
        <span className={`text-sm font-medium ${value.is_active ? '' : 'text-muted-foreground'}`}>
          {label}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          value={value.start_time}
          onChange={(e) => onChange({ ...value, start_time: e.target.value })}
          disabled={disabled}
          className="h-8 w-[100px] text-xs"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="time"
          value={value.end_time}
          onChange={(e) => onChange({ ...value, end_time: e.target.value })}
          disabled={disabled}
          className="h-8 w-[100px] text-xs"
        />
      </div>

      <BreaksEditor
        value={value.breaks}
        onChange={(breaks) => onChange({ ...value, breaks })}
        disabled={disabled}
      />

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
        <span className="text-[11px] text-muted-foreground italic self-center">
          Atendimento pessoal (particular)
        </span>
      )}
    </div>
  );
}