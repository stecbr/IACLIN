import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { FolderHeart, Users } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientPickerDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { currentClinicId, user, isPersonalMode } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const isDentist = effectiveRole === 'dentist';

  const { data: patients = [] } = useQuery({
    queryKey: ['patient-picker', currentClinicId, isPersonalMode, isDentist ? user?.id : 'all'],
    enabled: open,
    queryFn: async () => {
      if (isPersonalMode && user) {
        const { data } = await supabase
          .from('patients')
          .select('id, full_name, phone')
          .is('clinic_id', null)
          .eq('dentist_id', user.id)
          .order('full_name')
          .limit(100);
        return data ?? [];
      }
      let allowedIds: string[] | null = null;
      if (isDentist && user) {
        const [aptRes, recRes] = await Promise.all([
          supabase.from('appointments').select('patient_id').eq('dentist_id', user.id),
          supabase.from('clinical_records').select('patient_id').eq('dentist_id', user.id),
        ]);
        allowedIds = Array.from(new Set([
          ...(aptRes.data ?? []).map((a: any) => a.patient_id),
          ...(recRes.data ?? []).map((r: any) => r.patient_id),
        ]));
        if (allowedIds.length === 0) return [];
      }
      let q = supabase.from('patients').select('id, full_name, phone').order('full_name').limit(100);
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      if (allowedIds) q = q.in('id', allowedIds);
      const { data } = await q;
      return data ?? [];
    },
  });

  const go = (id: string) => {
    onOpenChange(false);
    navigate(`/patients/${id}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar paciente por nome ou telefone..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1.5 py-4 text-sm text-muted-foreground">
            <Users className="h-5 w-5" />
            Nenhum paciente encontrado
          </div>
        </CommandEmpty>
        {patients.length > 0 && (
          <CommandGroup heading="Abrir prontuário">
            {patients.map((p: any) => (
              <CommandItem key={p.id} value={`${p.full_name} ${p.phone ?? ''}`} onSelect={() => go(p.id)}>
                <FolderHeart className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{p.full_name}</span>
                {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}