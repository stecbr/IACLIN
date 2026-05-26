import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, Palette, Check, Trash2 } from 'lucide-react';
import { ReactNode, useState, useEffect } from 'react';
import {
  usePatientPersonalization,
  PERSONALIZATION_COLORS,
} from '@/hooks/usePatientPersonalization';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  children?: ReactNode;
}

export function PatientPersonalizeMenu({ patientId, children }: Props) {
  const { data, update, clear, isSaving } = usePatientPersonalization(patientId);
  const [tag, setTag] = useState(data.tag ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) setTag(data.tag ?? '');
  }, [open, data.tag]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children ?? (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <Palette className="h-4 w-4" />
            Personalizar
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cor do card</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => update({ color: null })}
              className={cn(
                'h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground',
                !data.color && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
              title="Sem cor"
            >
              <span className="text-[10px]">—</span>
            </button>
            {PERSONALIZATION_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => update({ color: c.value })}
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110',
                  data.color === c.value && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {data.color === c.value && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="personalize-tag" className="text-xs uppercase tracking-wide text-muted-foreground">
            Etiqueta
          </Label>
          <div className="flex gap-2">
            <Input
              id="personalize-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              maxLength={24}
              placeholder="Ex: Retorno, Acompanhamento"
              className="h-8"
            />
            <Button
              size="sm"
              className="h-8"
              disabled={isSaving || (tag ?? '') === (data.tag ?? '')}
              onClick={() => update({ tag: tag.trim() || null })}
            >
              Salvar
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => update({ is_favorite: !data.is_favorite })}
            className="inline-flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground"
          >
            <Star
              className={cn('h-4 w-4', data.is_favorite && 'fill-yellow-400 text-yellow-400')}
            />
            {data.is_favorite ? 'Favorito' : 'Marcar favorito'}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              clear();
              setTag('');
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}