import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlanFormDialog } from '@/components/superadmin/PlanFormDialog';
import { fetchAdminData } from '@/hooks/usePlatformAdminData';
import {
  SEGMENT_LABELS, CYCLE_LABELS, formatBRL,
  type PlatformPlan,
} from '@/types/superadmin';

export default function SuperAdminPlans() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PlatformPlan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => fetchAdminData<PlatformPlan[]>('plans'),
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    const { error } = await (supabase as any).from('platform_plans').delete().eq('id', deleting.id);
    setDeleteLoading(false);
    setDeleting(null);
    if (error) return toast.error('Erro: ' + error.message);
    await qc.invalidateQueries({ queryKey: ['platform-plans'] });
    toast.success('Plano excluído');
  };

  const grouped = plans.reduce((acc, p) => {
    (acc[p.segment] ||= []).push(p); return acc;
  }, {} as Record<string, PlatformPlan[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Planos da plataforma
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plans.length} plano{plans.length !== 1 ? 's' : ''} configurado{plans.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo plano
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhum plano cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(SEGMENT_LABELS) as Array<keyof typeof SEGMENT_LABELS>).map(seg => {
            const list = grouped[seg] ?? [];
            if (!list.length) return null;
            return (
              <div key={seg} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {SEGMENT_LABELS[seg]}
                </h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map(p => (
                    <div key={p.id} className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{p.name}</h3>
                            <Badge variant="outline">{CYCLE_LABELS[p.billing_cycle]}</Badge>
                            {!p.is_active && <Badge variant="secondary">Inativo</Badge>}
                            {p.segment === 'clinic' && p.max_professionals != null && (
                              <Badge variant="secondary">
                                {p.max_professionals} profissionais
                                {p.extra_professional_price_cents
                                  ? ` · +${formatBRL(p.extra_professional_price_cents)}/extra`
                                  : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-2xl font-bold mt-1 tabular-nums">{formatBRL(p.price_cents)}</p>
                          {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                          {p.features.length > 0 && (
                            <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                              {p.features.slice(0, 4).map((f, i) => <li key={i}>• {f}</li>)}
                            </ul>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <PlanFormDialog
          open
          onClose={() => { setCreating(false); setEditing(null); }}
          plan={editing}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Excluir plano
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano{' '}
              <span className="font-semibold text-foreground">"{deleting?.name}"</span>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}