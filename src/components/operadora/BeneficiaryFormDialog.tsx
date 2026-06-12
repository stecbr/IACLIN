import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import type { Beneficiary } from '@/pages/operadora/OperatorBeneficiaries';

interface Dependent {
  id?: string;
  full_name: string;
  cpf: string;
  card_number: string;
  relationship: string;
  date_of_birth: string;
  _new?: boolean;
  _deleted?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  operatorId: string | null;
  beneficiary: Beneficiary | null;
  onSaved: () => void;
}

const empty = {
  full_name: '', cpf: '', card_number: '', plan_name: '', plan_type: 'individual',
  status: 'em_dia', due_day: '', next_due_date: '', last_payment_at: '',
  phone: '', email: '', date_of_birth: '', enrolled_at: '', notes: '',
};

export default function BeneficiaryFormDialog({ open, onOpenChange, operatorId, beneficiary, onSaved }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [deps, setDeps] = useState<Dependent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (beneficiary) {
      setForm({
        full_name: beneficiary.full_name ?? '',
        cpf: beneficiary.cpf ?? '',
        card_number: beneficiary.card_number ?? '',
        plan_name: beneficiary.plan_name ?? '',
        plan_type: beneficiary.plan_type ?? 'individual',
        status: beneficiary.status ?? 'em_dia',
        due_day: beneficiary.due_day ?? '',
        next_due_date: beneficiary.next_due_date ?? '',
        last_payment_at: (beneficiary as any).last_payment_at ?? '',
        phone: beneficiary.phone ?? '',
        email: beneficiary.email ?? '',
        date_of_birth: beneficiary.date_of_birth ?? '',
        enrolled_at: beneficiary.enrolled_at ?? '',
        notes: beneficiary.notes ?? '',
      });
      // load dependents
      supabase.from('operator_beneficiary_dependents').select('*').eq('beneficiary_id', beneficiary.id).then(({ data }) => {
        setDeps((data ?? []).map((d: any) => ({
          id: d.id,
          full_name: d.full_name,
          cpf: d.cpf ?? '',
          card_number: d.card_number ?? '',
          relationship: d.relationship ?? 'outro',
          date_of_birth: d.date_of_birth ?? '',
        })));
      });
    } else {
      setForm(empty);
      setDeps([]);
    }
  }, [open, beneficiary]);

  function setField(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  function addDep() {
    setDeps((d) => [...d, { full_name: '', cpf: '', card_number: '', relationship: 'filho', date_of_birth: '', _new: true }]);
  }
  function updateDep(i: number, k: string, v: string) {
    setDeps((d) => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  }
  function removeDep(i: number) {
    setDeps((d) => d.map((x, idx) => idx === i ? { ...x, _deleted: true } : x));
  }

  async function handleSave() {
    if (!operatorId) return;
    if (!form.full_name.trim() || !form.card_number.trim()) {
      toast.error('Nome e carteirinha são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        operator_id: operatorId,
        full_name: form.full_name.trim(),
        cpf: form.cpf.replace(/\D/g, '') || null,
        card_number: form.card_number.trim(),
        plan_name: form.plan_name.trim() || null,
        plan_type: form.plan_type,
        status: form.status,
        due_day: form.due_day ? Number(form.due_day) : null,
        next_due_date: form.next_due_date || null,
        last_payment_at: form.last_payment_at || null,
        phone: form.phone || null,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        enrolled_at: form.enrolled_at || null,
        notes: form.notes || null,
      };
      let benefId = beneficiary?.id;
      if (beneficiary) {
        const { error } = await supabase.from('operator_beneficiaries').update(payload).eq('id', beneficiary.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('operator_beneficiaries').insert(payload).select('id').single();
        if (error) throw error;
        benefId = data.id;
      }

      // dependents sync
      for (const d of deps) {
        if (d._deleted && d.id) {
          await supabase.from('operator_beneficiary_dependents').delete().eq('id', d.id);
        } else if (d._new && !d._deleted) {
          if (d.full_name.trim()) {
            await supabase.from('operator_beneficiary_dependents').insert({
              beneficiary_id: benefId,
              full_name: d.full_name.trim(),
              cpf: d.cpf.replace(/\D/g, '') || null,
              card_number: d.card_number || null,
              relationship: d.relationship,
              date_of_birth: d.date_of_birth || null,
            });
          }
        } else if (d.id && !d._deleted) {
          await supabase.from('operator_beneficiary_dependents').update({
            full_name: d.full_name.trim(),
            cpf: d.cpf.replace(/\D/g, '') || null,
            card_number: d.card_number || null,
            relationship: d.relationship,
            date_of_birth: d.date_of_birth || null,
          }).eq('id', d.id);
        }
      }

      toast.success(beneficiary ? 'Beneficiário atualizado' : 'Beneficiário cadastrado');
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const visibleDeps = deps.filter((d) => !d._deleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{beneficiary ? 'Editar beneficiário' : 'Novo beneficiário'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome completo*</Label>
              <Input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setField('cpf', e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Carteirinha*</Label>
              <Input value={form.card_number} onChange={(e) => setField('card_number', e.target.value)} />
            </div>
            <div>
              <Label>Plano</Label>
              <Input value={form.plan_name} onChange={(e) => setField('plan_name', e.target.value)} placeholder="Ex: Plano Ouro" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.plan_type} onValueChange={(v) => setField('plan_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="familiar">Familiar</SelectItem>
                  <SelectItem value="empresarial">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia de vencimento</Label>
              <Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setField('due_day', e.target.value)} />
            </div>
            <div>
              <Label>Próximo vencimento</Label>
              <Input type="date" value={form.next_due_date ?? ''} onChange={(e) => setField('next_due_date', e.target.value)} />
            </div>
            <div>
              <Label>Último pagamento</Label>
              <Input type="date" value={form.last_payment_at ?? ''} onChange={(e) => setField('last_payment_at', e.target.value)} />
            </div>
            <div>
              <Label>Data de adesão</Label>
              <Input type="date" value={form.enrolled_at ?? ''} onChange={(e) => setField('enrolled_at', e.target.value)} />
            </div>
            <div>
              <Label>Nascimento</Label>
              <Input type="date" value={form.date_of_birth ?? ''} onChange={(e) => setField('date_of_birth', e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} />
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Dependentes</h4>
              <Button type="button" variant="outline" size="sm" onClick={addDep} className="rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            {visibleDeps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dependente.</p>
            ) : (
              <div className="space-y-3">
                {deps.map((d, i) => d._deleted ? null : (
                  <div key={d.id ?? `new-${i}`} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 rounded-xl border border-border">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Nome</Label>
                      <Input value={d.full_name} onChange={(e) => updateDep(i, 'full_name', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input value={d.cpf} onChange={(e) => updateDep(i, 'cpf', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Carteirinha</Label>
                      <Input value={d.card_number} onChange={(e) => updateDep(i, 'card_number', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Parentesco</Label>
                      <Select value={d.relationship} onValueChange={(v) => updateDep(i, 'relationship', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conjuge">Cônjuge</SelectItem>
                          <SelectItem value="filho">Filho</SelectItem>
                          <SelectItem value="filha">Filha</SelectItem>
                          <SelectItem value="pai">Pai</SelectItem>
                          <SelectItem value="mae">Mãe</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDep(i)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}