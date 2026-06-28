import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSoloMode } from '@/hooks/useSoloMode';
import { useClinicPatients } from '@/hooks/useClinicPatients';
import { canManageClinicFinance } from '@/lib/financePermissions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess?: () => void;
  /** Lock the transaction to a specific patient (used from prontuário). */
  lockedPatientId?: string;
  lockedPatientName?: string;
  /** Force a clinic context (used from prontuário when patient belongs to a clinic). */
  forcedClinicId?: string | null;
  /** Pre-select the transaction type when the dialog opens. */
  defaultType?: 'income' | 'expense';
  /** Pre-select the category when the dialog opens. */
  defaultCategory?: string;
}

export function TransactionDialog({
  open, onOpenChange, onSuccess,
  lockedPatientId, lockedPatientName, forcedClinicId,
  defaultType = 'income', defaultCategory = 'consultation',
}: Props) {
  const { user, currentClinicId, clinics } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const { isSolo } = useSoloMode();

  const clinicId = forcedClinicId !== undefined ? forcedClinicId : currentClinicId;
  const hasClinic = !!clinicId;

  const canManage = canManageClinicFinance({
    isSolo,
    role: effectiveRole as any,
    hasClinic,
  });

  // freeze context to detect mid-form switches
  const frozenClinicId = useRef<string | null | undefined>(null);
  const [contextName, setContextName] = useState('Pessoal');

  useEffect(() => {
    if (open) {
      frozenClinicId.current = clinicId;
      const c = clinics.find((x) => x.clinic_id === clinicId);
      setContextName(clinicId ? (c?.clinic_name ?? 'Clínica') : 'Pessoal');
    }
  }, [open, clinicId, clinics]);

  const [form, setForm] = useState({
    type: defaultType as 'income' | 'expense',
    category: defaultCategory,
    description: '',
    amount: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    payment_method: '',
    notes: '',
    patient_id: lockedPatientId ?? '',
  });
  const [cardFee, setCardFee] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, patient_id: lockedPatientId ?? '' }));
    }
  }, [open, lockedPatientId]);

  const { data: clinicPatients = [], isLoading: loadingPatients } = useClinicPatients(
    clinicId,
    { enabled: !lockedPatientId && form.type === 'income' && open },
  );

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return clinicPatients.slice(0, 50);
    return clinicPatients.filter((p) => p.full_name.toLowerCase().includes(q)).slice(0, 50);
  }, [clinicPatients, patientSearch]);

  const selectedPatientName = lockedPatientName
    ?? clinicPatients.find((p) => p.id === form.patient_id)?.full_name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (frozenClinicId.current !== clinicId) {
      toast.error('O contexto foi alterado. Reabra o formulário para continuar.');
      onOpenChange(false);
      return;
    }

    const parsedAmount = parseFloat(form.amount);
    if (!form.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor maior que zero');
      return;
    }

    // Patient is required when the transaction is locked to a patient or
    // when the user picked a patient. Otherwise it's optional.
    const patientId = form.patient_id || null;

    // Approval logic: only meaningful for income tied to a clinic
    const needsApproval = hasClinic && form.type === 'income' && !canManage;

    setSaving(true);
    try {
      const isCard = form.payment_method === 'credit_card' || form.payment_method === 'debit_card';
      const fee = (form.type === 'income' && isCard)
        ? Math.max(0, parseFloat((cardFee || '0').replace(',', '.')) || 0)
        : 0;
      const payload: any = {
        type: form.type,
        category: form.category,
        description: form.description || null,
        amount: parsedAmount,
        due_date: form.due_date,
        status: needsApproval ? 'pending' : form.status,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        dentist_id: user.id,
        clinic_id: clinicId ?? null,
        patient_id: patientId,
        card_fee_amount: fee,
        approval_status: needsApproval ? 'awaiting_approval' : 'approved',
        approval_requested_by: needsApproval ? user.id : null,
        approval_decided_by: needsApproval ? null : user.id,
        approval_decided_at: needsApproval ? null : new Date().toISOString(),
      };

      const { error } = await (supabase as any).from('financial_transactions').insert(payload);
      if (error) throw error;

      toast.success(needsApproval
        ? 'Cobrança enviada para aprovação da secretaria/admin.'
        : 'Transação registrada!');
      onOpenChange(false);
      onSuccess?.();
      setForm({
        type: defaultType, category: defaultCategory, description: '', amount: '',
        due_date: format(new Date(), 'yyyy-MM-dd'), status: 'pending',
        payment_method: '', notes: '', patient_id: lockedPatientId ?? '',
      });
      setCardFee('');
      setPatientSearch('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const showPatientPicker = form.type === 'income' && !lockedPatientId && hasClinic;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2 mb-1">
          Será registrada em: <span className="font-medium text-foreground">{contextName}</span>
          {lockedPatientName && (
            <> · Paciente: <span className="font-medium text-foreground">{lockedPatientName}</span></>
          )}
        </div>

        {hasClinic && form.type === 'income' && !canManage && (
          <div className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-300 p-2">
            Como você é dentista, esta cobrança será enviada para aprovação da secretaria/admin da clínica antes de aparecer no financeiro.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta</SelectItem>
                  <SelectItem value="procedure">Procedimento</SelectItem>
                  <SelectItem value="rent">Aluguel</SelectItem>
                  <SelectItem value="supplies">Material</SelectItem>
                  <SelectItem value="salary">Salário</SelectItem>
                  <SelectItem value="utilities">Água / Luz</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showPatientPicker && (
            <div className="space-y-2">
              <Label>Paciente (opcional)</Label>
              <Popover open={patientPickerOpen} onOpenChange={setPatientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className={selectedPatientName ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedPatientName ?? 'Selecionar paciente...'}
                    </span>
                    <Search className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Buscar paciente..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      autoFocus
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto py-1">
                    {form.patient_id && (
                      <button
                        type="button"
                        className="w-full text-left text-xs px-3 py-1.5 text-muted-foreground hover:bg-muted/50"
                        onClick={() => { setForm({ ...form, patient_id: '' }); setPatientPickerOpen(false); }}
                      >
                        Limpar seleção
                      </button>
                    )}
                    {loadingPatients ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin inline-block mr-1.5" /> Carregando...
                      </div>
                    ) : filteredPatients.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum paciente</p>
                    ) : (
                      filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`w-full text-left text-sm px-3 py-1.5 hover:bg-muted/50 ${form.patient_id === p.id ? 'bg-muted/40' : ''}`}
                          onClick={() => { setForm({ ...form, patient_id: p.id }); setPatientPickerOpen(false); }}
                        >
                          {p.full_name}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrição da transação"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number" step="0.01" min="0" required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input
                type="date" required
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma Pgto</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão Débito</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="bank_transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type === 'income' &&
            (form.payment_method === 'credit_card' || form.payment_method === 'debit_card') && (
            <div className="space-y-2">
              <Label>Taxa da maquininha (R$) — opcional</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cardFee}
                onChange={(e) => setCardFee(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              <p className="text-[11px] text-muted-foreground">
                Deduzido do lucro líquido no DRE.
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving
              ? 'Salvando...'
              : (hasClinic && form.type === 'income' && !canManage)
                ? 'Enviar para aprovação'
                : 'Salvar Transação'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}