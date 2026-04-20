import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMedicoDialog({ open, onOpenChange }: Props) {
  const { currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', registration: '', specialty: '', password: '' });

  const reset = () => setForm({ name: '', email: '', registration: '', specialty: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClinicId) return;
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      toast.error('Preencha nome, e-mail e senha (mín. 6 caracteres)');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-member', {
        body: {
          clinic_id: currentClinicId,
          email: form.email.trim(),
          full_name: form.name.trim(),
          password: form.password,
          role: 'dentist',
          specialty: form.specialty.trim() || null,
          registration_number: form.registration.trim() || null,
        },
      });
      if (error) throw error;
      toast.success('Médico cadastrado!', { description: `${form.name} já pode acessar com o e-mail e senha definidos.` });
      qc.invalidateQueries({ queryKey: ['clinica-medicos'] });
      qc.invalidateQueries({ queryKey: ['clinica-stats'] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar médico</DialogTitle>
          <DialogDescription>
            Enviaremos um convite por e-mail para o profissional acessar a sua clínica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="med-name">Nome completo</Label>
            <Input id="med-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. João Silva" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="med-email">E-mail</Label>
            <Input id="med-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao@email.com" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="med-reg">CRM / CRO</Label>
              <Input id="med-reg" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="123456-SP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-spec">Especialidade</Label>
              <Input id="med-spec" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Cardiologia" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="med-pass">Senha temporária</Label>
            <Input id="med-pass" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" minLength={6} required />
            <p className="text-xs text-muted-foreground">Compartilhe esta senha com o médico. Ele poderá alterá-la depois.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}