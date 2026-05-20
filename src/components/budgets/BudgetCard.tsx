import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Stethoscope } from 'lucide-react';

interface BudgetCardProps {
  id: string;
  title: string;
  patientName: string;
  totalCost: number;
  itemCount: number;
  createdAt: string;
  status: string;
  dentistName?: string | null;
  onClick?: () => void;
}

const phaseAccent: Record<string, string> = {
  pending: 'before:bg-amber-400',
  negotiating: 'before:bg-blue-400',
  approved: 'before:bg-emerald-400',
  lost: 'before:bg-rose-400',
};

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function BudgetCard({ id, title, patientName, totalCost, itemCount, createdAt, status, dentistName, onClick }: BudgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const patientInitials = initialsOf(patientName);
  const dentistInitials = dentistName ? initialsOf(dentistName) : '';
  const shortId = id.slice(0, 6);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`relative overflow-hidden pl-3.5 pr-3 py-2.5 bg-card border-border/60 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing touch-none select-none
        before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${phaseAccent[status] ?? 'before:bg-muted'}
        ${isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
    >
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono">
        <span>#{shortId}</span>
        <time>{format(new Date(createdAt), "dd MMM", { locale: ptBR })}</time>
      </div>

      <p className="mt-1 text-sm font-medium text-foreground line-clamp-2 leading-snug">{title}</p>

      <div className="mt-2 flex items-center gap-1.5">
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{patientInitials}</AvatarFallback>
        </Avatar>
        <span className="text-xs text-foreground/80 truncate flex-1">{patientName}</span>
      </div>

      {dentistName && (
        <div className="mt-1 flex items-center gap-1.5">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">{dentistInitials}</AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate flex-1">{dentistName}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
          <ClipboardList className="h-3 w-3" />
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span className="text-sm font-semibold text-foreground">
          R$ {totalCost.toFixed(2).replace('.', ',')}
        </span>
      </div>
    </Card>
  );
}
