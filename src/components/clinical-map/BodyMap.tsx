import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { getConditionMeta } from './mapRegistry';
import type { ClinicalMapProps } from './types';

interface BodyRegion {
  code: string;
  label: string;
  d: string;
}

const BODY_REGIONS: BodyRegion[] = [
  // Head
  { code: 'body-head', label: 'Cabeça', d: 'M 100,15 Q 130,15 130,45 Q 130,65 115,68 L 100,68 L 85,68 Q 70,65 70,45 Q 70,15 100,15 Z' },
  // Neck
  { code: 'body-neck', label: 'Pescoço', d: 'M 88,68 L 112,68 L 110,80 L 90,80 Z' },
  // Chest / thorax
  { code: 'body-chest', label: 'Tórax', d: 'M 70,82 L 130,82 Q 140,90 138,120 L 62,120 Q 60,90 70,82 Z' },
  // Abdomen
  { code: 'body-abdomen', label: 'Abdômen', d: 'M 64,122 L 136,122 L 134,165 Q 100,170 66,165 Z' },
  // Pelvis
  { code: 'body-pelvis', label: 'Pelve', d: 'M 66,167 L 134,167 L 130,195 Q 100,200 70,195 Z' },
  // Left arm (viewer's left = patient's right)
  { code: 'body-arm-R', label: 'Braço direito', d: 'M 56,85 Q 40,90 38,140 Q 36,180 42,200 L 54,200 Q 58,180 60,140 Q 62,100 70,90 Z' },
  // Right arm (viewer's right = patient's left)
  { code: 'body-arm-L', label: 'Braço esquerdo', d: 'M 144,85 Q 160,90 162,140 Q 164,180 158,200 L 146,200 Q 142,180 140,140 Q 138,100 130,90 Z' },
  // Left leg
  { code: 'body-leg-R', label: 'Perna direita', d: 'M 70,198 L 98,198 L 96,290 Q 92,310 80,310 Q 70,308 70,290 Z' },
  // Right leg
  { code: 'body-leg-L', label: 'Perna esquerda', d: 'M 102,198 L 130,198 L 130,290 Q 130,308 120,310 Q 108,310 104,290 Z' },
];

export function BodyMap({ entries, onRegionClick, selectedRegion }: ClinicalMapProps) {
  const regionConditions: Record<string, string> = {};
  entries.forEach((e) => {
    if (e.map_type === 'body' && !regionConditions[e.region_code]) {
      regionConditions[e.region_code] = e.condition;
    }
  });

  return (
    <Card className="shadow-card border-border/50 p-4 md:p-6 overflow-x-auto">
      <div className="flex items-center justify-center">
        <svg width="220" height="340" viewBox="0 0 200 320" className="overflow-visible">
          {BODY_REGIONS.map((r) => {
            const cond = regionConditions[r.code];
            const meta = cond ? getConditionMeta('body', cond) : null;
            const fill = meta?.color ?? 'hsl(var(--muted))';
            const selected = selectedRegion === r.code;
            return (
              <Tooltip key={r.code}>
                <TooltipTrigger asChild>
                  <path
                    d={r.d}
                    fill={fill}
                    stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                    strokeWidth={selected ? 2.5 : 1.2}
                    onClick={() => onRegionClick(r.code)}
                    className="cursor-pointer transition-all hover:opacity-80"
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p className="font-medium">{r.label}</p>
                  {meta && <p className="text-muted-foreground">{meta.label}</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

export function getBodyRegionLabel(regionCode: string): string {
  const r = BODY_REGIONS.find((x) => x.code === regionCode);
  return r?.label ?? regionCode;
}
