import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  { id: 'pending', label: 'Pendente', bar: 'bg-amber-400' },
  { id: 'negotiating', label: 'Em Negociação', bar: 'bg-blue-400' },
  { id: 'approved', label: 'Aprovado', bar: 'bg-emerald-400' },
  { id: 'lost', label: 'Perdido', bar: 'bg-rose-400' },
];

export default function Budgets() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, currentClinicId, clinics } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const isDentist = effectiveRole === 'dentist';
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    const openId = (location.state as any)?.openBudgetId;
    if (openId) {
      setSelectedPlanId(openId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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
        .select('*, patients!inner(id, full_name, clinic_id), treatment_plan_items(id, procedures(name))')
        .order('created_at', { ascending: false });
      if (currentClinicId) {
        query = query.eq('patients.clinic_id', currentClinicId);
      } else if (user) {
        query = query.is('patients.clinic_id', null).eq('dentist_id', user.id);
      }
      if (isDentist && user) query = query.eq('dentist_id', user.id);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const dentistIds = Array.from(new Set(rows.map((r: any) => r.dentist_id).filter(Boolean)));
      let dentistMap: Record<string, string> = {};
      if (dentistIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', dentistIds);
        dentistMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return rows.map((r: any) => ({
        ...r,
        dentist_name: dentistMap[r.dentist_id] ?? null,
        procedure_names: (r.treatment_plan_items ?? [])
          .map((it: any) => it.procedures?.name)
          .filter(Boolean),
      }));
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
                barClass={col.bar}
                total={total}
                items={items}
                onCardClick={(id) => setSelectedPlanId(id)}
                onOpenChart={(pid, budgetId) => navigate(`/patients/${pid}`, { state: { fromBudgetId: budgetId } })}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activePlan && (
            <div className="w-72 opacity-95 rotate-2">
              <BudgetCard
                id={activePlan.id}
                title={activePlan.title}
                patientName={activePlan.patients?.full_name ?? 'Paciente'}
                totalCost={Number(activePlan.total_cost)}
                itemCount={activePlan.treatment_plan_items?.length ?? 0}
                createdAt={activePlan.created_at}
                status={activePlan.status}
                dentistName={activePlan.dentist_name}
                procedureNames={activePlan.procedure_names}
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
  barClass: string;
  total: number;
  items: any[];
  onCardClick: (id: string) => void;
  onOpenChart: (patientId: string) => void;
}

function KanbanColumn({ id, label, barClass, total, items, onCardClick, onOpenChart }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl bg-muted/40 border border-border/40 shadow-sm overflow-hidden min-h-[360px] flex flex-col transition-all ${isOver ? 'ring-2 ring-primary/40 bg-muted/60' : ''}`}
    >
      <div className={`h-1 w-full ${barClass}`} />
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{label}</h3>
          <span className="text-[11px] font-medium text-muted-foreground bg-background rounded-full px-1.5 min-w-[20px] text-center">{items.length}</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          R$ {total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
        </span>
      </div>
      <div className="flex-1 px-2 pb-2 overflow-y-auto">
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
                dentistName={plan.dentist_name}
                procedureNames={plan.procedure_names}
                patientId={plan.patients?.id}
                onOpenChart={plan.patients?.id ? () => onOpenChart(plan.patients.id) : undefined}
                onClick={() => onCardClick(plan.id)}
              />
            ))}
          </div>
        </SortableContext>
        {items.length === 0 && (
          <div className="flex items-center justify-center h-24 mt-1 rounded-lg border border-dashed border-border/40">
            <p className="text-xs text-muted-foreground">Solte um orçamento aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}
