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
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { PlatformCoupon, DiscountType } from '@/types/superadmin';

interface Props {
  open: boolean;
  onClose: () => void;
  coupon?: PlatformCoupon | null;
}

export function CouponFormDialog({ open, onClose, coupon }: Props) {
  const qc = useQueryClient();
  const isEdit = !!coupon;

  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(coupon?.discount_type ?? 'percent');
  const [discountValue, setDiscountValue] = useState(coupon?.discount_value?.toString() ?? '');
  const [validFrom, setValidFrom] = useState(coupon?.valid_from?.slice(0, 10) ?? '');
  const [validUntil, setValidUntil] = useState(coupon?.valid_until?.slice(0, 10) ?? '');
  const [maxUses, setMaxUses] = useState(coupon?.max_uses?.toString() ?? '');
  const [isActive, setIsActive] = useState(coupon?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        code: code.toUpperCase().trim(),
        description: description || null,
        discount_type: discountType,
        discount_value: parseFloat(discountValue.replace(',', '.')),
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        is_active: isActive,
      };
      const { error } = isEdit
        ? await (supabase as any).from('platform_coupons').update(payload).eq('id', coupon!.id)
        : await (supabase as any).from('platform_coupons').insert(payload);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast.success(isEdit ? 'Cupom atualizado!' : 'Cupom criado!');
      onClose();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'desconhecido'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cupom' : 'Novo cupom'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="BLACK20" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={description ?? ''} onChange={e => setDescription(e.target.value)} placeholder="Black Friday 2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={discountType} onValueChange={v => setDiscountType(v as DiscountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Válido de</Label>
              <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Válido até</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Limite de usos (opcional)</Label>
            <Input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="100" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Cupom ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !code || !discountValue}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}