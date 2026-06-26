import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Stethoscope, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BudgetCardProps {
  id: string;
  title: string;
  patientName: string;
  totalCost: number;
  itemCount: number;
  createdAt: string;
  status: string;
  dentistName?: string | null;
  procedureNames?: string[];
  patientId?: string | null;
  sequentialNumber?: number;
  onOpenChart?: () => void;
  onClick?: () => void;
}

const phaseAccent: Record<string, string> = {
  pending: 'before:bg-amber-400',
  approved: 'before:bg-sky-400',
  awaiting_payment: 'before:bg-orange-400',
  realized: 'before:bg-emerald-400',
  not_approved: 'before:bg-rose-400',
};

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function BudgetCard({ id, title, patientName, totalCost, itemCount, createdAt, status, dentistName, procedureNames = [], patientId, sequentialNumber, onOpenChart, onClick }: BudgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const patientInitials = initialsOf(patientName);
  const visibleProcs = procedureNames.slice(0, 2);
  const extraProcs = procedureNames.length - visibleProcs.length;

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
        {sequentialNumber != null && <span>Orçamento #{sequentialNumber}</span>}
        <time className="ml-auto">{format(new Date(createdAt), "dd MMM", { locale: ptBR })}</time>
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
          <Stethoscope className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground truncate flex-1">Dr(a). {dentistName}</span>
        </div>
      )}

      {visibleProcs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleProcs.map((p, i) => (
            <span key={i} className="text-[10px] bg-muted/70 text-foreground/80 rounded px-1.5 py-0.5 truncate max-w-[140px]">
              {p}
            </span>
          ))}
          {extraProcs > 0 && (
            <span className="text-[10px] text-muted-foreground px-1 py-0.5">+{extraProcs}</span>
          )}
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

      {patientId && onOpenChart && (
        <div
          className="mt-2 pt-2 border-t border-border/40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-center gap-1.5 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChart();
            }}
          >
            <FileText className="h-3 w-3" />
            Abrir prontuário
          </Button>
        </div>
      )}
    </Card>
  );
}
