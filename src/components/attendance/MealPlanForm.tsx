import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface MealPlan {
  goal?: string;
  daily_calories?: string;
  breakfast?: string;
  morning_snack?: string;
  lunch?: string;
  afternoon_snack?: string;
  dinner?: string;
  evening_snack?: string;
  recommendations?: string;
}

interface Props {
  value: MealPlan;
  onChange: (next: MealPlan) => void;
}

/** Plano alimentar com 6 refeições. Texto livre por refeição (ágil). */
export function MealPlanForm({ value, onChange }: Props) {
  const set = (k: keyof MealPlan) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });

  const meals: Array<{ k: keyof MealPlan; label: string; emoji: string }> = [
    { k: 'breakfast', label: 'Café da manhã', emoji: '🥣' },
    { k: 'morning_snack', label: 'Lanche da manhã', emoji: '🍎' },
    { k: 'lunch', label: 'Almoço', emoji: '🍱' },
    { k: 'afternoon_snack', label: 'Lanche da tarde', emoji: '🥪' },
    { k: 'dinner', label: 'Jantar', emoji: '🍽️' },
    { k: 'evening_snack', label: 'Ceia', emoji: '🌙' },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Objetivo & meta calórica</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Objetivo</Label>
            <Input value={value.goal ?? ''} onChange={set('goal')} placeholder="Ex: emagrecimento, hipertrofia, manutenção" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Calorias diárias (kcal)</Label>
            <Input value={value.daily_calories ?? ''} onChange={set('daily_calories')} placeholder="1800" inputMode="numeric" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Refeições</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {meals.map((m) => (
            <div key={m.k} className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><span>{m.emoji}</span>{m.label}</Label>
              <Textarea
                rows={2}
                value={(value[m.k] as string) ?? ''}
                onChange={set(m.k)}
                placeholder="Descreva os alimentos, porções e horário sugerido..."
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recomendações gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={value.recommendations ?? ''}
            onChange={set('recommendations')}
            placeholder="Hidratação, suplementação, restrições, atividades físicas..."
          />
        </CardContent>
      </Card>
    </div>
  );
}