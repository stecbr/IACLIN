import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export type AvailabilityMode = 'particular' | 'plano' | 'ambos';

interface Plan {
  id: string;
  name: string;
}

interface Props {
  mode: AvailabilityMode;
  onModeChange: (m: AvailabilityMode) => void;
  acceptedPlanIds: string[];
  onAcceptedPlansChange: (ids: string[]) => void;
  availablePlans: Plan[];
  disabled?: boolean;
}

const OPTIONS: { value: AvailabilityMode; label: string; tone: string }[] = [
  { value: 'particular', label: 'Particular', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  { value: 'plano', label: 'Plano', tone: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  { value: 'ambos', label: 'Ambos', tone: 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400' },
];

export function ModeSelector({ mode, onModeChange, acceptedPlanIds, onAcceptedPlansChange, availablePlans, disabled }: Props) {
  const showPlans = mode === 'plano' || mode === 'ambos';
  const toggle = (id: string) => {
    onAcceptedPlansChange(
      acceptedPlanIds.includes(id) ? acceptedPlanIds.filter((x) => x !== id) : [...acceptedPlanIds, id],
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex gap-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(o.value)}
            className={cn(
              'h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors',
              mode === o.value
                ? o.tone
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {showPlans && availablePlans.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled} className="h-7 gap-1 text-[11px]">
              {acceptedPlanIds.length === 0
                ? 'Todos planos'
                : `${acceptedPlanIds.length} plano(s)`}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-64" align="start">
            <Command>
              <CommandInput placeholder="Buscar plano..." className="h-8" />
              <CommandList>
                <CommandEmpty>Nenhum plano</CommandEmpty>
                <CommandGroup>
                  {availablePlans.map((p) => {
                    const selected = acceptedPlanIds.includes(p.id);
                    return (
                      <CommandItem key={p.id} onSelect={() => toggle(p.id)}>
                        <Check className={cn('mr-2 h-3.5 w-3.5', selected ? 'opacity-100' : 'opacity-0')} />
                        {p.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {showPlans && availablePlans.length === 0 && (
        <Badge variant="outline" className="text-[10px] h-6">
          Cadastre planos em Configurações
        </Badge>
      )}
    </div>
  );
}