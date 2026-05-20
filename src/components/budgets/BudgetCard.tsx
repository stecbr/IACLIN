import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical } from 'lucide-react';

interface BudgetCardProps {
  id: string;
  title: string;
  patientName: string;
  totalCost: number;
  itemCount: number;
  createdAt: string;
  status: string;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  negotiating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  lost: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

export function BudgetCard({ id, title, patientName, totalCost, itemCount, createdAt, status, onClick }: BudgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const initials = patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 border-border/50 hover:shadow-md transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar"
          className="mt-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onClick}
          role={onClick ? 'button' : undefined}
        >
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{patientName}</span>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-sm font-semibold text-foreground">
              R$ {totalCost.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <time className="text-[10px] text-muted-foreground">
              {format(new Date(createdAt), "dd MMM", { locale: ptBR })}
            </time>
          </div>
        </div>
      </div>
    </Card>
  );
}
