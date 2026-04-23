import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { getConditionMeta } from './mapRegistry';
import type { ClinicalMapProps } from './types';

/**
 * Foot regions: encoded as `foot-{L|R}-{region}`.
 * Toes: foot-L-toe-1 ... foot-L-toe-5 (1 = hallux/dedão).
 * Other regions: heel, arch, forefoot, midfoot.
 */

interface RegionDef {
  code: string;
  label: string;
  // SVG element factory
  render: (props: { fill: string; selected: boolean; onClick: () => void; key: string }) => JSX.Element;
}

function buildFootRegions(side: 'L' | 'R'): RegionDef[] {
  const isLeft = side === 'L';
  const sign = isLeft ? 1 : -1;
  const cx = isLeft ? 80 : 200;

  // Toes: row near top of foot. Hallux is widest, on the inner side.
  // Inner side = right side of left foot (closer to centerline) and vice versa.
  const toes: RegionDef[] = [];
  for (let i = 1; i <= 5; i++) {
    // toe 1 (hallux) is on the inner side
    const toeOrder = isLeft ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]; // visual position 0..4 from left to right
    const visualIndex = isLeft ? 5 - i : i - 1;
    const xOffset = (visualIndex - 2) * 14;
    const isHallux = i === 1;
    const r = isHallux ? 11 : 7.5;
    const cy = isHallux ? 30 : 32;
    const tx = cx + xOffset + (isHallux ? sign * 6 : 0);
    toes.push({
      code: `foot-${side}-toe-${i}`,
      label: i === 1 ? 'Hálux' : `${i}º dedo`,
      render: ({ fill, selected, onClick, key }) => (
        <ellipse
          key={key}
          cx={tx}
          cy={cy}
          rx={r}
          ry={r * 1.15}
          fill={fill}
          stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
          strokeWidth={selected ? 2.5 : 1.2}
          onClick={onClick}
          className="cursor-pointer transition-all hover:opacity-80"
          style={{ transformOrigin: `${tx}px ${cy}px`, transform: selected ? 'scale(1.1)' : 'scale(1)' }}
        />
      ),
    });
  }

  const other: RegionDef[] = [
    {
      code: `foot-${side}-forefoot`,
      label: 'Antepé',
      render: ({ fill, selected, onClick, key }) => (
        <path
          key={key}
          d={`M ${cx - 28},55 Q ${cx},45 ${cx + 28},55 L ${cx + 30},85 Q ${cx},90 ${cx - 30},85 Z`}
          fill={fill}
          stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
          strokeWidth={selected ? 2.5 : 1.2}
          onClick={onClick}
          className="cursor-pointer transition-all hover:opacity-80"
        />
      ),
    },
    {
      code: `foot-${side}-arch`,
      label: 'Arco plantar',
      render: ({ fill, selected, onClick, key }) => (
        <path
          key={key}
          d={`M ${cx - 26},90 Q ${cx},95 ${cx + 26},90 L ${cx + 24},135 Q ${cx},140 ${cx - 24},135 Z`}
          fill={fill}
          stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
          strokeWidth={selected ? 2.5 : 1.2}
          onClick={onClick}
          className="cursor-pointer transition-all hover:opacity-80"
        />
      ),
    },
    {
      code: `foot-${side}-heel`,
      label: 'Calcanhar',
      render: ({ fill, selected, onClick, key }) => (
        <ellipse
          key={key}
          cx={cx}
          cy={160}
          rx={26}
          ry={22}
          fill={fill}
          stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
          strokeWidth={selected ? 2.5 : 1.2}
          onClick={onClick}
          className="cursor-pointer transition-all hover:opacity-80"
        />
      ),
    },
  ];

  return [...toes, ...other];
}

export function FootMap({ entries, onRegionClick, selectedRegion }: ClinicalMapProps) {
  // Build region → latest condition map
  const regionConditions: Record<string, string> = {};
  entries.forEach((e) => {
    if (e.map_type === 'foot' && !regionConditions[e.region_code]) {
      regionConditions[e.region_code] = e.condition;
    }
  });

  const leftRegions = buildFootRegions('L');
  const rightRegions = buildFootRegions('R');

  return (
    <Card className="shadow-card border-border/50 p-4 md:p-6 overflow-x-auto">
      <div className="flex items-center justify-center gap-8">
        <svg width="280" height="220" viewBox="0 0 280 220" className="overflow-visible">
          {/* Labels */}
          <text x="80" y="15" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">Pé Esquerdo</text>
          <text x="200" y="15" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">Pé Direito</text>

          {[...leftRegions, ...rightRegions].map((region) => {
            const cond = regionConditions[region.code];
            const meta = cond ? getConditionMeta('foot', cond) : null;
            const fill = meta?.color ?? 'hsl(var(--muted))';
            const selected = selectedRegion === region.code;
            return (
              <Tooltip key={region.code}>
                <TooltipTrigger asChild>
                  <g>
                    {region.render({
                      fill,
                      selected,
                      onClick: () => onRegionClick(region.code),
                      key: region.code,
                    })}
                  </g>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p className="font-medium">{region.label}</p>
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

export function getFootRegionLabel(regionCode: string): string {
  const m = regionCode.match(/^foot-([LR])-(.+)$/);
  if (!m) return regionCode;
  const side = m[1] === 'L' ? 'Esq.' : 'Dir.';
  const part = m[2];
  if (part.startsWith('toe-')) {
    const n = part.split('-')[1];
    const name = n === '1' ? 'Hálux' : `${n}º dedo`;
    return `${name} ${side}`;
  }
  const labels: Record<string, string> = { heel: 'Calcanhar', arch: 'Arco', forefoot: 'Antepé', midfoot: 'Meio-pé' };
  return `${labels[part] ?? part} ${side}`;
}
