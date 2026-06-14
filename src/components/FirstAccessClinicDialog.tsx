import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsClinicSignup } from '@/hooks/useIsClinicSignup';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Settings } from 'lucide-react';

/**
 * Modal de boas-vindas para usuários cadastrados diretamente como Clínica.
 * Exibido apenas no primeiro acesso à clínica (welcome_dismissed_at IS NULL).
 */
export function FirstAccessClinicDialog() {
  const navigate = useNavigate();
  const { currentClinicId } = useAuth();
  const isClinicSignup = useIsClinicSignup();
  const [open, setOpen] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isClinicSignup || !currentClinicId) return;
    (async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, welcome_dismissed_at, onboarding_completed_at')
        .eq('id', currentClinicId)
        .maybeSingle();
      if (cancelled || !data) return;
      const c = data as any;
      if (!c.welcome_dismissed_at && !c.onboarding_completed_at) {
        setClinicId(c.id);
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClinicSignup, currentClinicId]);

  const dismiss = async () => {
    if (clinicId) {
      await supabase
        .from('clinics')
        .update({ welcome_dismissed_at: new Date().toISOString() } as any)
        .eq('id', clinicId);
    }
    setOpen(false);
  };

  const handleGoSettings = async () => {
    await dismiss();
    navigate('/settings');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center gap-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle>Bem-vindo(a)!</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Sua clínica foi criada com sucesso.
            <br />
            <br />
            Para concluir o processo de credenciamento e disponibilizar sua clínica
            para pacientes, acesse <strong>Configurações</strong> e preencha todas as
            informações obrigatórias.
            <br />
            <br />
            Após finalizar o cadastro e salvar as informações, sua clínica poderá
            ficar disponível na plataforma.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => void dismiss()} className="w-full sm:w-auto">
            Fazer Depois
          </Button>
          <Button onClick={handleGoSettings} className="w-full sm:w-auto gap-2">
            <Settings className="h-4 w-4" />
            Ir para Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}