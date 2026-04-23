import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { getConditionMeta } from './mapRegistry';
import type { ClinicalMapProps } from './types';

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

function ToothSVG({
  number,
  condition,
  onClick,
  isSelected,
}: {
  number: number;
  condition?: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  const meta = condition ? getConditionMeta('tooth', condition) : null;
  const fill = meta?.color ?? '#E5E7EB';
  const isUpper = number < 30;
  const isMolar = [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(number);
  const isPremolar = [14, 15, 24, 25, 34, 35, 44, 45].includes(number);
  const isCanine = [13, 23, 33, 43].includes(number);

  const w = 40;
  const h = 64;

  const getToothPath = () => {
    if (isMolar) {
      return isUpper
        ? { crown: 'M8,28 C8,14 10,6 14,4 C17,2 23,2 26,4 C30,6 32,14 32,28 L32,32 C32,35 30,37 28,37 L12,37 C10,37 8,35 8,32 Z', roots: 'M14,37 L12,52 C12,54 13,55 14,54 L16,44 M20,37 L20,56 C20,58 21,58 21,56 L21,44 M26,37 L28,52 C28,54 27,55 26,54 L24,44' }
        : { crown: 'M8,32 C8,46 10,54 14,56 C17,58 23,58 26,56 C30,54 32,46 32,32 L32,28 C32,25 30,23 28,23 L12,23 C10,23 8,25 8,28 Z', roots: 'M14,23 L12,8 C12,6 13,5 14,6 L16,16 M20,23 L20,4 C20,2 21,2 21,4 L21,16 M26,23 L28,8 C28,6 27,5 26,6 L24,16' };
    } else if (isPremolar) {
      return isUpper
        ? { crown: 'M12,28 C12,16 14,8 17,5 C19,3 21,3 23,5 C26,8 28,16 28,28 L28,33 C28,35 27,36 25,36 L15,36 C13,36 12,35 12,33 Z', roots: 'M18,36 L17,52 C17,55 18,56 19,54 L20,44 M22,36 L23,52 C23,55 22,56 21,54 L20,44' }
        : { crown: 'M12,36 C12,48 14,56 17,59 C19,61 21,61 23,59 C26,56 28,48 28,36 L28,31 C28,29 27,28 25,28 L15,28 C13,28 12,29 12,31 Z', roots: 'M18,28 L17,12 C17,9 18,8 19,10 L20,20 M22,28 L23,12 C23,9 22,8 21,10 L20,20' };
    } else if (isCanine) {
      return isUpper
        ? { crown: 'M14,28 C14,18 16,10 18,5 C19,3 21,3 22,5 C24,10 26,18 26,28 L26,34 C26,36 25,37 23,37 L17,37 C15,37 14,36 14,34 Z', roots: 'M19,37 L18,54 C18,57 20,58 20,56 L20,44 M21,37 L22,54 C22,57 20,58 20,56' }
        : { crown: 'M14,36 C14,46 16,54 18,59 C19,61 21,61 22,59 C24,54 26,46 26,36 L26,30 C26,28 25,27 23,27 L17,27 C15,27 14,28 14,30 Z', roots: 'M19,27 L18,10 C18,7 20,6 20,8 L20,20 M21,27 L22,10 C22,7 20,6 20,8' };
    } else {
      return isUpper
        ? { crown: 'M14,26 C14,16 15,9 17,6 C18,4 22,4 23,6 C25,9 26,16 26,26 L26,34 C26,36 25,37 23,37 L17,37 C15,37 14,36 14,34 Z', roots: 'M19,37 L19,55 C19,57 20,58 21,57 L21,37' }
        : { crown: 'M14,38 C14,48 15,55 17,58 C18,60 22,60 23,58 C25,55 26,48 26,38 L26,30 C26,28 25,27 23,27 L17,27 C15,27 14,28 14,30 Z', roots: 'M19,27 L19,9 C19,7 20,6 21,7 L21,27' };
    }
  };

  const paths = getToothPath();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex flex-col items-center gap-1 cursor-pointer group transition-all duration-200 ${
            isSelected ? 'scale-110 -translate-y-1' : 'hover:scale-105 hover:-translate-y-0.5'
          }`}
          onClick={onClick}
        >
          {isUpper && <span className="text-[10px] text-muted-foreground font-medium">{number}</span>}
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <path d={paths.roots} fill="none" stroke={condition === 'missing' ? '#D1D5DB' : '#E8D5A3'} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
            <path
              d={paths.crown}
              fill={fill}
              stroke={isSelected ? 'hsl(var(--primary))' : '#D1D5DB'}
              strokeWidth={isSelected ? 2.5 : 1.2}
              className="group-hover:stroke-primary transition-colors"
            />
            {condition === 'missing' && (
              <>
                <line x1={10} y1={isUpper ? 6 : 28} x2={30} y2={isUpper ? 36 : 58} stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" />
                <line x1={30} y1={isUpper ? 6 : 28} x2={10} y2={isUpper ? 36 : 58} stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" />
              </>
            )}
          </svg>
          {!isUpper && <span className="text-[10px] text-muted-foreground font-medium">{number}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side={isUpper ? 'top' : 'bottom'} className="text-xs">
        <p className="font-medium">Dente {number}</p>
        {meta && <p className="text-muted-foreground">{meta.label}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function ToothMap({ entries, onRegionClick, selectedRegion }: ClinicalMapProps) {
  // Build conditions map from latest entry per tooth
  const toothConditions: Record<number, string> = {};
  entries.forEach((e) => {
    const match = e.region_code.match(/^tooth-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!toothConditions[num]) toothConditions[num] = e.condition;
    }
  });

  const selectedTooth = selectedRegion?.match(/^tooth-(\d+)/)?.[1];

  return (
    <Card className="shadow-card border-border/50 p-4 md:p-6 overflow-x-auto">
      <div className="flex flex-col items-center gap-4 md:gap-6 min-w-[320px]">
        <div className="flex items-end gap-0.5 md:gap-1 flex-wrap justify-center">
          {UPPER_RIGHT.map((n) => (
            <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => onRegionClick(`tooth-${n}`)} isSelected={selectedTooth === String(n)} />
          ))}
          <div className="w-2 md:w-4" />
          {UPPER_LEFT.map((n) => (
            <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => onRegionClick(`tooth-${n}`)} isSelected={selectedTooth === String(n)} />
          ))}
        </div>
        <div className="w-full border-t border-dashed border-border" />
        <div className="flex items-start gap-0.5 md:gap-1 flex-wrap justify-center">
          {LOWER_RIGHT.map((n) => (
            <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => onRegionClick(`tooth-${n}`)} isSelected={selectedTooth === String(n)} />
          ))}
          <div className="w-2 md:w-4" />
          {LOWER_LEFT.map((n) => (
            <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => onRegionClick(`tooth-${n}`)} isSelected={selectedTooth === String(n)} />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function getToothRegionLabel(regionCode: string): string {
  const match = regionCode.match(/^tooth-(\d+)/);
  return match ? `Dente ${match[1]}` : regionCode;
}
