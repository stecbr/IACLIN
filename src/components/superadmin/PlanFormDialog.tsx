import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  SEGMENT_LABELS, CYCLE_LABELS,
  type PlatformPlan, type PlanSegment, type BillingCycle,
} from '@/types/superadmin';

interface Props {
  open: boolean;
  onClose: () => void;
  plan?: PlatformPlan | null;
}

export function PlanFormDialog({ open, onClose, plan }: Props) {
  const qc = useQueryClient();
  const isEdit = !!plan;

  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [segment, setSegment] = useState<PlanSegment>(plan?.segment ?? 'clinic');
  const [cycle, setCycle] = useState<BillingCycle>(plan?.billing_cycle ?? 'monthly');
  const [priceBrl, setPriceBrl] = useState(plan ? (plan.price_cents / 100).toFixed(2) : '');
  const [features, setFeatures] = useState((plan?.features ?? []).join('\n'));
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [maxPros, setMaxPros] = useState(
    plan?.max_professionals != null ? String(plan.max_professionals) : ''
  );
  const [extraPriceBrl, setExtraPriceBrl] = useState(
    plan?.extra_professional_price_cents != null
      ? (plan.extra_professional_price_cents / 100).toFixed(2)
      : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const price_cents = Math.round(parseFloat(priceBrl.replace(',', '.')) * 100) || 0;
      const featuresArr = features.split('\n').map(s => s.trim()).filter(Boolean);
      const payload: any = {
        name, description: description || null, segment, billing_cycle: cycle,
        price_cents, features: featuresArr, is_active: isActive,
      };
      if (segment === 'clinic') {
        payload.max_professionals = maxPros.trim() === '' ? null : Math.max(0, parseInt(maxPros, 10) || 0);
        payload.extra_professional_price_cents = extraPriceBrl.trim() === ''
          ? null
          : Math.round(parseFloat(extraPriceBrl.replace(',', '.')) * 100) || 0;
      } else {
        payload.max_professionals = null;
        payload.extra_professional_price_cents = null;
      }
      let savedId = plan?.id;
      if (isEdit) {
        const { error } = await (supabase as any).from('platform_plans').update(payload).eq('id', plan!.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from('platform_plans').insert(payload).select('id').single();
        if (error) throw error;
        savedId = data?.id;
      }
      toast.success(isEdit ? 'Plano atualizado!' : 'Plano criado!');

      // Sync with Stripe (product + price)
      if (savedId) {
        try {
          const { data: syncData, error: syncErr } = await supabase.functions.invoke('stripe-sync-plan', {
            body: { plan_id: savedId },
          });
          if (syncErr) throw syncErr;
          if (syncData?.price_changed) {
            toast.success('Sincronizado com Stripe (novo preço criado)');
          } else {
            toast.success('Sincronizado com Stripe');
          }
        } catch (err: any) {
          toast.error('Plano salvo, mas falhou sync com Stripe: ' + (err?.message ?? 'erro'));
        }
      }

      await qc.invalidateQueries({ queryKey: ['platform-plans'] });
      onClose();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'desconhecido'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar plano' : 'Novo plano'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Profissional Mensal" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Select value={segment} onValueChange={v => setSegment(v as PlanSegment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(SEGMENT_LABELS) as [PlanSegment, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ciclo</Label>
              <Select value={cycle} onValueChange={v => setCycle(v as BillingCycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CYCLE_LABELS) as [BillingCycle, string][]).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preço (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input className="pl-9" value={priceBrl} onChange={e => setPriceBrl(e.target.value)} placeholder="199,00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea rows={2} value={description ?? ''} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Recursos (um por linha)</Label>
            <Textarea rows={4} value={features} onChange={e => setFeatures(e.target.value)} placeholder={'Agenda ilimitada\nProntuário eletrônico\nWhatsApp integrado'} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Plano ativo</Label>
              <p className="text-xs text-muted-foreground">Planos inativos não aparecem para os clientes.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name || !priceBrl}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}