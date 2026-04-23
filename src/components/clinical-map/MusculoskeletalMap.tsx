import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { getConditionMeta } from './mapRegistry';
import type { ClinicalMapProps } from './types';

/** Joint regions: joint-{name}-{L|R|C} (C = central, e.g. neck/spine) */
const JOINTS: Array<{ code: string; label: string; cx: number; cy: number; r: number }> = [
  { code: 'joint-neck-C', label: 'Cervical', cx: 100, cy: 70, r: 8 },
  { code: 'joint-shoulder-R', label: 'Ombro direito', cx: 65, cy: 90, r: 10 },
  { code: 'joint-shoulder-L', label: 'Ombro esquerdo', cx: 135, cy: 90, r: 10 },
  { code: 'joint-elbow-R', label: 'Cotovelo direito', cx: 50, cy: 145, r: 8 },
  { code: 'joint-elbow-L', label: 'Cotovelo esquerdo', cx: 150, cy: 145, r: 8 },
  { code: 'joint-wrist-R', label: 'Punho direito', cx: 42, cy: 195, r: 7 },
  { code: 'joint-wrist-L', label: 'Punho esquerdo', cx: 158, cy: 195, r: 7 },
  { code: 'joint-spine-C', label: 'Coluna lombar', cx: 100, cy: 165, r: 9 },
  { code: 'joint-hip-R', label: 'Quadril direito', cx: 82, cy: 200, r: 9 },
  { code: 'joint-hip-L', label: 'Quadril esquerdo', cx: 118, cy: 200, r: 9 },
  { code: 'joint-knee-R', label: 'Joelho direito', cx: 80, cy: 255, r: 9 },
  { code: 'joint-knee-L', label: 'Joelho esquerdo', cx: 120, cy: 255, r: 9 },
  { code: 'joint-ankle-R', label: 'Tornozelo direito', cx: 78, cy: 305, r: 7 },
  { code: 'joint-ankle-L', label: 'Tornozelo esquerdo', cx: 122, cy: 305, r: 7 },
];

export function MusculoskeletalMap({ entries, onRegionClick, selectedRegion }: ClinicalMapProps) {
  const regionConditions: Record<string, string> = {};
  entries.forEach((e) => {
    if (e.map_type === 'musculoskeletal' && !regionConditions[e.region_code]) {
      regionConditions[e.region_code] = e.condition;
    }
  });

  return (
    <Card className="shadow-card border-border/50 p-4 md:p-6 overflow-x-auto">
      <div className="flex items-center justify-center">
        <svg width="220" height="340" viewBox="0 0 200 320" className="overflow-visible">
          {/* Subtle body silhouette as background */}
          <g opacity="0.18">
            <ellipse cx="100" cy="55" rx="22" ry="26" fill="hsl(var(--muted-foreground))" />
            <path d="M 70,82 L 130,82 Q 142,90 140,170 L 60,170 Q 58,90 70,82 Z" fill="hsl(var(--muted-foreground))" />
            <path d="M 60,90 Q 40,95 36,180 L 56,180 Q 62,140 70,95 Z" fill="hsl(var(--muted-foreground))" />
            <path d="M 140,90 Q 160,95 164,180 L 144,180 Q 138,140 130,95 Z" fill="hsl(var(--muted-foreground))" />
            <path d="M 65,170 L 100,170 L 96,310 Q 92,315 80,315 Q 68,313 65,295 Z" fill="hsl(var(--muted-foreground))" />
            <path d="M 100,170 L 135,170 L 132,295 Q 128,313 120,315 Q 108,315 104,310 Z" fill="hsl(var(--muted-foreground))" />
          </g>

          {JOINTS.map((j) => {
            const cond = regionConditions[j.code];
            const meta = cond ? getConditionMeta('musculoskeletal', cond) : null;
            const fill = meta?.color ?? 'hsl(var(--muted))';
            const selected = selectedRegion === j.code;
            return (
              <Tooltip key={j.code}>
                <TooltipTrigger asChild>
                  <circle
                    cx={j.cx}
                    cy={j.cy}
                    r={selected ? j.r + 2 : j.r}
                    fill={fill}
                    stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                    strokeWidth={selected ? 2.5 : 1.5}
                    onClick={() => onRegionClick(j.code)}
                    className="cursor-pointer transition-all hover:opacity-80"
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p className="font-medium">{j.label}</p>
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

export function getMusculoskeletalRegionLabel(regionCode: string): string {
  const j = JOINTS.find((x) => x.code === regionCode);
  return j?.label ?? regionCode;
}
