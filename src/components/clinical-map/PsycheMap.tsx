import { Card } from '@/components/ui/card';
import { getConditionMeta } from './mapRegistry';
import { PSYCHE_AREAS, getPsycheAreaLabel } from '@/lib/psyMapData';
import type { ClinicalMapProps } from './types';
import { cn } from '@/lib/utils';

export function PsycheMap({ entries, onRegionClick, selectedRegion }: ClinicalMapProps) {
  const regionConditions: Record<string, string> = {};
  // Most recent (entries already ordered desc by created_at)
  entries.forEach((e) => {
    if (e.map_type === 'psyche' && !regionConditions[e.region_code]) {
      regionConditions[e.region_code] = e.condition;
    }
  });

  return (
    <Card className="shadow-card border-border/50 p-4 md:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PSYCHE_AREAS.map((area) => {
          const cond = regionConditions[area.code];
          const meta = cond ? getConditionMeta('psyche', cond) : null;
          const selected = selectedRegion === area.code;
          return (
            <button
              key={area.code}
              onClick={() => onRegionClick(area.code)}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 sm:p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md',
                selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
              )}
              style={meta ? { backgroundColor: `${meta.color}15` } : undefined}
            >
              <span className="text-3xl">{area.emoji}</span>
              <p className="text-sm font-semibold leading-tight">{area.label}</p>
              {meta ? (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: meta.color, color: '#fff' }}
                >
                  {meta.label}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Toque para registrar</span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export { getPsycheAreaLabel as getPsycheRegionLabel };
