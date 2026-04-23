import { Card } from '@/components/ui/card';
import { Coffee, Utensils, Cookie, Moon, Apple } from 'lucide-react';
import { getConditionMeta } from './mapRegistry';
import type { ClinicalMapProps } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MEALS = [
  { code: 'breakfast', label: 'Café da manhã', icon: Coffee, time: '07:00' },
  { code: 'morning_snack', label: 'Lanche da manhã', icon: Apple, time: '10:00' },
  { code: 'lunch', label: 'Almoço', icon: Utensils, time: '12:30' },
  { code: 'afternoon_snack', label: 'Lanche da tarde', icon: Cookie, time: '16:00' },
  { code: 'dinner', label: 'Jantar', icon: Moon, time: '20:00' },
];

/** region_code: meal-{slot}-{YYYY-MM-DD} */
function buildRegionCode(slot: string, date: Date): string {
  return `meal-${slot}-${format(date, 'yyyy-MM-dd')}`;
}

export function MealMap({ entries, onRegionClick, selectedRegion }: ClinicalMapProps) {
  const today = new Date();

  // For each meal slot today, find the latest entry
  const slotConditions: Record<string, { condition: string; notes: string | null; payload: any }> = {};
  entries.forEach((e) => {
    if (e.map_type !== 'meal') return;
    const m = e.region_code.match(/^meal-([a-z_]+)-(\d{4}-\d{2}-\d{2})$/);
    if (!m) return;
    const slot = m[1];
    const dateStr = m[2];
    const todayStr = format(today, 'yyyy-MM-dd');
    if (dateStr === todayStr && !slotConditions[slot]) {
      slotConditions[slot] = { condition: e.condition, notes: e.notes, payload: e.payload };
    }
  });

  return (
    <Card className="shadow-card border-border/50 p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Diário de hoje · {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </h3>
      </div>

      <div className="grid gap-3">
        {MEALS.map((meal) => {
          const code = buildRegionCode(meal.code, today);
          const data = slotConditions[meal.code];
          const meta = data ? getConditionMeta('meal', data.condition) : null;
          const selected = selectedRegion === code;
          const Icon = meal.icon;

          return (
            <button
              key={meal.code}
              onClick={() => onRegionClick(code)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:bg-muted/40 ${
                selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'
              }`}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: meta ? `${meta.color}20` : 'hsl(var(--muted))' }}
              >
                <Icon className="h-5 w-5" style={{ color: meta?.color ?? 'hsl(var(--muted-foreground))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-foreground">{meal.label}</p>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{meal.time}</span>
                </div>
                {meta ? (
                  <p className="text-xs text-muted-foreground truncate">
                    <span style={{ color: meta.color }} className="font-medium">{meta.label}</span>
                    {data?.payload?.kcal && <span className="ml-1.5">· {data.payload.kcal} kcal</span>}
                    {data?.notes && <span className="ml-1.5">· {data.notes}</span>}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/70 italic">Não registrado</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function getMealRegionLabel(regionCode: string): string {
  const m = regionCode.match(/^meal-([a-z_]+)-(\d{4}-\d{2}-\d{2})$/);
  if (!m) return regionCode;
  const meal = MEALS.find((x) => x.code === m[1]);
  return `${meal?.label ?? m[1]} · ${m[2].split('-').reverse().join('/')}`;
}
