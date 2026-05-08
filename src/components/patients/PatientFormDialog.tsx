import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { syncOnePatient } from '@/hooks/useAiSync';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  patient?: any;
  clinicId?: string | null;
}

export function PatientFormDialog({ open, onOpenChange, onSuccess, patient, clinicId }: PatientFormDialogProps) {
  const isEdit = !!patient;
  const { user, isPersonalMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: patient?.full_name ?? '',
    cpf: patient?.cpf ?? '',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    date_of_birth: patient?.date_of_birth ?? '',
    gender: patient?.gender ?? '',
    address: patient?.address ?? '',
    city: patient?.city ?? '',
    state: patient?.state ?? '',
    zip_code: patient?.zip_code ?? '',
    insurance_provider: patient?.insurance_provider ?? '',
    insurance_number: patient?.insurance_number ?? '',
    notes: patient?.notes ?? '',
  });

  const { data: insurancePlans = [] } = useQuery({
    queryKey: ['insurance-plans-select', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', clinicId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        cpf: form.cpf || null,
        phone: form.phone || null,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        insurance_provider: form.insurance_provider || null,
        insurance_number: form.insurance_number || null,
        notes: form.notes || null,
      };

      if (isEdit) {
        const { error } = await supabase.from('patients').update(payload).eq('id', patient.id);
        if (error) throw error;
        toast.success('Paciente atualizado!');
        if (clinicId) syncOnePatient(patient.id, clinicId);
      } else {
        const insertPayload: any = { ...payload, clinic_id: clinicId ?? null };
        // Personal patient: stamp dentist_id so RLS allows access
        if (!clinicId && user?.id) insertPayload.dentist_id = user.id;
        const { data: inserted, error } = await supabase
          .from('patients')
          .insert(insertPayload)
          .select('id')
          .single();
        if (error) throw error;
        toast.success(isPersonalMode ? 'Paciente pessoal cadastrado!' : 'Paciente cadastrado!');
        if (clinicId && inserted?.id) syncOnePatient(inserted.id, clinicId);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => update('cpf', e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => update('state', e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={(e) => update('zip_code', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Convênio</Label>
              {insurancePlans.length > 0 ? (
                <Select value={form.insurance_provider} onValueChange={(v) => update('insurance_provider', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum (Particular)</SelectItem>
                    {insurancePlans.map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.insurance_provider} onChange={(e) => update('insurance_provider', e.target.value)} placeholder="Ex: Amil, Unimed..." />
              )}
            </div>
            <div className="space-y-2">
              <Label>Nº Convênio</Label>
              <Input value={form.insurance_number} onChange={(e) => update('insurance_number', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
