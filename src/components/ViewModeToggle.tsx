import { useState } from 'react';
import { Stethoscope, Building2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useViewMode } from '@/hooks/useViewMode';
import { useAuth } from '@/contexts/AuthContext';
import { FirstConsultModeDialog } from '@/components/FirstConsultModeDialog';
import { toast } from 'sonner';

interface Props {
  variant?: 'default' | 'compact';
  className?: string;
}

function switchedKey(userId: string, clinicId: string) {
  return `iaclin.viewModeSwitched.${userId}.${clinicId}`;
}

/**
 * Toggle that lets a clinic owner / admin switch between "Modo Gestor"
 * (clinic dashboard) and "Modo Consulta" (professional dashboard).
 */
export function ViewModeToggle({ variant = 'default', className }: Props) {
  const { viewMode, canSwitch, hasProfessionalProfile, setViewMode } = useViewMode();
  const { user, currentClinicId } = useAuth();
  const [askProfile, setAskProfile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canSwitch) return null;

  const isManager = viewMode === 'manager';
  const targetMode = isManager ? 'consult' : 'manager';
  const targetLabel = isManager ? 'Modo Consulta' : 'Modo Gestor';
  const Icon = isManager ? Stethoscope : Building2;

  const hasSwitchedBefore =
    !!user?.id && !!currentClinicId &&
    !!localStorage.getItem(switchedKey(user.id, currentClinicId));

  const applySwitch = () => {
    setViewMode(targetMode);
    toast.success(isManager ? 'Modo consulta ativado' : 'Modo gestor ativado');
    if (user?.id && currentClinicId) {
      localStorage.setItem(switchedKey(user.id, currentClinicId), '1');
    }
  };

  const handleClick = () => {
    // Going to consult but no profile yet → fill in specialty/CRM first
    if (isManager && !hasProfessionalProfile) {
      setAskProfile(true);
      return;
    }
    // After the first successful switch, always ask for confirmation
    if (hasSwitchedBefore) {
      setConfirmOpen(true);
      return;
    }
    applySwitch();
  };

  return (
    <>
      <Button
        type="button"
        variant={isManager ? 'default' : 'outline'}
        size={variant === 'compact' ? 'sm' : 'default'}
        onClick={handleClick}
        className={className}
      >
        <Icon className="h-4 w-4" />
        <span className={variant === 'compact' ? 'text-xs' : ''}>{targetLabel}</span>
      </Button>

      {/* First-time: fill specialty/CRM to unlock consult mode */}
      <FirstConsultModeDialog
        open={askProfile}
        onOpenChange={setAskProfile}
        onSaved={() => {
          applySwitch();
        }}
      />

      {/* Subsequent switches: simple confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              Alternar para {targetLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isManager
                ? 'Você irá entrar no modo de atendimento clínico. As funcionalidades de gestão da clínica ficarão em segundo plano.'
                : 'Você irá entrar no modo de gestão da clínica. As funcionalidades de atendimento ficarão em segundo plano.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); applySwitch(); }}>
              Sim, alternar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}