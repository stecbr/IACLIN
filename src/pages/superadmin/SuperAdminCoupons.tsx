import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CouponFormDialog } from '@/components/superadmin/CouponFormDialog';
import { fetchAdminData } from '@/hooks/usePlatformAdminData';
import type { PlatformCoupon } from '@/types/superadmin';

export default function SuperAdminCoupons() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PlatformCoupon | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['platform-coupons'],
    queryFn: () => fetchAdminData<PlatformCoupon[]>('coupons'),
  });

  const handleDelete = async (c: PlatformCoupon) => {
    if (!confirm(`Excluir cupom "${c.code}"?`)) return;
    const { error } = await (supabase as any).from('platform_coupons').delete().eq('id', c.id);
    if (error) return toast.error('Erro: ' + error.message);
    await qc.invalidateQueries({ queryKey: ['platform-coupons'] });
    toast.success('Cupom excluído');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Cupons de desconto
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{coupons.length} cupom(s)</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" /> Novo cupom</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : coupons.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Nenhum cupom criado.</div>
      ) : (
        <div className="rounded-lg border divide-y">
          {coupons.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <Badge variant="outline">
                    {c.discount_type === 'percent' ? `${c.discount_value}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}
                  </Badge>
                  {!c.is_active && <Badge variant="secondary">Inativo</Badge>}
                </div>
                {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usos: {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                  {c.valid_until && ` · Até ${new Date(c.valid_until).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CouponFormDialog open onClose={() => { setCreating(false); setEditing(null); }} coupon={editing} />
      )}
    </div>
  );
}