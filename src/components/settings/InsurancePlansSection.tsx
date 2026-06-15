import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { syncClinicConfig } from '@/hooks/useAiSync';

export default function InsurancePlansSection() {
  const { currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['insurance-plans', currentClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('*')
        .eq('clinic_id', currentClinicId!)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinicId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insurance_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-plans'] });
      toast.success('Convênio removido');
      if (currentClinicId) void syncClinicConfig(currentClinicId);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Convênios / Planos de Saúde</CardTitle>
          <CardDescription>Gerencie os convênios aceitos pela clínica.</CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingPlan(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum convênio cadastrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan: any) => (
              <div key={plan.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.type === 'dental' ? 'Odontológico' : plan.type === 'health' ? 'Saúde' : 'Outro'}
                      {plan.ans_code && ` · ANS ${plan.ans_code}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {plan.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPlan(plan); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(plan.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {dialogOpen && (
        <InsurancePlanDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          plan={editingPlan}
          clinicId={currentClinicId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['insurance-plans'] });
            if (currentClinicId) void syncClinicConfig(currentClinicId);
          }}
        />
      )}
    </Card>
  );
}

function InsurancePlanDialog({ open, onOpenChange, plan, clinicId, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: any;
  clinicId: string;
  onSuccess: () => void;
}) {
  const isEdit = !!plan;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    ans_code: plan?.ans_code ?? '',
    type: plan?.type ?? 'dental',
    contact_phone: plan?.contact_phone ?? '',
    contact_email: plan?.contact_email ?? '',
    notes: plan?.notes ?? '',
    is_active: plan?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        ans_code: form.ans_code || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from('insurance_plans').update(payload).eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insurance_plans').insert({ ...payload, clinic_id: clinicId });
        if (error) throw error;
      }
      toast.success(isEdit ? 'Convênio atualizado!' : 'Convênio cadastrado!');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Convênio' : 'Novo Convênio'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Convênio *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Amil Dental" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Código ANS</Label>
              <Input value={form.ans_code} onChange={e => setForm({ ...form, ans_code: e.target.value })} placeholder="000000" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dental">Odontológico</SelectItem>
                  <SelectItem value="health">Saúde</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone contato</Label>
              <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail contato</Label>
              <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            <Label className="text-sm">Ativo</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
