import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DndContext, closestCorners, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetFormDialog } from '@/components/budgets/BudgetFormDialog';
import { BudgetDetailDialog } from '@/components/budgets/BudgetDetailDialog';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus, Building2, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

const COLUMNS = [
  { id: 'pending', label: 'Pendente', color: 'border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10' },
  { id: 'negotiating', label: 'Em Negociação', color: 'border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/10' },
  { id: 'approved', label: 'Aprovado', color: 'border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/10' },
  { id: 'lost', label: 'Perdido', color: 'border-rose-400/50 bg-rose-50/30 dark:bg-rose-950/10' },
];

export default function Budgets() {
  const queryClient = useQueryClient();
  const { user, currentClinicId, clinics } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const isDentist = effectiveRole === 'dentist';
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeClinic = clinics.find((c) => c.clinic_id === currentClinicId) ?? null;
  const contextLabel = currentClinicId
    ? `Orçamentos · ${activeClinic?.clinic_name ?? 'Clínica'}`
    : 'Orçamentos Pessoais';

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans-kanban', currentClinicId, isDentist ? user?.id : 'all'],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('treatment_plans')
        .select('*, patients!inner(full_name, clinic_id), treatment_plan_items(id)')
        .order('created_at', { ascending: false });
      if (currentClinicId) {
        query = query.eq('patients.clinic_id', currentClinicId);
      } else if (user) {
        query = query.is('patients.clinic_id', null).eq('dentist_id', user.id);
      }
      if (isDentist && user) query = query.eq('dentist_id', user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('treatment_plans').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans-kanban'] });
      toast.success('Status atualizado');
    },
  });

  const columnData = useMemo(() => {
    const result: Record<string, any[]> = {};
    COLUMNS.forEach(c => { result[c.id] = []; });
    plans.forEach((p: any) => {
      const col = result[p.status] ?? result['pending'];
      col.push(p);
    });
    return result;
  }, [plans]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const activeItem = plans.find((p: any) => p.id === active.id);
    if (!activeItem) return;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find(c => c.id === overId);
    if (targetColumn && activeItem.status !== targetColumn.id) {
      updateStatus.mutate({ id: activeItem.id, status: targetColumn.id });
      return;
    }

    // Check if dropped on another card - find the column of that card
    const targetCard = plans.find((p: any) => p.id === overId);
    if (targetCard && activeItem.status !== targetCard.status) {
      updateStatus.mutate({ id: activeItem.id, status: targetCard.status });
    }
  };

  const activePlan = activeId ? plans.find((p: any) => p.id === activeId) : null;

  const headerButton = (
    <>
      <Badge variant="outline" className="gap-1.5 mr-1">
        {currentClinicId ? <Building2 className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
        {currentClinicId ? 'Clínica' : 'Pessoal'}
      </Badge>
      <Button onClick={() => setFormOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Novo Orçamento
      </Button>
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={contextLabel} description="Pipeline de orçamentos">
          {headerButton}
        </PageHeader>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
        <BudgetFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={contextLabel} description="Pipeline de orçamentos">
          {headerButton}
        </PageHeader>
        <EmptyState
          icon={ClipboardList}
          title="Nenhum orçamento ainda"
          description="Crie seu primeiro orçamento clicando no botão acima."
          illustration="tooth"
        />
        <BudgetFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={contextLabel} description={`${plans.length} orçamentos no pipeline`}>
        {headerButton}
      </PageHeader>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const items = columnData[col.id] ?? [];
            const total = items.reduce((s: number, p: any) => s + Number(p.total_cost), 0);
            return (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                colorClass={col.color}
                total={total}
                items={items}
                onCardClick={(id) => setSelectedPlanId(id)}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activePlan && (
            <div className="w-64 opacity-90">
              <BudgetCard
                id={activePlan.id}
                title={activePlan.title}
                patientName={activePlan.patients?.full_name ?? 'Paciente'}
                totalCost={Number(activePlan.total_cost)}
                itemCount={activePlan.treatment_plan_items?.length ?? 0}
                createdAt={activePlan.created_at}
                status={activePlan.status}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <BudgetFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <BudgetDetailDialog
        planId={selectedPlanId}
        open={!!selectedPlanId}
        onOpenChange={(o) => !o && setSelectedPlanId(null)}
      />
    </div>
  );
}

interface KanbanColumnProps {
  id: string;
  label: string;
  colorClass: string;
  total: number;
  items: any[];
  onCardClick: (id: string) => void;
}

function KanbanColumn({ id, label, colorClass, total, items, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-3 min-h-[300px] transition-all ${colorClass} ${isOver ? 'ring-2 ring-primary/40 scale-[1.01]' : ''}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">{items.length}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          R$ {total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
        </span>
      </div>
      <SortableContext items={items.map((p: any) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((plan: any) => (
            <BudgetCard
              key={plan.id}
              id={plan.id}
              title={plan.title}
              patientName={plan.patients?.full_name ?? 'Paciente'}
              totalCost={Number(plan.total_cost)}
              itemCount={plan.treatment_plan_items?.length ?? 0}
              createdAt={plan.created_at}
              status={plan.status}
              onClick={() => onCardClick(plan.id)}
            />
          ))}
        </div>
      </SortableContext>
      {items.length === 0 && (
        <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border/40">
          <p className="text-xs text-muted-foreground">Arraste aqui</p>
        </div>
      )}
    </div>
  );
}
