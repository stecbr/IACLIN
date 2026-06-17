import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stethoscope } from 'lucide-react';
import {
  SpecialtySelect,
  registrationLabelForSpecialty,
  registrationPlaceholderForSpecialty,
  validateRegistrationForSpecialty,
} from '@/components/SpecialtySelect';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

/**
 * Shown the first time a clinic owner / admin activates "Modo Consulta"
 * without having specialty + professional registration filled in for their
 * clinic_members row. Persists the data and registers a primary
 * professional_specialty + clinic_member_specialties entry.
 */
export function FirstConsultModeDialog({ open, onOpenChange, onSaved }: Props) {
  const { user, currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [specialty, setSpecialty] = useState('');
  const [registration, setRegistration] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.id || !currentClinicId) return;
    if (!specialty.trim()) {
      toast.error('Selecione sua especialidade');
      return;
    }
    const regErr = validateRegistrationForSpecialty(registration, specialty);
    if (regErr) {
      toast.error(regErr);
      return;
    }
    setSaving(true);
    try {
      // 1. Update the owner's clinic_members row.
      const { data: member, error: memberErr } = await supabase
        .from('clinic_members')
        .update({ specialty, registration_number: registration.trim() })
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .select('id')
        .maybeSingle();
      if (memberErr) throw memberErr;

      // 2. Upsert into professional_specialties (personal catalogue).
      const { data: existingPS } = await supabase
        .from('professional_specialties' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('specialty', specialty)
        .maybeSingle();
      if (!existingPS) {
        await supabase.from('professional_specialties' as any).insert({
          user_id: user.id,
          specialty,
          is_primary: true,
        });
      }

      // 3. Link in clinic_member_specialties.
      if (member?.id) {
        const { data: existingCMS } = await supabase
          .from('clinic_member_specialties' as any)
          .select('id')
          .eq('clinic_member_id', member.id)
          .eq('specialty', specialty)
          .maybeSingle();
        if (!existingCMS) {
          await supabase
            .from('clinic_member_specialties' as any)
            .insert({ clinic_member_id: member.id, specialty });
        }
      }

      toast.success('Perfil profissional salvo');
      qc.invalidateQueries({ queryKey: ['view-mode-member-profile'] });
      qc.invalidateQueries({ queryKey: ['active-specialty'] });
      qc.invalidateQueries({ queryKey: ['member-specialty'] });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Stethoscope className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Ativar Modo Consulta</DialogTitle>
          <DialogDescription className="text-center">
            Para atender pacientes, informe sua especialidade e registro profissional.
            Você continua sendo dono(a) da clínica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="fc-spec">Especialidade <span className="text-destructive">*</span></Label>
            <SpecialtySelect
              id="fc-spec"
              value={specialty}
              onChange={setSpecialty}
              placeholder="Selecione"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fc-reg">{registrationLabelForSpecialty(specialty)} <span className="text-destructive">*</span></Label>
            <Input
              id="fc-reg"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              placeholder={registrationPlaceholderForSpecialty(specialty)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !specialty.trim() || !registration.trim()}>
            {saving ? 'Salvando…' : 'Ativar modo consulta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}